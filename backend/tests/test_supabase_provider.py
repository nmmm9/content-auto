import app.core.database as db
from app.core.config import settings


def test_get_supabase_builds_client_with_settings(monkeypatch):
    captured = {}

    def fake_create_client(url, key):
        captured["url"] = url
        captured["key"] = key
        return object()

    monkeypatch.setattr(db, "create_client", fake_create_client)
    db.get_supabase.cache_clear()
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", "test-key")

    client = db.get_supabase()

    assert client is not None
    assert captured["url"] == "https://example.supabase.co"
    assert captured["key"] == "test-key"
