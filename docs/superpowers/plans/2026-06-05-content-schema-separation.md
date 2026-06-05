# content 스키마 분리 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).
>
> **주의:** 이 작업은 DB 마이그레이션 + 클라이언트 설정 변경이다. 백엔드 유닛테스트(FakeSupabase)는 스키마를 무시하므로 **스키마 변경의 안전망은 Task 4 라이브 스모크**다.

**Goal:** content의 5개 테이블 + 트리거함수 + RLS를 `content` 스키마로 옮기고, 백엔드/프론트 Supabase 클라이언트를 `content` 기본 스키마로 전환한다.

**Architecture:** SQL 마이그레이션으로 객체 이동 + 함수 본문 교정 + RLS `public.users` 한정 + grant. PostgREST에 `content` 노출. 두 클라이언트의 기본 스키마를 `content`로. 동작 보존.

**Tech Stack:** Supabase Postgres, supabase-py, supabase-js.

**Spec:** `docs/superpowers/specs/2026-06-05-content-schema-separation-design.md`
**Branch:** `feature/content-schema-separation` (이미 생성됨)

---

## 파일 구조
- **Supabase:** 마이그레이션 2건(객체 이동 / exposed schemas)
- **수정:** `backend/app/core/database.py` — 클라이언트 `schema="content"`
- **수정:** `frontend/src/lib/supabase.ts` — `db: { schema: 'content' }`

---

### Task 1: DB 마이그레이션 — 객체를 content 스키마로 이동 (컨트롤러/MCP)

- [ ] **Step 1: 이동 전 상태 스냅샷**

`mcp__supabase__execute_sql`:
```sql
select table_schema, table_name from information_schema.tables
where table_name in ('contents','platform_connections','upload_history','tracking_links','click_events')
order by table_name;
```
Expected: 전부 `public` (이동 전 기준).

- [ ] **Step 2: 이동 마이그레이션 적용**

`mcp__supabase__apply_migration` name `move_content_to_content_schema`, query:
```sql
create schema if not exists content;

alter table public.contents              set schema content;
alter table public.platform_connections  set schema content;
alter table public.upload_history        set schema content;
alter table public.tracking_links        set schema content;
alter table public.click_events          set schema content;

drop trigger if exists trg_click_events_increment on content.click_events;
drop function if exists public.increment_tracking_link_click_count();

create or replace function content.increment_tracking_link_click_count()
returns trigger
language plpgsql
security definer
set search_path = content
as $$
begin
  update content.tracking_links
     set click_count = click_count + 1
   where id = new.tracking_link_id;
  return new;
end;
$$;

create trigger trg_click_events_increment
  after insert on content.click_events
  for each row
  execute function content.increment_tracking_link_click_count();

drop policy if exists "platform_connections admin read" on content.platform_connections;
create policy "platform_connections admin read" on content.platform_connections
  for select to authenticated
  using (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role = 'admin'));

drop policy if exists "upload_history admin read" on content.upload_history;
create policy "upload_history admin read" on content.upload_history
  for select to authenticated
  using (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role = 'admin'));

grant usage on schema content to anon, authenticated, service_role;
grant all on all tables in schema content to anon, authenticated, service_role;
grant all on all sequences in schema content to anon, authenticated, service_role;
```

- [ ] **Step 3: 이동 확인**

`mcp__supabase__execute_sql` (Step 1과 동일 쿼리). Expected: 5개 모두 `content` 스키마.

추가로 트리거 확인:
```sql
select tgname, tgrelid::regclass as tbl from pg_trigger where tgname = 'trg_click_events_increment';
```
Expected: `tbl = content.click_events`.

---

### Task 2: Exposed schemas — PostgREST에 content 노출 (컨트롤러/MCP, ⚠️ 멈춤 가능)

- [ ] **Step 1: SQL로 노출 시도**

`mcp__supabase__execute_sql`:
```sql
alter role authenticator set pgrst.db_schemas = 'public, content, graphql_public';
notify pgrst, 'reload config';
```

- [ ] **Step 2: 노출 설정 확인**

`mcp__supabase__execute_sql`:
```sql
select rolname, rolconfig from pg_roles where rolname = 'authenticator';
```
Expected: `rolconfig`에 `pgrst.db_schemas=public, content, graphql_public` 포함.

> **만약 위 설정이 적용되지 않거나 라이브 스모크(Task 4)에서 content 스키마 접근이 여전히 실패하면**: 사용자에게 요청 — Supabase 대시보드 → **Settings → API → Exposed schemas** 에 `content` 추가 후 저장. **여기서 멈추고 사용자 조작을 기다린다.**

---

### Task 3: 클라이언트 기본 스키마 전환 (코드)

**Files:**
- Modify: `backend/app/core/database.py`
- Modify: `frontend/src/lib/supabase.ts`

- [ ] **Step 1: 백엔드 database.py 수정**

