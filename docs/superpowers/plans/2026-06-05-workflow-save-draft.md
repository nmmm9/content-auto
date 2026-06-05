# Workflow 변환 결과 저장 (draft) — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Workflow의 변환 결과(video_info + analysis + 플랫폼별 생성 콘텐츠)를 '저장' 버튼으로 Supabase `contents`에 draft로 저장한다.

**Architecture:** 백엔드에 `POST /api/workflow/save`(service_role, RLS 우회)를 추가해 `contents`에 INSERT한다. `contents`에 `workflow_data jsonb` 컬럼을 추가해 스냅샷을 보존하고, title/description/tags/thumbnail은 flat 컬럼으로 파생한다. 프론트 `Workflow.tsx`에 '저장' 버튼과 상태를 추가한다.

**Tech Stack:** FastAPI + supabase-py(백엔드), React + TypeScript(프론트), Supabase Postgres, pytest + FakeSupabase 더블.

**Spec:** `docs/superpowers/specs/2026-06-05-workflow-save-draft-design.md`
**Branch:** `feature/workflow-save-draft` (이미 생성됨)

> 모든 pytest는 `backend/`에서 `venv/Scripts/python.exe -m pytest ...`로 실행(Windows). 테스트 인프라(`conftest.py`의 `FakeSupabase`/`client`/`fake_sb`, `pytest.ini`)는 직전 작업으로 이미 존재한다.

---

## 파일 구조
- **수정:** `backend/app/api/workflow.py` — `POST /save` 엔드포인트 + `SaveRequest` 모델 추가
- **생성:** `backend/tests/test_workflow_save.py` — 엔드포인트 TDD 테스트
- **수정:** `frontend/src/pages/Workflow.tsx` — 저장 상태 + 결과 상태 + `handleSave` + 저장 버튼
- **Supabase:** `contents.workflow_data jsonb` 컬럼 추가(마이그레이션)

---

### Task 1: Supabase 마이그레이션 — `contents.workflow_data` 컬럼

**Files:** (코드 변경 없음 — Supabase에 DDL 적용)

- [ ] **Step 1: 컬럼 추가 마이그레이션 적용**

`mcp__supabase__apply_migration` 호출:
- `name`: `add_contents_workflow_data`
- `query`:
```sql
alter table public.contents add column if not exists workflow_data jsonb;
```

- [ ] **Step 2: 컬럼 존재 확인**

`mcp__supabase__execute_sql`:
```sql
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='contents' and column_name='workflow_data';
```
Expected: 1행, `data_type = jsonb`.

---

### Task 2: 백엔드 `POST /api/workflow/save` 엔드포인트

**Files:**
- Modify: `backend/app/api/workflow.py`
- Create: `backend/tests/test_workflow_save.py`

- [ ] **Step 1: 실패 테스트 작성**

Create `backend/tests/test_workflow_save.py`:
```python
def test_save_creates_draft_with_success_platforms_only(client, fake_sb):
    body = {
        "video_info": {"title": "My Vid", "thumbnail_url": "http://t/x.jpg", "video_id": "abc"},
        "analysis": {"summary": "A short summary", "keywords": ["k1", "k2"]},
        "results": {
            "youtube_shorts": {"status": "success", "data": {"title": "yt", "hashtags": ["#a"]}},
            "facebook": {"status": "error", "error": "boom"},
        },
    }
    resp = client.post("/api/workflow/save", json=body)
    assert resp.status_code == 200
    out = resp.json()
    assert out["status"] == "draft"
    assert "content_id" in out

    rows = fake_sb.store["contents"]
    assert len(rows) == 1
    row = rows[0]
    assert row["title"] == "My Vid"
    assert row["description"] == "A short summary"
    assert row["tags"] == ["k1", "k2"]
    assert row["thumbnail_path"] == "http://t/x.jpg"
    assert row["status"] == "draft"
    # 성공 플랫폼만 generated 에 저장
    assert set(row["workflow_data"]["generated"].keys()) == {"youtube_shorts"}
    assert row["workflow_data"]["generated"]["youtube_shorts"] == {"title": "yt", "hashtags": ["#a"]}
    assert row["workflow_data"]["video_info"]["video_id"] == "abc"


def test_save_title_fallback_when_missing(client, fake_sb):
    body = {
        "video_info": {},
        "analysis": {"summary": "", "keywords": []},
        "results": {},
    }
    resp = client.post("/api/workflow/save", json=body)
    assert resp.status_code == 200
    assert fake_sb.store["contents"][0]["title"] == "제목 없음"


def test_save_missing_analysis_returns_422(client):
    resp = client.post("/api/workflow/save", json={"video_info": {}, "results": {}})
    assert resp.status_code == 422
```

