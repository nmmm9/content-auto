# Supabase DB 통일 마이그레이션 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 백엔드(FastAPI)의 데이터 저장소를 SQLite에서 Supabase로 통일하고, 죽은 코드를 제거한다.

**Architecture:** 백엔드가 `supabase-py` 클라이언트 + `service_role` 키로 Supabase에 접근한다(RLS 우회). SQLAlchemy/SQLite는 완전히 제거. `redirect`·`platforms`·`upload` 라우터는 Supabase로 재작성, `contents`·`tracking`·`templates`는 삭제. 라우터는 `get_supabase` 의존성 주입을 받아 테스트에서 가짜 클라이언트로 대체 가능하게 한다.

**Tech Stack:** Python 3.11, FastAPI, supabase-py(>=2), pytest, FastAPI TestClient, Supabase(Postgres).

**Spec:** `docs/superpowers/specs/2026-06-05-supabase-db-migration-design.md`

**Branch:** `feature/supabase-db-migration` (이미 생성됨)

---

## 파일 구조 (생성/수정/삭제)

**생성:**
- `backend/pytest.ini` — pytest 설정 (pythonpath)
- `backend/tests/conftest.py` — `FakeSupabase` 테스트 더블 + `client` 픽스처
- `backend/tests/test_supabase_provider.py`
- `backend/tests/test_redirect.py`
- `backend/tests/test_platforms.py`
- `backend/tests/test_upload.py`

**수정:**
- `backend/app/core/config.py` — Supabase 설정 추가, DATABASE_URL 제거
- `backend/app/core/database.py` — SQLAlchemy 제거, `get_supabase()` 추가
- `backend/main.py` — `create_all` 제거
- `backend/app/api/__init__.py` — 죽은 라우터 등록 제거
- `backend/app/api/redirect.py` — supabase-py로 재작성
- `backend/app/api/platforms.py` — supabase-py로 재작성
- `backend/app/api/upload.py` — supabase-py로 재작성
- `backend/requirements.txt` — supabase 추가, sqlalchemy/aiofiles/multipart 제거
- `backend/.env.example` — Supabase 항목 추가
- `backend/.env` — Supabase 값 추가 (수동, 시크릿)

**삭제:**
- `backend/app/models/` 전체 (`content.py`, `platform.py`, `tracking_link.py`, `click_event.py`, `upload_history.py`, `template.py`, `__init__.py`)
- `backend/app/api/contents.py`, `backend/app/api/tracking.py`, `backend/app/api/templates.py`
- `backend/app/schemas/content.py`, `backend/app/schemas/template.py`
- `backend/auto_upload.db`

**Supabase:**
- `click_events` INSERT 트리거 → `tracking_links.click_count` 자동 증분

---

## 사전 준비 (Task 1 전에 1회)

`backend/.env`에 아래 두 줄을 추가한다. `SUPABASE_SERVICE_ROLE_KEY`는 Supabase 대시보드 → Project Settings → API → **service_role secret**에서 복사한다 (anon 키 아님, 절대 공개 금지).

```
SUPABASE_URL=https://hieolsicwhladrmvbaba.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role secret 붙여넣기>
```

> 모든 `pytest` 명령은 `backend/` 디렉터리에서 `venv/Scripts/python.exe -m pytest ...` 로 실행한다.

---

### Task 1: 의존성 설치 + Supabase 설정 + 클라이언트 provider

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/core/database.py`
- Create: `backend/pytest.ini`
- Create: `backend/tests/test_supabase_provider.py`

- [ ] **Step 1: supabase-py + pytest 설치**

Run (from `backend/`):
```
venv/Scripts/python.exe -m pip install "supabase>=2.0,<3" pytest
```
Expected: `Successfully installed supabase-... pytest-...`

- [ ] **Step 2: requirements.txt 갱신**

`backend/requirements.txt`에서 `sqlalchemy>=2.0.0` 줄을 삭제하고 아래를 추가한다 (sqlalchemy 제거는 Task 8에서 코드 의존 제거 후 최종 확정되지만, 여기서 supabase를 먼저 추가):
```
supabase>=2.0,<3
```

- [ ] **Step 3: config.py에 Supabase 설정 추가**

`backend/app/core/config.py`의 `Settings` 클래스에서 `DATABASE_URL` 줄(`config.py:11`)을 삭제하고, 그 자리에 추가:
```python
    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