Replace ENTIRE `backend/app/core/database.py` with:
```python
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
```
> `ClientOptions` import 경로 확인: supabase-py 2.x는 `from supabase.client import ClientOptions`. 만약 ImportError면 `from supabase.lib.client_options import ClientOptions`로 시도. 둘 다 안 되면 `venv/Scripts/python.exe -c "import supabase, inspect; print([n for n in dir(supabase)])"`로 위치를 찾아 보고.

- [ ] **Step 2: 백엔드 import + 유닛테스트 확인**

Run (from `backend/`):
```
venv/Scripts/python.exe -c "from app.core.database import get_supabase; print('import OK')"
venv/Scripts/python.exe -m pytest tests/ -q
```
Expected: `import OK` (ClientOptions 경로 정상) + 16 passed (FakeSupabase override라 스키마 무관하게 green).

- [ ] **Step 3: 프론트 supabase.ts 수정**

Replace ENTIRE `frontend/src/lib/supabase.ts` with:
```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'content' },
})
```

- [ ] **Step 4: 프론트 빌드 확인**

Run (from `frontend/`): `npm run build`
Expected: 타입 에러 없이 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add backend/app/core/database.py frontend/src/lib/supabase.ts
git commit -m "feat: default supabase clients to content schema"
```

---

### Task 4: 라이브 스모크 검증 (컨트롤러, 핵심 검증)

> 실 service_role 키(이미 `backend/.env`) 필요. Task 1·2·3 완료 후.

- [ ] **Step 1: 백엔드 기동**

Run (from `backend/`): `venv/Scripts/python.exe -m uvicorn main:app --port 8000`

- [ ] **Step 2: platforms 읽기 (content 스키마)**

```
curl -s http://localhost:8000/api/platforms/ -w "\n[HTTP %{http_code}]\n"
```
Expected: 200 + 실데이터(이제 `content.platform_connections`). 500이면 → exposed schemas 미적용 가능성 → Task 2의 대시보드 폴백.

- [ ] **Step 3: save → schedule → redirect 체인 검증 + 트리거**

(a) 저장:
```
curl -s -X POST http://localhost:8000/api/workflow/save -H "Content-Type: application/json" \
  -d '{"video_info":{"title":"SCHEMA SMOKE"},"analysis":{"summary":"s","keywords":["a"]},"results":{"youtube_shorts":{"status":"success","data":{"title":"t"}}}}' \
  -w "\n[HTTP %{http_code}]\n"
```
Expected: `{"content_id":<n>,"status":"draft"}`. `<n>` 기록.

(b) 예약:
```
curl -s -X PATCH http://localhost:8000/api/contents/<n>/schedule -H "Content-Type: application/json" -d '{"scheduled_at":"2026-06-20"}' -w "\n[HTTP %{http_code}]\n"
```
Expected: 200 + status='scheduled'.

(c) Supabase에서 content 스키마에 생겼는지 확인 (`mcp__supabase__execute_sql`):
```sql
select id, title, status, scheduled_at from content.contents where title = 'SCHEMA SMOKE';
```
Expected: 1행, status='scheduled'.

- [ ] **Step 4: 트리거(클릭 카운트) 검증 — content 스키마**

`mcp__supabase__execute_sql` (기존 tracking_link 사용, net-zero):
```sql
do $$
declare v_link bigint; v_content bigint; v_platform text; v_before int; v_after int; v_click bigint;
begin
  select id, content_id, platform, click_count into v_link, v_content, v_platform, v_before
    from content.tracking_links order by id limit 1;
  insert into content.click_events(tracking_link_id, content_id, platform, user_agent)
    values (v_link, v_content, v_platform, '__schema_test__') returning id into v_click;
  select click_count into v_after from content.tracking_links where id = v_link;
  delete from content.click_events where id = v_click;
  update content.tracking_links set click_count = v_before where id = v_link;
  if v_after is distinct from v_before + 1 then raise exception 'TRIGGER FAILED %->%', v_before, v_after; end if;
end $$;
```
Expected: 에러 없음(트리거가 content 스키마에서 정상 작동, net-zero).

- [ ] **Step 5: 정리 + 서버 종료**

`mcp__supabase__execute_sql`:
```sql
delete from content.contents where title = 'SCHEMA SMOKE';
```
그리고 uvicorn 백그라운드 종료.

---

## Self-Review 체크 (작성자 수행 완료)
- **Spec 커버리지:** 객체 이동+함수+RLS+grant(4.1→Task1), exposed schemas(4.2→Task2), 백엔드/프론트 클라이언트(4.3/4.4→Task3), 라이브 검증(5→Task4) 모두 매핑. ✅
- **함수 본문 교정:** Task1 Step2에서 `content.tracking_links`로 재정의 — 트리거 깨짐 방지. ✅
- **RLS public.users 한정:** Task1 Step2에 포함. ✅
- **불확실 단계 명시:** Task2에 대시보드 폴백 + 멈춤 지점 명시. ✅
- **검증 현실성:** 유닛테스트가 스키마를 검증 못 한다는 점 명시 + 라이브 스모크가 실제 안전망(Task4). ✅
