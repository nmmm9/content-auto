from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from typing import Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.tracking_link import TrackingLink
from app.models.click_event import ClickEvent
from app.models.content import Content

router = APIRouter()


@router.get("/links")
def get_tracking_links(
    content_id: Optional[int] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(TrackingLink)
    if content_id:
        query = query.filter(TrackingLink.content_id == content_id)
    if platform:
        query = query.filter(TrackingLink.platform == platform)
    links = query.order_by(TrackingLink.created_at.desc()).all()

    return [
        {
            "id": l.id,
            "content_id": l.content_id,
            "platform": l.platform,
            "short_code": l.short_code,
            "destination_url": l.destination_url,
            "utm_source": l.utm_source,
            "utm_medium": l.utm_medium,
            "utm_campaign": l.utm_campaign,
            "click_count": l.click_count,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in links
    ]


@router.get("/analytics/summary")
def get_analytics_summary(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)

    # Total counts
    total_clicks = db.query(func.count(ClickEvent.id)).filter(
        ClickEvent.clicked_at >= since
    ).scalar() or 0

    total_links = db.query(func.count(TrackingLink.id)).scalar() or 0

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_clicks = db.query(func.count(ClickEvent.id)).filter(
        ClickEvent.clicked_at >= today_start
    ).scalar() or 0

    # Platform breakdown
    platform_rows = (
        db.query(ClickEvent.platform, func.count(ClickEvent.id))
        .filter(ClickEvent.clicked_at >= since)
        .group_by(ClickEvent.platform)
        .order_by(func.count(ClickEvent.id).desc())
        .all()
    )
    platform_breakdown = []
    for platform, count in platform_rows:
        platform_breakdown.append({
            "platform": platform,
            "total_clicks": count,
            "percentage": round(count / total_clicks * 100, 1) if total_clicks > 0 else 0,
        })

    # Top content
    content_rows = (
        db.query(
            ClickEvent.content_id,
            func.count(ClickEvent.id).label("clicks"),
        )
        .filter(ClickEvent.clicked_at >= since)
        .group_by(ClickEvent.content_id)
        .order_by(func.count(ClickEvent.id).desc())
        .limit(10)
        .all()
    )
    top_content = []
    for content_id, clicks in content_rows:
        content = db.query(Content).filter(Content.id == content_id).first()
        platforms = (
            db.query(ClickEvent.platform)
            .filter(ClickEvent.content_id == content_id, ClickEvent.clicked_at >= since)
            .distinct()
            .all()
        )
        top_content.append({
            "content_id": content_id,
            "content_title": content.title if content else f"Content #{content_id}",
            "total_clicks": clicks,
            "platforms": [p[0] for p in platforms],
        })

    # Daily trend
    daily_rows = (
        db.query(
            cast(ClickEvent.clicked_at, Date).label("date"),
            func.count(ClickEvent.id),
        )
        .filter(ClickEvent.clicked_at >= since)
        .group_by(cast(ClickEvent.clicked_at, Date))
        .order_by(cast(ClickEvent.clicked_at, Date))
        .all()
    )
    daily_trend = [
        {"date": str(date), "click_count": count}
        for date, count in daily_rows
    ]

    return {
        "total_clicks": total_clicks,
        "total_links": total_links,
        "today_clicks": today_clicks,
        "avg_clicks_per_link": round(total_clicks / total_links, 1) if total_links > 0 else 0,
        "platform_breakdown": platform_breakdown,
        "top_content": top_content,
        "daily_trend": daily_trend,
    }