```

- [ ] **Step 4: database.py에 get_supabase provider 추가**

`backend/app/core/database.py` 전체를 아래로 교체한다 (SQLAlchemy 잔재는 Task 8에서 정리하지만, provider를 지금 추가):
```python
from functools import lru_cache
from supabase import create_client, Client
from app.core.config import settings


@lru_cache
def get_supabase() -> Client:
    """Supabase 클라이언트 싱글톤 (service_role 키 — RLS 우회)."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
```

> 주의: 이 교체로 `Base`/`engine`/`get_db`가 사라진다. 아직 이를 import하는 `models/*`, `main.py`, `contents.py`, `tracking.py`, `templates.py`가 남아 있으므로 **이 시점에 앱은 일시적으로 import 에러 상태**가 된다. Task 2~8을 끝까지 진행하면 해소된다. (테스트는 각 라우터를 독립적으로 검증한다.)
>
> 만약 중간 단계에서 앱 전체가 떠야 한다면, 대신 Task 8 시점까지 `database.py`에 기존 SQLAlchemy 코드와 `get_supabase`를 **공존**시켜도 된다. 권장: 공존 방식으로 두고 Task 8에서 한 번에 제거. 그 경우 이 Step에서는 기존 `database.py` 내용 끝에 위 `get_supabase` 블록만 **추가**한다 (기존 코드 유지).

**→ 권장 실행: 기존 `database.py` 내용은 그대로 두고, 파일 끝에 위 `get_supabase` 블록만 추가한다.**

- [ ] **Step 5: pytest.ini 생성**

Create `backend/pytest.ini`:
```ini
[pytest]
pythonpath = .
testpaths = tests
```

- [ ] **Step 6: provider 실패 테스트 작성**

Create `backend/tests/test_supabase_provider.py`:
```python
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
```

- [ ] **Step 7: 테스트 실행 (통과 확인)**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_supabase_provider.py -v`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add backend/requirements.txt backend/app/core/config.py backend/app/core/database.py backend/pytest.ini backend/tests/test_supabase_provider.py
git commit -m "feat(backend): add supabase client provider and config"
```

---

### Task 2: 테스트 인프라 (FakeSupabase 더블 + client 픽스처)

**Files:**
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: conftest.py 작성**

Create `backend/tests/conftest.py`:
```python
import pytest
from fastapi.testclient import TestClient

from main import app
from app.core.database import get_supabase


class FakeResp:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    """supabase-py 빌더 체인 중 라우터가 쓰는 메서드만 흉내내는 인메모리 더블."""

    def __init__(self, store, table):
        self.store = store
        self.table_name = table
        self._filters = []
        self._op = ("select", None)

    def select(self, *args, **kwargs):
        self._op = ("select", None)
        return self

    def insert(self, payload):
        self._op = ("insert", payload)
        return self

    def update(self, payload):
        self._op = ("update", payload)
        return self

    def eq(self, col, val):
        self._filters.append((col, val))
        return self

    def limit(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def range(self, *args, **kwargs):
        return self

    def single(self):
        return self

    def _match(self, row):
        return all(row.get(c) == v for c, v in self._filters)

    def execute(self):
        rows = self.store.setdefault(self.table_name, [])
        op, payload = self._op
        if op == "select":
            return FakeResp([dict(r) for r in rows if self._match(r)])
        if op == "insert":
            items = payload if isinstance(payload, list) else [payload]
            created = []
            for item in items:
                row = dict(item)
                row.setdefault("id", len(rows) + 1)
                rows.append(row)
                created.append(dict(row))
            return FakeResp(created)
        if op == "update":
            updated = []
            for row in rows:
                if self._match(row):
                    row.update(payload)
                    updated.append(dict(row))
            return FakeResp(updated)
        return FakeResp([])


class FakeSupabase:
    def __init__(self):
        self.store = {}

    def table(self, name):
        return FakeQuery(self.store, name)

    def seed(self, table, rows):
        self.store.setdefault(table, []).extend(dict(r) for r in rows)


@pytest.fixture
def fake_sb():
    return FakeSupabase()


@pytest.fixture
def client(fake_sb):
    app.dependency_overrides[get_supabase] = lambda: fake_sb
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
```

- [ ] **Step 2: 임포트 확인**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/ -v`
Expected: 기존 provider 테스트 PASS, conftest import 에러 없음. (아직 라우터 테스트 없음.)

> 만약 `from main import app`에서 `ImportError`(예: `cannot import name 'Base'`)가 나면, Task 1 Step 4의 **권장 실행**(기존 database.py 유지 + get_supabase 추가)을 따랐는지 확인한다.

- [ ] **Step 3: 커밋**

```bash
git add backend/tests/conftest.py
git commit -m "test(backend): add FakeSupabase double and client fixture"
```

---

### Task 3: redirect.py 재작성 (Supabase)

**Files:**
- Modify: `backend/app/api/redirect.py`
- Create: `backend/tests/test_redirect.py`

- [ ] **Step 1: 실패 테스트 작성**

Create `backend/tests/test_redirect.py`:
```python
from app.api.redirect import build_redirect_url


def test_build_redirect_url_merges_utm_into_existing_query():
    url = build_redirect_url(
        "https://site.com/page?ref=x", "youtube", "social", "content_5"
    )
    assert "ref=x" in url
    assert "utm_source=youtube" in url
    assert "utm_medium=social" in url
    assert "utm_campaign=content_5" in url


def test_redirect_unknown_short_code_goes_to_default(client):
    resp = client.get("/t/nope", follow_redirects=False)
    assert resp.status_code == 302
    assert resp.headers["location"] == "https://your-site.com"


def test_redirect_known_code_records_click_and_redirects(client, fake_sb):
    fake_sb.seed("tracking_links", [{
        "id": 1, "content_id": 7, "platform": "youtube",
        "short_code": "abc123", "destination_url": "https://site.com/x",
        "utm_source": "youtube", "utm_medium": "social", "utm_campaign": "content_7",
        "click_count": 0,
    }])

    resp = client.get("/t/abc123", follow_redirects=False)

    assert resp.status_code == 302
    assert "utm_source=youtube" in resp.headers["location"]
    clicks = fake_sb.store.get("click_events", [])
    assert len(clicks) == 1
    assert clicks[0]["tracking_link_id"] == 1
    assert clicks[0]["content_id"] == 7
    assert clicks[0]["platform"] == "youtube"
```

- [ ] **Step 2: 실행하여 실패 확인**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_redirect.py -v`
Expected: FAIL (`ImportError: cannot import name 'build_redirect_url'`)

- [ ] **Step 3: redirect.py 재작성**

Replace entire `backend/app/api/redirect.py`:
```python
from urllib.parse import urlencode, urlparse, urlunparse, parse_qs
from fastapi import APIRouter, Request, Depends
from fastapi.responses import RedirectResponse
from supabase import Client

from app.core.database import get_supabase
from app.core.config import settings

router = APIRouter()


def build_redirect_url(destination_url: str, utm_source: str, utm_medium: str, utm_campaign: str) -> str:
    parsed = urlparse(destination_url)
    params = parse_qs(parsed.query)
    params.update({
        "utm_source": [utm_source],
        "utm_medium": [utm_medium],
        "utm_campaign": [utm_campaign],
    })
    new_query = urlencode(params, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


@router.get("/t/{short_code}")
def redirect_tracking_link(short_code: str, request: Request, sb: Client = Depends(get_supabase)):
    res = sb.table("tracking_links").select("*").eq("short_code", short_code).limit(1).execute()
    if not res.data:
        return RedirectResponse(url=settings.TRACKING_DESTINATION_URL, status_code=302)

    link = res.data[0]

    # 클릭 기록 — tracking_links.click_count 증분은 DB 트리거(Task 6)가 처리
    sb.table("click_events").insert({
        "tracking_link_id": link["id"],
        "content_id": link["content_id"],
        "platform": link["platform"],
        "user_agent": request.headers.get("user-agent", "")[:500],
        "referrer": request.headers.get("referer", "")[:500],
        "ip_address": request.client.host if request.client else None,
    }).execute()

    redirect_url = build_redirect_url(
        link["destination_url"], link["utm_source"], link["utm_medium"], link["utm_campaign"]
    )
    return RedirectResponse(url=redirect_url, status_code=302)
```

- [ ] **Step 4: 실행하여 통과 확인**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_redirect.py -v`
Expected: 3 PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/app/api/redirect.py backend/tests/test_redirect.py
git commit -m "feat(backend): rewrite redirect router on supabase"
```

---

### Task 4: platforms.py 재작성 (Supabase)

**Files:**
- Modify: `backend/app/api/platforms.py`
- Create: `backend/tests/test_platforms.py`

- [ ] **Step 1: 실패 테스트 작성**

Create `backend/tests/test_platforms.py`:
```python
def test_list_platforms_seeds_missing(client, fake_sb):
    resp = client.get("/api/platforms/")
    assert resp.status_code == 200
    # 주입된 Supabase 클라이언트에 6종이 lazy-seed 되어야 함
    # (구버전은 SQLAlchemy get_db를 써서 주입 fake를 무시 → store 비어 RED)
    seeded = {row["platform"] for row in fake_sb.store.get("platform_connections", [])}
    assert {"youtube", "naver_blog", "facebook", "instagram", "linkedin", "living_sequence_lab"} <= seeded
    returned = {row["platform"] for row in resp.json()}
    assert {"youtube", "naver_blog", "facebook", "instagram", "linkedin", "living_sequence_lab"} <= returned


def test_disconnect_unsupported_platform_400(client):
    resp = client.post("/api/platforms/nope/disconnect")
    assert resp.status_code == 400


def test_disconnect_clears_tokens(client, fake_sb):
    fake_sb.seed("platform_connections", [{
        "id": 1, "platform": "youtube", "is_connected": True,
        "access_token": "tok", "refresh_token": "ref",
        "account_name": "me", "account_id": "123",
    }])

    resp = client.post("/api/platforms/youtube/disconnect")

    assert resp.status_code == 200
    row = fake_sb.store["platform_connections"][0]
    assert row["is_connected"] is False
    assert row["access_token"] is None
    assert row["refresh_token"] is None
```

- [ ] **Step 2: 실행하여 실패 확인**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_platforms.py -v`
Expected: FAIL (현재 platforms.py는 SQLAlchemy `get_db`를 쓰므로 의존성 오버라이드가 안 먹혀 에러/500)

- [ ] **Step 3: platforms.py 재작성**

Replace entire `backend/app/api/platforms.py`:
```python
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.core.database import get_supabase

router = APIRouter()

SUPPORTED_PLATFORMS = [
    "youtube", "naver_blog", "facebook", "instagram", "linkedin", "living_sequence_lab",
]

_COLUMNS = "id, platform, is_connected, account_name, account_id"


@router.get("/")
def list_platforms(sb: Client = Depends(get_supabase)):
    res = sb.table("platform_connections").select(_COLUMNS).execute()
    existing = {row["platform"] for row in res.data}
    missing = [p for p in SUPPORTED_PLATFORMS if p not in existing]
    if missing:
        sb.table("platform_connections").insert(
            [{"platform": p, "is_connected": False} for p in missing]
        ).execute()
        res = sb.table("platform_connections").select(_COLUMNS).execute()
    return res.data


@router.post("/{platform}/disconnect")
def disconnect_platform(platform: str, sb: Client = Depends(get_supabase)):
    if platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")
    res = sb.table("platform_connections").update({
        "is_connected": False,
        "access_token": None,
        "refresh_token": None,
        "account_name": None,
        "account_id": None,
    }).eq("platform", platform).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Platform connection not found")
    return res.data[0]
```

- [ ] **Step 4: 실행하여 통과 확인**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_platforms.py -v`
Expected: 3 PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/app/api/platforms.py backend/tests/test_platforms.py
git commit -m "feat(backend): rewrite platforms router on supabase"
```

---

### Task 5: upload.py 재작성 (Supabase, 본문 스키마 수정)

**Files:**
- Modify: `backend/app/api/upload.py`
- Create: `backend/tests/test_upload.py`

- [ ] **Step 1: 실패 테스트 작성**

Create `backend/tests/test_upload.py`:
```python
def test_upload_unknown_content_404(client):
    resp = client.post("/api/upload/999", json={"platforms": ["youtube"]})
    assert resp.status_code == 404


def test_upload_creates_history_and_tracking(client, fake_sb):
    fake_sb.seed("contents", [{"id": 5, "title": "t", "status": "draft"}])

    resp = client.post("/api/upload/5", json={"platforms": ["youtube", "facebook"]})

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["results"]) == 2
    assert len(fake_sb.store["upload_history"]) == 2
    assert len(fake_sb.store["tracking_links"]) == 2
    # content 상태가 uploading 으로 갱신
    assert fake_sb.store["contents"][0]["status"] == "uploading"
    # tracking_url 형식
    assert body["results"][0]["tracking_url"].startswith("/t/")


def test_retry_non_failed_400(client, fake_sb):
    fake_sb.seed("upload_history", [{"id": 1, "content_id": 5, "platform": "youtube", "status": "pending"}])
    resp = client.post("/api/upload/retry/1")
    assert resp.status_code == 400


def test_retry_failed_sets_pending(client, fake_sb):
    fake_sb.seed("upload_history", [{"id": 1, "content_id": 5, "platform": "youtube", "status": "failed", "error_message": "boom"}])
    resp = client.post("/api/upload/retry/1")
    assert resp.status_code == 200
    assert fake_sb.store["upload_history"][0]["status"] == "pending"
    assert fake_sb.store["upload_history"][0]["error_message"] is None
```

- [ ] **Step 2: 실행하여 실패 확인**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_upload.py -v`
Expected: FAIL

- [ ] **Step 3: upload.py 재작성**

Replace entire `backend/app/api/upload.py`:
```python
import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.core.database import get_supabase
from app.core.config import settings

router = APIRouter()


class UploadRequest(BaseModel):
    platforms: list[str]


@router.post("/{content_id}")
def upload_content(content_id: int, body: UploadRequest, sb: Client = Depends(get_supabase)):
    content = sb.table("contents").select("id").eq("id", content_id).limit(1).execute()
    if not content.data:
        raise HTTPException(status_code=404, detail="Content not found")

    results = []
    for platform in body.platforms:
        hist = sb.table("upload_history").insert({
            "content_id": content_id,
            "platform": platform,
            "status": "pending",
        }).execute()
        history_id = hist.data[0]["id"]

        short_code = secrets.token_urlsafe(6)
        sb.table("tracking_links").insert({
            "upload_history_id": history_id,
            "content_id": content_id,
            "platform": platform,
            "short_code": short_code,
            "destination_url": settings.TRACKING_DESTINATION_URL,
            "utm_source": platform,
            "utm_medium": "social",
            "utm_campaign": f"content_{content_id}",
        }).execute()

        results.append({
            "platform": platform,
            "history_id": history_id,
            "status": "pending",
            "tracking_url": f"/t/{short_code}",
        })

    sb.table("contents").update({"status": "uploading"}).eq("id", content_id).execute()
    return {"message": "Upload started", "results": results}


@router.get("/history/{content_id}")
def get_upload_history(content_id: int, sb: Client = Depends(get_supabase)):
    res = sb.table("upload_history").select("*").eq("content_id", content_id).order("created_at", desc=True).execute()
    return res.data


@router.post("/retry/{history_id}")
def retry_upload(history_id: int, sb: Client = Depends(get_supabase)):
    res = sb.table("upload_history").select("*").eq("id", history_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="History not found")
    if res.data[0]["status"] != "failed":
        raise HTTPException(status_code=400, detail="Only failed uploads can be retried")
    sb.table("upload_history").update({"status": "pending", "error_message": None}).eq("id", history_id).execute()
    return {"message": "Retry started", "history_id": history_id}
```

- [ ] **Step 4: 실행하여 통과 확인**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_upload.py -v`
Expected: 4 PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/app/api/upload.py backend/tests/test_upload.py
git commit -m "feat(backend): rewrite upload router on supabase, fix request body schema"
```

---

### Task 6: Supabase 트리거 — click_count 자동 증분

**Files:** (코드 변경 없음 — Supabase에 마이그레이션 적용)

- [ ] **Step 1: 트리거 마이그레이션 적용**

`mcp__supabase__apply_migration` 도구를 호출한다:
- `name`: `add_click_count_increment_trigger`
- `query`:
```sql
create or replace function public.increment_tracking_link_click_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tracking_links
     set click_count = click_count + 1
   where id = new.tracking_link_id;
  return new;
end;
$$;

drop trigger if exists trg_click_events_increment on public.click_events;
create trigger trg_click_events_increment
  after insert on public.click_events
  for each row
  execute function public.increment_tracking_link_click_count();
```

- [ ] **Step 2: 트리거 존재 확인**

`mcp__supabase__execute_sql` 호출:
```sql
select tgname, tgenabled
from pg_trigger
where tgname = 'trg_click_events_increment';
```
Expected: 1행 반환 (`tgname = trg_click_events_increment`).

> 행동 검증(클릭 1건 → click_count +1)은 Task 9의 라이브 스모크에서 redirect 엔드포인트로 수행한다(실데이터 클린업 포함).

---

### Task 7: 죽은 코드 삭제 (라우터·모델·스키마)

**Files:**
- Delete: `backend/app/api/contents.py`, `backend/app/api/tracking.py`, `backend/app/api/templates.py`
- Delete: `backend/app/models/` 전체 (7개 파일)
- Delete: `backend/app/schemas/content.py`, `backend/app/schemas/template.py`
- Modify: `backend/app/api/__init__.py`

- [ ] **Step 1: 죽은 라우터·모델·스키마 삭제**

Run (from `backend/`):
```bash
rm app/api/contents.py app/api/tracking.py app/api/templates.py
rm app/models/content.py app/models/platform.py app/models/tracking_link.py app/models/click_event.py app/models/upload_history.py app/models/template.py app/models/__init__.py
rmdir app/models
rm app/schemas/content.py app/schemas/template.py
```

- [ ] **Step 2: __init__.py에서 죽은 라우터 등록 제거**

Replace entire `backend/app/api/__init__.py`:
```python
from fastapi import APIRouter
from app.api import platforms, upload, ai, workflow

router = APIRouter()

router.include_router(platforms.router, prefix="/platforms", tags=["Platforms"])
router.include_router(upload.router, prefix="/upload", tags=["Upload"])
router.include_router(ai.router, prefix="/ai", tags=["AI Transform"])
router.include_router(workflow.router, prefix="/workflow", tags=["Workflow"])
```

- [ ] **Step 3: 전체 테스트 실행 (회귀 확인)**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/ -v`
Expected: 모든 테스트 PASS (provider 1 + redirect 3 + platforms 3 + upload 4 = 11).

> `schemas/__init__.py`가 `content`/`template`을 import하면 에러가 난다. 그 경우 `backend/app/schemas/__init__.py`를 열어 해당 import 줄을 제거한다(없으면 무시).

- [ ] **Step 4: 커밋**

```bash
git add -A backend/app
git commit -m "refactor(backend): delete dead contents/tracking/templates routers, models, schemas"
```

---

### Task 8: SQLAlchemy/SQLite 완전 제거

**Files:**
- Modify: `backend/app/core/database.py`
- Modify: `backend/main.py`
- Modify: `backend/requirements.txt`
- Modify: `backend/.env.example`
- Delete: `backend/auto_upload.db`

- [ ] **Step 1: database.py에서 SQLAlchemy 제거**

Replace entire `backend/app/core/database.py` with ONLY the provider:
```python
from functools import lru_cache
from supabase import create_client, Client
from app.core.config import settings


@lru_cache
def get_supabase() -> Client:
    """Supabase 클라이언트 싱글톤 (service_role 키 — RLS 우회)."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
