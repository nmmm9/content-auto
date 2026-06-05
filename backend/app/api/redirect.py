from urllib.parse import urlencode, urlparse, urlunparse, parse_qs
from fastapi import APIRouter, Request, Depends
from fastapi.responses import RedirectResponse
from supabase import Client

from app.core.database import get_supabase
from app.core.config import settings

router = APIRouter()


def build_redirect_url(destination_url: str, utm_source: str, utm_medium: str, utm_campaign: str) -> str:
    parsed = urlparse(destination_url)
    params = parse_qs(parsed.query)
    params.update({
        "utm_source": [utm_source],
        "utm_medium": [utm_medium],
        "utm_campaign": [utm_campaign],
    })
    new_query = urlencode(params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


@router.get("/t/{short_code}")
def redirect_tracking_link(short_code: str, request: Request, sb: Client = Depends(get_supabase)):
    res = sb.table("tracking_links").select("*").eq("short_code", short_code).limit(1).execute()
    if not res.data:
        return RedirectResponse(url=settings.TRACKING_DESTINATION_URL, status_code=302)

    link = res.data[0]

    # 클릭 기록 — tracking_links.click_count 증분은 DB 트리거가 처리
    sb.table("click_events").insert({
        "tracking_link_id": link["id"],
        "content_id": link["content_id"],
        "platform": link["platform"],
        "user_agent": request.headers.get("user-agent", "")[:500],
        "referrer": request.headers.get("referer", "")[:500],
        "ip_address": request.client.host if request.client else None,
    }).execute()

    redirect_url = build_redirect_url(
        link["destination_url"], link["utm_source"], link["utm_medium"], link["utm_campaign"]
    )
    return RedirectResponse(url=redirect_url, status_code=302)
