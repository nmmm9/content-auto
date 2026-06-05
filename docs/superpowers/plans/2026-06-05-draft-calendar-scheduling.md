# draft 캘린더 예약 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard에서 draft를 날짜 지정해 예약(`status='scheduled'`)하고 Calendar에 노출한다.

**Architecture:** 백엔드에 예약 전용 `PATCH /api/contents/{id}/schedule`(service_role)를 추가한다. Calendar 조회를 `scheduled` 포함으로 넓히고 플랫폼 배지를 `workflow_data.generated`에서 파생한다. Dashboard에 draft 예약 섹션과 `api.scheduleContent` 헬퍼를 추가한다.

**Tech Stack:** FastAPI + supabase-py, React + TypeScript + Vite, Supabase, pytest + FakeSupabase.

**Spec:** `docs/superpowers/specs/2026-06-05-draft-calendar-scheduling-design.md`
**Branch:** `feature/draft-calendar-scheduling` (이미 생성됨)

> pytest는 `backend/`에서 `venv/Scripts/python.exe -m pytest ...`. 프론트 빌드는 `frontend/`에서 `npm run build`. 테스트 인프라(`conftest.py`)는 이미 존재.

---

## 파일 구조
- **생성:** `backend/app/api/contents.py` — 예약 엔드포인트 1개
- **수정:** `backend/app/api/__init__.py` — contents 라우터 등록
- **생성:** `backend/tests/test_schedule.py`
- **수정:** `frontend/src/pages/Calendar.tsx` — 조회 필터 + 플랫폼 파생
- **수정:** `frontend/src/services/api.ts` — `scheduleContent` 헬퍼
- **수정:** `frontend/src/pages/Dashboard.tsx` — draft 예약 섹션

---

### Task 1: 백엔드 예약 엔드포인트

**Files:**
- Create: `backend/app/api/contents.py`
- Modify: `backend/app/api/__init__.py`
- Create: `backend/tests/test_schedule.py`

- [ ] **Step 1: 실패 테스트 작성**

Create `backend/tests/test_schedule.py`:
```python
def test_schedule_sets_date_and_status(client, fake_sb):
    fake_sb.seed("contents", [{"id": 3, "title": "d", "status": "draft", "scheduled_at": None}])

    resp = client.patch("/api/contents/3/schedule", json={"scheduled_at": "2026-06-10"})

    assert resp.status_code == 200
    row = fake_sb.store["contents"][0]
    assert row["status"] == "scheduled"
    assert row["scheduled_at"] == "2026-06-10"
    out = resp.json()
    assert out["id"] == 3
    assert out["status"] == "scheduled"


def test_schedule_unknown_content_returns_404(client):
    resp = client.patch("/api/contents/999/schedule", json={"scheduled_at": "2026-06-10"})
    assert resp.status_code == 404
```

- [ ] **Step 2: 실행하여 실패 확인**

Run (from `backend/`): `venv/Scripts/python.exe -m pytest tests/test_schedule.py -v`
Expected: FAIL (라우트 없음 → 404 for both; 첫 테스트는 200을 기대하므로 실패).

- [ ] **Step 3: contents.py 라우터 생성**

Create `backend/app/api/contents.py`:
```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.core.database import get_supabase

router = APIRouter()


class ScheduleRequest(BaseModel):
    scheduled_at: str


@router.patch("/{content_id}/schedule")
def schedule_content(content_id: int, body: ScheduleRequest, sb: Client = Depends(get_supabase)):
    res = sb.table("contents").update({
        "scheduled_at": body.scheduled_at,
        "status": "scheduled",
    }).eq("id", content_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Content not found")
    return res.data[0]
```

- [ ] **Step 4: __init__.py에 라우터 등록**

Replace ENTIRE `backend/app/api/__init__.py` with:
```python
from fastapi import APIRouter
from app.api import contents, platforms, upload, ai, workflow

router = APIRouter()

router.include_router(contents.router, prefix="/contents", tags=["Contents"])
router.include_router(platforms.router, prefix="/platforms", tags=["Platforms"])
router.include_router(upload.router, prefix="/upload", tags=["Upload"])
router.include_router(ai.router, prefix="/ai", tags=["AI Transform"])
router.include_router(workflow.router, prefix="/workflow", tags=["Workflow"])
```