- [ ] **Step 2: 실행하여 실패 확인**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_workflow_save.py -v`
Expected: FAIL (현재 `/api/workflow/save` 라우트 없음 → 404, 그리고 마지막 테스트는 422가 아닌 404).

- [ ] **Step 3: workflow.py에 save 엔드포인트 추가**

`backend/app/api/workflow.py` 상단 import를 조정한다. 기존:
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import youtube_info, video_analyzer
```
다음으로 교체:
```python
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from supabase import Client

from app.services import youtube_info, video_analyzer
from app.core.database import get_supabase
```

그리고 파일 끝에 아래를 추가한다:
```python
class SaveRequest(BaseModel):
    video_info: dict
    analysis: dict
    results: dict


@router.post("/save")
def save_workflow(body: SaveRequest, sb: Client = Depends(get_supabase)):
    """변환 결과를 contents 에 draft 로 저장한다."""
    generated = {
        platform: payload.get("data")
        for platform, payload in body.results.items()
        if isinstance(payload, dict) and payload.get("status") == "success"
    }

    row = {
        "title": body.video_info.get("title") or "제목 없음",
        "description": body.analysis.get("summary", ""),
        "tags": body.analysis.get("keywords", []),
        "thumbnail_path": body.video_info.get("thumbnail_url"),
        "status": "draft",
        "workflow_data": {
            "video_info": body.video_info,
            "analysis": body.analysis,
            "generated": generated,
        },
    }

    res = sb.table("contents").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save content")
    return {"content_id": res.data[0]["id"], "status": "draft"}
```

- [ ] **Step 4: 실행하여 통과 확인**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_workflow_save.py -v`
Expected: 3 PASS

- [ ] **Step 5: 전체 스위트 회귀 확인**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/ -q`
Expected: 14 passed (기존 11 + 신규 3)

- [ ] **Step 6: 커밋**

```bash
git add backend/app/api/workflow.py backend/tests/test_workflow_save.py
git commit -m "feat(backend): add POST /workflow/save to persist transform results as draft"
```

---

### Task 3: 프론트엔드 — Workflow.tsx 저장 버튼

**Files:**
- Modify: `frontend/src/pages/Workflow.tsx`

> 테스트 인프라가 없어 TDD 대신 라이브 검증(Task 4)으로 확인한다. 정확한 삽입 위치는 파일을 읽어 아래 코드를 배치한다.

- [ ] **Step 1: 변환 결과를 상태로 보존 + 저장 상태 추가**

`transformResults`는 실행 핸들러 내부의 지역 변수(`Workflow.tsx:670`)라 저장 시 접근 불가하다. 상태로 보존한다.

(a) 상태 선언부(`Workflow.tsx:250`의 `const [selectedModel, ...]` 줄 바로 다음)에 추가:
```tsx
  const [lastResults, setLastResults] = useState<Record<string, { status: string; data?: Record<string, unknown>; error?: string }>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
```

(b) 실행 핸들러에서 변환 결과를 받은 직후(`Workflow.tsx:689`의 `transformResults = data.results` 줄 바로 다음 줄)에 추가:
```tsx
      setLastResults(transformResults)
```

- [ ] **Step 2: handleSave 핸들러 추가**

실행 핸들러(`handleRun`/run 핸들러) 정의 부근, 컴포넌트 함수 내부에 추가한다. `API_BASE`는 파일 상단(`Workflow.tsx:64`)에 이미 정의돼 있다.
```tsx
  const handleSave = async () => {
    if (!videoInfo || !analysisResult) return
    setSaveStatus('saving')
    try {
      const res = await fetch(`${API_BASE}/workflow/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_info: videoInfo,
          analysis: analysisResult,
          results: lastResults,
        }),
      })
      if (!res.ok) throw new Error(`Save failed: ${res.status}`)
      await res.json()
      setSaveStatus('saved')
    } catch (err) {
      console.error('Save failed:', err)
      setSaveStatus('error')
    }
  }
