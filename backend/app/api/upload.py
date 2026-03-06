import secrets
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.core.config import settings
from app.models.content import Content
from app.models.upload_history import UploadHistory
from app.models.template import Template
from app.models.tracking_link import TrackingLink

router = APIRouter()

@router.post("/{content_id}")
async def upload_content(
    content_id: int,
    platforms: List[str],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start upload to selected platforms"""
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    results = []
    for platform in platforms:
        # Create upload history entry
        history = UploadHistory(
            content_id=content_id,
            platform=platform,
            status="pending"
        )
        db.add(history)
        db.commit()
        db.refresh(history)

        # TODO: Add background task for actual upload
        # background_tasks.add_task(upload_to_platform, history.id, platform)

        # Auto-generate tracking link
        short_code = secrets.token_urlsafe(6)
        tracking_link = TrackingLink(
            upload_history_id=history.id,
            content_id=content_id,
            platform=platform,
            short_code=short_code,
            destination_url=settings.TRACKING_DESTINATION_URL,
            utm_source=platform,
            utm_medium="social",
            utm_campaign=f"content_{content_id}",
        )
        db.add(tracking_link)
        db.commit()

        results.append({
            "platform": platform,
            "history_id": history.id,
            "status": "pending",
            "tracking_url": f"/t/{short_code}",
        })

    # Update content status
    content.status = "uploading"
    db.commit()

    return {"message": "Upload started", "results": results}

@router.get("/history/{content_id}")
def get_upload_history(content_id: int, db: Session = Depends(get_db)):
    """Get upload history for a content"""
    history = db.query(UploadHistory).filter(
        UploadHistory.content_id == content_id
    ).order_by(UploadHistory.created_at.desc()).all()

    return history

@router.post("/retry/{history_id}")
async def retry_upload(
    history_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Retry failed upload"""
    history = db.query(UploadHistory).filter(
        UploadHistory.id == history_id
    ).first()

    if not history:
        raise HTTPException(status_code=404, detail="Upload history not found")

    if history.status != "failed":
        raise HTTPException(status_code=400, detail="Can only retry failed uploads")

    history.status = "pending"
    history.error_message = None
    db.commit()

    # TODO: Add background task for actual upload
    # background_tasks.add_task(upload_to_platform, history.id, history.platform)

    return {"message": "Retry started", "history_id": history_id}
