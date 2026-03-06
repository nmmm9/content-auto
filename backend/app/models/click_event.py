from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class ClickEvent(Base):
    __tablename__ = "click_events"

    id = Column(Integer, primary_key=True, index=True)
    tracking_link_id = Column(Integer, ForeignKey("tracking_links.id"), nullable=False, index=True)

    content_id = Column(Integer, nullable=False, index=True)
    platform = Column(String(50), nullable=False, index=True)

    user_agent = Column(String(500))
    referrer = Column(String(500))
    ip_address = Column(String(45))

    clicked_at = Column(DateTime, server_default=func.now(), index=True)
