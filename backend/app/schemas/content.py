from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ContentBase(BaseModel):
    title: str
    description: Optional[str] = None
    tags: List[str] = []

class ContentCreate(ContentBase):
    pass

class ContentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None
    scheduled_at: Optional[datetime] = None

class ContentResponse(ContentBase):
    id: int
    file_path: Optional[str] = None
    file_type: Optional[str] = None
    thumbnail_path: Optional[str] = None
    status: str
    scheduled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
