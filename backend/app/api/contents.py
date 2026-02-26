from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
import aiofiles

from app.core.database import get_db
from app.core.config import settings
from app.models.content import Content
from app.schemas.content import ContentCreate, ContentUpdate, ContentResponse

router = APIRouter()

@router.get("/", response_model=List[ContentResponse])
def get_contents(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Content)
    if status:
        query = query.filter(Content.status == status)
    contents = query.order_by(Content.created_at.desc()).offset(skip).limit(limit).all()
    return contents

@router.get("/{content_id}", response_model=ContentResponse)
def get_content(content_id: int, db: Session = Depends(get_db)):
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    return content

@router.post("/", response_model=ContentResponse)
async def create_content(
    title: str = Form(...),
    description: str = Form(None),
    tags: str = Form(""),
    file: UploadFile = File(...),
    thumbnail: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    # Determine file type
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext in [".mp4", ".avi", ".mov", ".mkv", ".webm"]:
        file_type = "video"
    elif file_ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
        file_type = "image"
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    # Save file
    file_id = str(uuid.uuid4())
    file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}{file_ext}")

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    # Save thumbnail if provided
    thumbnail_path = None
    if thumbnail:
        thumb_ext = os.path.splitext(thumbnail.filename)[1].lower()
        thumbnail_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}_thumb{thumb_ext}")
        async with aiofiles.open(thumbnail_path, "wb") as f:
            thumb_content = await thumbnail.read()
            await f.write(thumb_content)

    # Parse tags
    tags_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

    # Create content record
    db_content = Content(
        title=title,
        description=description,
        tags=tags_list,
        file_path=file_path,
        file_type=file_type,
        thumbnail_path=thumbnail_path,
        status="draft"
    )
    db.add(db_content)
    db.commit()
    db.refresh(db_content)

    return db_content

@router.patch("/{content_id}", response_model=ContentResponse)
def update_content(
    content_id: int,
    content_update: ContentUpdate,
    db: Session = Depends(get_db)
):
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    update_data = content_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(content, key, value)

    db.commit()
    db.refresh(content)
    return content

@router.delete("/{content_id}")
def delete_content(content_id: int, db: Session = Depends(get_db)):
    content = db.query(Content).filter(Content.id == content_id).first()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Delete files
    if content.file_path and os.path.exists(content.file_path):
        os.remove(content.file_path)
    if content.thumbnail_path and os.path.exists(content.thumbnail_path):
        os.remove(content.thumbnail_path)

    db.delete(content)
    db.commit()
    return {"message": "Content deleted"}
