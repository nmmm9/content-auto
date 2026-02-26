from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class PlatformConnectionResponse(BaseModel):
    id: int
    platform: str
    is_connected: bool
    account_name: Optional[str] = None
    account_id: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    updated_at: datetime

    class Config:
        from_attributes = True