- [ ] **Step 5: 통과 확인 + 전체 회귀**

Run (from `backend/`):
```
venv/Scripts/python.exe -m pytest tests/test_schedule.py -v
venv/Scripts/python.exe -m pytest tests/ -q
```
Expected: 2 PASS (schedule), 그리고 전체 16 passed (14 기존 + 2 신규).

- [ ] **Step 6: 커밋**

```bash
git add backend/app/api/contents.py backend/app/api/__init__.py backend/tests/test_schedule.py
git commit -m "feat(backend): add PATCH /contents/{id}/schedule endpoint"
```

---

### Task 2: Calendar 조회 + 플랫폼 파생

**Files:**
- Modify: `frontend/src/pages/Calendar.tsx`

> 프론트 테스트 없음 → `npm run build`로 타입체크. 정확한 위치는 코드 landmark로 찾는다.

- [ ] **Step 1: 조회 필터 확대**

`Calendar.tsx`에서 콘텐츠 조회 부분의 `.eq('status', 'completed')`(현재 ~198행)를 찾아 다음으로 교체:
```tsx
          .in('status', ['scheduled', 'completed'])
```

- [ ] **Step 2: 플랫폼 파생 (upload_history 없으면 workflow_data.generated 사용)**

콘텐츠를 펼치는 `dbContents.forEach(row => { ... })` 루프(현재 ~226행) 안에서, 다음 줄을 찾는다:
```tsx
          const platforms = platformMap[row.id] || []
```
이것을 아래로 교체한다(`const`→`let` + 폴백):
```tsx
          let platforms = platformMap[row.id] || []
          if (platforms.length === 0) {
            const generated = (row.workflow_data as { generated?: Record<string, unknown> } | null | undefined)?.generated
            if (generated) platforms = Object.keys(generated)
          }
```
(나머지 분기 로직 — `platforms.length === 0` 시 no-platform 카드, else 플랫폼별 카드 — 는 그대로 둔다. 예약 draft는 generated 키가 채워지면 플랫폼별 카드로, generated가 없으면 no-platform 카드로 렌더된다.)

- [ ] **Step 3: 빌드 확인**

