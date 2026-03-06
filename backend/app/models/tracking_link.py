from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class TrackingLink(Base):
    __tablename__ = "tracking_links"

    id = Column(Integer, primary_key=True, index=True)
    upload_history_id = Column(Integer, ForeignKey("upload_history.id"), nullable=False, unique=True)
    content_id = Column(Integer, ForeignKey("contents.id"), nullable=False)
    platform = Column(String(50), nullable=False)

    short_code = Column(String(12), unique=True, nullable=False, index=True)
    destination_url = Column(String(1000), nullable=False)

    utm_source = Column(String(100), nullable=False)
    utm_medium = Column(String(100), nullable=False)
    utm_campaign = Column(String(255), nullable=False)

    click_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
