from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class UploadHistory(Base):
    __tablename__ = "upload_history"

    id = Column(Integer, primary_key=True, index=True)
    content_id = Column(Integer, ForeignKey("contents.id"), nullable=False)
    platform = Column(String(50), nullable=False)

    # Upload result
    status = Column(String(50), default="pending")  # pending, uploading, success, failed
    platform_post_id = Column(String(255))  # ID returned by platform
    platform_url = Column(String(500))  # URL of uploaded content

    error_message = Column(Text)

    uploaded_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