Run (from `frontend/`): `npm run build`
Expected: 타입 에러 없이 빌드 성공.

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/pages/Calendar.tsx
git commit -m "feat(frontend): show scheduled contents on calendar, derive platforms from workflow_data"
```

---

### Task 3: api.ts 헬퍼 + Dashboard 예약 섹션

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: api.ts에 scheduleContent 헬퍼 추가**

`frontend/src/services/api.ts`의 `export const api = {` 객체 안(다른 메서드들과 같은 레벨, 예: `getContents` 근처)에 추가:
```ts
  scheduleContent: async (id: number, scheduledAt: string) => {
    const response = await fetch(`${API_BASE}/contents/${id}/schedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: scheduledAt }),
    })
    if (!response.ok) throw new Error(`Schedule failed: ${response.status}`)
    return response.json()
  },
```
(`API_BASE`는 `api.ts:4`에 이미 정의돼 있다.)

- [ ] **Step 2: Dashboard에 drafts 상태 + 선택 날짜 상태 추가**

`Dashboard.tsx`의 상태 선언부(`const [recentContents, ...]`가 있는 곳)에 두 상태를 추가:
```tsx
  const [drafts, setDrafts] = useState<Content[]>([])
  const [scheduleDates, setScheduleDates] = useState<Record<number, string>>({})
```
(`Content` 인터페이스는 `Dashboard.tsx`에 이미 정의됨: `{ id, title, status, created_at }`. `useState`도 이미 import됨.)

- [ ] **Step 3: fetchData에서 drafts 채우기**

`fetchData` 함수 안에서 `setRecentContents(contents.slice(0, 5))` 줄 바로 다음에 추가:
```tsx
      setDrafts(contents.filter((c: Content) => c.status === 'draft'))
```

- [ ] **Step 4: handleSchedule 핸들러 추가**

`Dashboard` 컴포넌트 내부(다른 핸들러/`fetchData` 부근)에 추가:
```tsx
  const handleSchedule = async (id: number) => {
    const date = scheduleDates[id]
    if (!date) return
    try {
      await api.scheduleContent(id, date)
      setDrafts((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      console.error('Schedule failed:', err)
      alert('예약에 실패했습니다.')
    }
  }
```

- [ ] **Step 5: 예약 섹션 JSX 추가**

최근 콘텐츠 섹션(`recentContents.map`이 있는 카드) 근처, 그 위나 아래의 같은 컨테이너 레벨에 삽입:
```tsx
          {drafts.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <h2 className="text-sm font-bold text-slate-700 mb-3">예약 대기 드래프트</h2>
              <div className="space-y-2">
                {drafts.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50">
                    <span className="flex-1 truncate text-sm text-slate-700">{d.title}</span>
                    <input
                      type="date"
                      value={scheduleDates[d.id] || ''}
                      onChange={(e) => setScheduleDates((prev) => ({ ...prev, [d.id]: e.target.value }))}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1"
                    />
                    <button
                      onClick={() => handleSchedule(d.id)}
                      disabled={!scheduleDates[d.id]}
                      className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-lg px-3 py-1"
                    >
                      예약
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
```

- [ ] **Step 6: 빌드 확인**

Run (from `frontend/`): `npm run build`
Expected: 타입 에러 없이 빌드 성공.

- [ ] **Step 7: 커밋**

```bash
git add frontend/src/services/api.ts frontend/src/pages/Dashboard.tsx
git commit -m "feat(frontend): add draft scheduling section to dashboard"
```

---

### Task 4: 라이브 스모크 검증 (수동, 실 Supabase)

> 실 `service_role` 키(이미 `backend/.env`)와 네트워크 필요.

- [ ] **Step 1: 테스트용 draft 시드**

`mcp__supabase__execute_sql`:
```sql
insert into public.contents (title, status, tags, workflow_data)
values ('SCHED SMOKE', 'draft', '["a"]'::jsonb,
        '{"generated": {"youtube_shorts": {"title": "t"}}}'::jsonb)
returning id;
```
반환된 `id`를 기록한다 (아래 `<ID>`).

- [ ] **Step 2: 백엔드 기동 + 예약 호출**

```
# backend/
venv/Scripts/python.exe -m uvicorn main:app --port 8000
# 다른 터미널
curl -s -X PATCH http://localhost:8000/api/contents/<ID>/schedule \
  -H "Content-Type: application/json" -d '{"scheduled_at":"2026-06-15"}' -w "\n[HTTP %{http_code}]\n"
```
Expected: 200 + 갱신된 행(JSON).

- [ ] **Step 3: Supabase 확인**

`mcp__supabase__execute_sql`:
```sql
select id, status, scheduled_at from public.contents where id = <ID>;
```
Expected: status='scheduled', scheduled_at = 2026-06-15(타임스탬프).

- [ ] **Step 4: (선택) Calendar UI 확인**

`frontend/`에서 `npm run dev` → Calendar에서 2026년 6월 15일에 'SCHED SMOKE' 카드가 보이는지 확인(플랫폼 배지 youtube_shorts).

- [ ] **Step 5: 정리**

`mcp__supabase__execute_sql`:
```sql
delete from public.contents where title = 'SCHED SMOKE';
```

---

## Self-Review 체크 (작성자 수행 완료)

- **Spec 커버리지:** 백엔드 엔드포인트+등록(4.1→Task1), Calendar 조회+플랫폼 파생(4.2→Task2), api 헬퍼+Dashboard 섹션(4.3/4.4→Task3), 검증(6→Task4) 모두 매핑. ✅
- **타입 일관성:** `ScheduleRequest.scheduled_at`(str) ↔ 프론트 `scheduleContent(id, scheduledAt)` body `scheduled_at` 일치. `Content` 타입 재사용. `drafts`/`scheduleDates`/`handleSchedule` 일관. ✅
- **플레이스홀더:** 없음(모든 코드 완전). ✅
- **FakeSupabase 적합성:** `.update().eq().execute()`는 매칭 행 갱신 후 반환 → 404 분기(빈 data) 검증 가능. ✅