```

- [ ] **Step 2: main.py에서 create_all/엔진 import 제거**

`backend/main.py`에서 아래 두 줄(`main.py:6`, `main.py:9` 부근)을 삭제:
```python
from app.core.database import engine, Base
```
```python
Base.metadata.create_all(bind=engine)
```
(나머지 `main.py`는 그대로 — `from app.api import router`, CORS, 라우터 등록 등은 유지.)

- [ ] **Step 3: requirements.txt에서 미사용 의존성 제거**

`backend/requirements.txt`에서 아래 줄을 삭제:
```
sqlalchemy>=2.0.0
python-multipart>=0.0.9
aiofiles>=24.0.0
```
(이들은 삭제된 `contents.py`에서만 사용됐다.)

- [ ] **Step 4: .env.example 갱신**

`backend/.env.example`에서 `DATABASE_URL=...` 줄을 삭제하고 추가:
```
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_secret
```

- [ ] **Step 5: SQLite 파일 삭제**

Run (from `backend/`):
```bash
rm -f auto_upload.db
```

- [ ] **Step 6: 앱 import + 전체 테스트 확인**

Run (from `backend/`):
```
venv/Scripts/python.exe -c "import main; print('app import OK')"
venv/Scripts/python.exe -m pytest tests/ -v
```
Expected: `app import OK` + 11 PASS, `auto_upload.db`가 재생성되지 않음.

- [ ] **Step 7: 커밋**

```bash
git add -A backend
git commit -m "refactor(backend): remove sqlalchemy/sqlite, finalize supabase-only data layer"
```

---

### Task 9: 라이브 스모크 검증 (수동, 실 Supabase)

> 실 `service_role` 키와 네트워크가 필요하다. 자동 테스트(Task 1~8)가 모두 green인 상태에서 수행한다.

- [ ] **Step 1: 백엔드 기동**

Run (from `backend/`):
```
venv/Scripts/python.exe -m uvicorn main:app --port 8000
```
Expected: SQLAlchemy/SQLite 에러 없이 기동, `auto_upload.db` 생성 안 됨.

- [ ] **Step 2: platforms 엔드포인트 확인**

다른 터미널에서:
```
curl http://localhost:8000/api/platforms/
```
Expected: Supabase `platform_connections` 데이터(JSON 배열) 반환. Dashboard와 동일 데이터.

- [ ] **Step 3: redirect + 트리거 행동 검증 (클린업 포함)**

기존 `tracking_links` 행 하나의 `short_code`와 현재 `click_count`를 확인한다 (`mcp__supabase__execute_sql`):
```sql
select id, short_code, click_count from tracking_links order by id limit 1;
```
그 `short_code`로 리다이렉트 호출:
```
curl -i "http://localhost:8000/t/<short_code>"
```
Expected: 302 + `Location`에 `utm_*` 포함.

증가 확인 + 클린업 (`mcp__supabase__execute_sql`, `<id>`/`<short_code>`는 위 값):
```sql
-- 증가 확인
select click_count from tracking_links where id = <id>;
-- 방금 만든 테스트 클릭 제거 + 카운트 원복
delete from click_events
 where id = (select max(id) from click_events where tracking_link_id = <id>);
update tracking_links set click_count = click_count - 1 where id = <id>;
```
Expected: 삭제 전 `click_count`가 이전보다 1 큼.

- [ ] **Step 4: 최종 커밋 (변경 있을 시)**

스모크 중 수정이 있었다면 커밋. 없으면 생략.

---

## Self-Review 체크 (계획 작성자 수행 완료)

- **Spec 커버리지:** config/database/main/models/라우터(재작성·삭제)/__init__/requirements/.env.example/트리거/SQLite삭제 — 스펙 4·5·6·8절 모두 태스크로 매핑됨. ✅
- **리스크 반영:** upload 본문 스키마(`UploadRequest`)로 수정(Task 5), short_code는 기존 방식 유지(충돌 재시도는 후속 — 확률 극저), supabase 버전 핀 `>=2,<3`(Task 1). ✅
- **타입 일관성:** `get_supabase`(database.py) ↔ 모든 라우터 `Depends(get_supabase)`, `FakeSupabase`/`fake_sb`/`client` 픽스처 일관. ✅
- **플레이스홀더:** 없음 (모든 코드 블록 완전). ✅
