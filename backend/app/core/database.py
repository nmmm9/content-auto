from functools import lru_cache
from supabase import create_client, Client
from supabase.client import ClientOptions
from app.core.config import settings


@lru_cache
def get_supabase() -> Client:
    """Supabase 클라이언트 싱글톤 (service_role, 기본 스키마 content)."""
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY,
        options=ClientOptions(schema="content"),
    )
