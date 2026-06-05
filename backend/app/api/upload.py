import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.core.database import get_supabase
from app.core.config import settings

router = APIRouter()


class UploadRequest(BaseModel):
    platforms: list[str]


@router.post("/{content_id}")
def upload_content(content_id: int, body: UploadRequest, sb: Client = Depends(get_supabase)):
    content = sb.table("contents").select("id").eq("id", content_id).limit(1).execute()
    if not content.data:
        raise HTTPException(status_code=404, detail="Content not found")

    results = []
    for platform in body.platforms:
        hist = sb.table("upload_history").insert({
            "content_id": content_id,
            "platform": platform,
            "status": "pending",
        }).execute()
        history_id = hist.data[0]["id"]

        short_code = secrets.token_urlsafe(6)
        sb.table("tracking_links").insert({
            "upload_history_id": history_id,
            "content_id": content_id,
            "platform": platform,
            "short_code": short_code,
            "destination_url": settings.TRACKING_DESTINATION_URL,
            "utm_source": platform,
            "utm_medium": "social",
            "utm_campaign": f"content_{content_id}",
        }).execute()

        results.append({
            "platform": platform,
            "history_id": history_id,
            "status": "pending",
            "tracking_url": f"/t/{short_code}",
        })

    sb.table("contents").update({"status": "uploading"}).eq("id", content_id).execute()
    return {"message": "Upload started", "results": results}


@router.get("/history/{content_id}")
def get_upload_history(content_id: int, sb: Client = Depends(get_supabase)):
    res = sb.table("upload_history").select("*").eq("content_id", content_id).order("created_at", desc=True).execute()
    return res.data


@router.post("/retry/{history_id}")
def retry_upload(history_id: int, sb: Client = Depends(get_supabase)):
    res = sb.table("upload_history").select("*").eq("id", history_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="History not found")
    if res.data[0]["status"] != "failed":
        raise HTTPException(status_code=400, detail="Only failed uploads can be retried")
    sb.table("upload_history").update({"status": "pending", "error_message": None}).eq("id", history_id).execute()
    return {"message": "Retry started", "history_id": history_id}
