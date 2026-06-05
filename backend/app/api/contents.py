from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.core.database import get_supabase

router = APIRouter()


class ScheduleRequest(BaseModel):
    scheduled_at: str


@router.patch("/{content_id}/schedule")
def schedule_content(content_id: int, body: ScheduleRequest, sb: Client = Depends(get_supabase)):
    res = sb.table("contents").update({
        "scheduled_at": body.scheduled_at,
        "status": "scheduled",
    }).eq("id", content_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Content not found")
    return res.data[0]
