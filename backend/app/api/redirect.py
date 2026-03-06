from urllib.parse import urlencode, urlparse, urlunparse, parse_qs
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import update

from app.core.database import get_db
from app.core.config import settings
from app.models.tracking_link import TrackingLink
from app.models.click_event import ClickEvent

router = APIRouter()


@router.get("/t/{short_code}")
def redirect_tracking_link(short_code: str, request: Request, db: Session = Depends(get_db)):
    link = db.query(TrackingLink).filter(TrackingLink.short_code == short_code).first()

    if not link:
        return RedirectResponse(url=settings.TRACKING_DESTINATION_URL, status_code=302)

    # Record click event
    event = ClickEvent(
        tracking_link_id=link.id,
        content_id=link.content_id,
        platform=link.platform,
        user_agent=request.headers.get("user-agent", "")[:500],
        referrer=request.headers.get("referer", "")[:500],
        ip_address=request.client.host if request.client else None,
    )
    db.add(event)

    # Atomic increment click_count
    db.execute(
        update(TrackingLink)
        .where(TrackingLink.id == link.id)
        .values(click_count=TrackingLink.click_count + 1)
    )
    db.commit()

    # Build redirect URL with UTM params
    utm_params = {
        "utm_source": link.utm_source,
        "utm_medium": link.utm_medium,
        "utm_campaign": link.utm_campaign,
    }
    parsed = urlparse(link.destination_url)
    existing_params = parse_qs(parsed.query)
    existing_params.update(utm_params)
    new_query = urlencode(existing_params, doseq=True)
    redirect_url = urlunparse(parsed._replace(query=new_query))

    return RedirectResponse(url=redirect_url, status_code=302)
