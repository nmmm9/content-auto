from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from app.core.database import Base

class Content(Base):
    __tablename__ = "contents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    tags = Column(JSON, default=list)

    # File info
    file_path = Column(String(500))
    file_type = Column(String(50))  # video, image
    thumbnail_path = Column(String(500))

    # Metadata
    status = Column(String(50), default="draft")  # draft, scheduled, uploading, completed, failed
    scheduled_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
