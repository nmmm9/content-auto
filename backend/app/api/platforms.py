from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.platform import PlatformConnection
from app.schemas.platform import PlatformConnectionResponse

router = APIRouter()

SUPPORTED_PLATFORMS = ["youtube", "naver_blog", "facebook", "instagram", "linkedin", "living_sequence_lab"]

@router.get("/", response_model=List[PlatformConnectionResponse])
def get_platforms(db: Session = Depends(get_db)):
    # Get all platform connections
    connections = db.query(PlatformConnection).all()
    existing = {c.platform for c in connections}

    # Create entries for missing platforms
    for platform in SUPPORTED_PLATFORMS:
        if platform not in existing:
            new_connection = PlatformConnection(
                platform=platform,
                is_connected=False
            )
            db.add(new_connection)

    db.commit()

    return db.query(PlatformConnection).all()

@router.get("/{platform}", response_model=PlatformConnectionResponse)
def get_platform(platform: str, db: Session = Depends(get_db)):
    if platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(status_code=400, detail="Unsupported platform")

    connection = db.query(PlatformConnection).filter(
        PlatformConnection.platform == platform
    ).first()

    if not connection:
        connection = PlatformConnection(platform=platform, is_connected=False)
        db.add(connection)
        db.commit()
        db.refresh(connection)

    return connection

@router.post("/{platform}/disconnect")
def disconnect_platform(platform: str, db: Session = Depends(get_db)):
    connection = db.query(PlatformConnection).filter(
        PlatformConnection.platform == platform
    ).first()

    if connection:
        connection.is_connected = False
        connection.access_token = None
        connection.refresh_token = None
        connection.account_name = None
        connection.account_id = None
        db.commit()

    return {"message": f"Disconnected from {platform}"}
