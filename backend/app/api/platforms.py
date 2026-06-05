from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.core.database import get_supabase

router = APIRouter()

SUPPORTED_PLATFORMS = [
    "youtube", "naver_blog", "facebook", "instagram", "linkedin", "living_sequence_lab",
]

_COLUMNS = "id, platform, is_connected, account_name, account_id"


@router.get("/")
def list_platforms(sb: Client = Depends(get_supabase)):
    res = sb.table("platform_connections").select(_COLUMNS).execute()
    existing = {row["platform"] for row in res.data}
    missing = [p for p in SUPPORTED_PLATFORMS if p not in existing]
    if missing:
        sb.table("platform_connections").insert(
            [{"platform": p, "is_connected": False} for p in missing]
        ).execute()
        res = sb.table("platform_connections").select(_COLUMNS).execute()
    return res.data


@router.post("/{platform}/disconnect")
def disconnect_platform(platform: str, sb: Client = Depends(get_supabase)):
    if platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")
    res = sb.table("platform_connections").update({
        "is_connected": False,
        "access_token": None,
        "refresh_token": None,
        "account_name": None,
        "account_id": None,
    }).eq("platform", platform).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Platform connection not found")
    return res.data[0]
