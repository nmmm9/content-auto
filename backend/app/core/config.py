from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # App
    APP_NAME: str = "Auto Upload System"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite:///./auto_upload.db"

    # File Upload
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE: int = 500 * 1024 * 1024  # 500MB

    # YouTube
    YOUTUBE_CLIENT_ID: Optional[str] = None
    YOUTUBE_CLIENT_SECRET: Optional[str] = None

    # Naver
    NAVER_CLIENT_ID: Optional[str] = None
    NAVER_CLIENT_SECRET: Optional[str] = None

    # Facebook/Instagram/Threads
    META_APP_ID: Optional[str] = None
    META_APP_SECRET: Optional[str] = None

    # OpenAI (deprecated - Gemini로 교체)
    OPENAI_API_KEY: Optional[str] = None

    # Gemini
    GEMINI_API_KEY: Optional[str] = None

    # Video Processing
    TEMP_DOWNLOAD_DIR: str = "./uploads/temp"
    MAX_VIDEO_DURATION: int = 600  # 10분 (초)
    MAX_VIDEO_SIZE: int = 200 * 1024 * 1024  # 200MB

    class Config:
        env_file = ".env"

settings = Settings()

# Create directories if not exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.TEMP_DOWNLOAD_DIR, exist_ok=True)