```

- [ ] **Step 3: 저장 버튼 추가 (툴바, 승인 단계에서 노출)**

툴바의 리셋 버튼(`Workflow.tsx:852` 부근, `RotateCcw` 아이콘 버튼) 바로 앞에 저장 버튼을 추가한다:
```tsx
          {currentPhase === 'approval' && (
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving' || saveStatus === 'saved' || !videoInfo || !analysisResult}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl shadow-md transition-all bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              {saveStatus === 'saved' ? '저장됨' : saveStatus === 'saving' ? '저장 중…' : saveStatus === 'error' ? '저장 실패 — 재시도' : '저장'}
            </button>
          )}
```
(저장 실패 시 `disabled` 조건상 'error'는 다시 활성화되어 재시도 가능하다.)

- [ ] **Step 4: 리셋 시 저장 상태 초기화**

리셋 버튼(`Workflow.tsx:852` 부근 `RotateCcw` 버튼)의 `onClick` 콜백 안에서 워크플로우를 초기화하는 코드 끝에 추가한다:
```tsx
    setSaveStatus('idle')
    setLastResults({})
```

- [ ] **Step 5: 타입체크 + 빌드 확인**

Run (from `frontend/`): `npm run build`
Expected: 타입 에러 없이 빌드 성공.

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/pages/Workflow.tsx
git commit -m "feat(frontend): add Save button to persist workflow results as draft"
```

---

### Task 4: 라이브 스모크 검증 (수동, 실 Supabase)

> 실 `service_role` 키(이미 `backend/.env`에 있음)와 네트워크 필요. 자동 테스트(Task 2) green 상태에서 수행.

- [ ] **Step 1: 백엔드 + 프론트 기동**

```
# 터미널 A (backend/)
venv/Scripts/python.exe -m uvicorn main:app --port 8000
# 터미널 B (frontend/)
npm run dev
```

- [ ] **Step 2: 저장 엔드포인트 직접 검증 (백엔드만으로)**

```
curl -s -X POST http://localhost:8000/api/workflow/save \
  -H "Content-Type: application/json" \
  -d '{"video_info":{"title":"SMOKE TEST","thumbnail_url":"http://t/x.jpg","video_id":"smoke"},"analysis":{"summary":"s","keywords":["a"]},"results":{"youtube_shorts":{"status":"success","data":{"title":"t"}}}}'
```
Expected: `{"content_id": <n>, "status": "draft"}`.

- [ ] **Step 3: Supabase에서 draft 행 확인**

`mcp__supabase__execute_sql`:
```sql
select id, title, status, tags, workflow_data->'generated' as generated
from public.contents
where title = 'SMOKE TEST'
order by id desc limit 1;
```
Expected: status='draft', generated에 `youtube_shorts` 포함.

- [ ] **Step 4: Dashboard 노출 확인**

브라우저에서 Dashboard 새로고침 → 'SMOKE TEST' 콘텐츠가 목록에 보이는지 확인(`api.getContents()`가 전체 콘텐츠를 읽음).

- [ ] **Step 5: 테스트 데이터 정리**

`mcp__supabase__execute_sql`:
```sql
delete from public.contents where title = 'SMOKE TEST';
```

- [ ] **Step 6: (선택) UI 경로 검증**

실제 유튜브 URL로 Workflow 분석→변환 후 '저장' 버튼 클릭 → '저장됨' 표시 → Supabase에 draft 행 생성 확인 → 해당 행 정리.

---

## Self-Review 체크 (작성자 수행 완료)

- **Spec 커버리지:** 마이그레이션(4.1→Task1), 백엔드 엔드포인트+매핑+에러(4.2→Task2), 프론트 버튼+상태(4.3→Task3), 검증(6→Task4) 모두 매핑됨. ✅
- **타입 일관성:** `SaveRequest{video_info,analysis,results}` ↔ 프론트 body 키 일치, `workflow_data.generated` 키명 일관, `lastResults`/`saveStatus`/`handleSave` 일관. ✅
- **상태 보존 함정 반영:** `transformResults`가 지역변수인 점을 Task3 Step1에서 상태로 승격해 해결. ✅
- **플레이스홀더:** 없음(모든 코드 블록 완전). ✅
