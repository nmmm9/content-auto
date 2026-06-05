# content 테이블 → `content` 스키마 분리 — 설계 스펙

- **날짜:** 2026-06-05
- **상태:** 승인됨 (구현 대기)
- **브랜치:** `feature/content-schema-separation`
- **범위:** content 프로젝트의 DB 객체를 `public` → 새 `content` 스키마로 이동. 정리(네임스페이스) 목적.

---

## 1. 배경

이 Supabase 프로젝트(`hieolsicwhladrmvbaba`)는 인테리어 플랫폼과 **공유**되며, content 프로젝트의 테이블이 인테리어 테이블들과 함께 `public` 스키마에 섞여 있다(전체 ~38개 중 content는 5개). 정리를 위해 content 객체를 전용 `content` 스키마로 분리한다.

**중요(범위 한정):** 목적은 **정리/네임스페이스**다. **보안 격리가 아니다** — `service_role` 키는 모든 스키마를 보므로 스키마 분리로 두 앱이 격리되지 않는다(진짜 격리는 별도 프로젝트). RLS 동작도 그대로 보존한다(정책 변경 없음, 단 `public.users` 한정만).

content 앱은 현재 실사용 거의 없는 프로토타입(콘텐츠 4건, 업로드 stub, 로그인 없음)이므로 **전환 중 다운타임 허용**(사용자 확인). 무중단 뷰-shim은 쓰지 않는다.

---

## 2. 목표 / 비목표

### 목표
1. content의 5개 테이블 + 트리거 함수 + 트리거 + RLS 정책을 `content` 스키마로 이동.
2. 백엔드/프론트 Supabase 클라이언트가 `content` 스키마를 기본으로 사용.
3. 이동 후에도 모든 엔드포인트/조회가 동일하게 동작(behavior-preserving).

### 비목표
- 보안 격리 / 별도 Supabase 프로젝트
- 인테리어(public) 테이블 이동
- RLS 정책의 **의미 변경**(현재 동작 그대로 보존; `users`→`public.users` 한정만)
- 무중단 전환(뷰 shim)

---

## 3. 옮기는 대상
- **테이블 5:** `contents`, `platform_connections`, `upload_history`, `tracking_links`, `click_events` (소유 시퀀스는 자동 동반, FK는 양끝이 함께 이동하므로 유지)
- **함수:** `increment_tracking_link_click_count`
- **트리거:** `trg_click_events_increment` (click_events에 부착 → 테이블과 함께 이동)
- **RLS 정책:** 각 테이블의 정책들(테이블과 함께 이동). 단 `users` 참조 정책 2개는 재정의.

---

## 4. 상세 설계

### 4.1 DB 마이그레이션 (MCP `apply_migration`, 단일 트랜잭션)

```sql
create schema if not exists content;

-- 1) 테이블 이동 (FK 유지)
alter table public.contents              set schema content;
alter table public.platform_connections  set schema content;
alter table public.upload_history        set schema content;
alter table public.tracking_links        set schema content;
alter table public.click_events          set schema content;

-- 2) 트리거 함수 재정의 (본문이 tracking_links 를 참조하므로 content 로 교정)
--    기존 트리거는 click_events 와 함께 content 로 이동했으나 public 함수(OID)를 가리킴 → 재구성
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

-- 3) RLS: users 참조 정책 2개를 public.users 로 한정해 재정의 (의미 동일)
drop policy if exists "platform_connections admin read" on content.platform_connections;
create policy "platform_connections admin read" on content.platform_connections
  for select to authenticated
  using (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role = 'admin'));

drop policy if exists "upload_history admin read" on content.upload_history;
create policy "upload_history admin read" on content.upload_history
  for select to authenticated
  using (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role = 'admin'));

-- 4) 권한 (PostgREST 역할들에 content 스키마 접근 부여; RLS 가 행 단위 게이트는 유지)
grant usage on schema content to anon, authenticated, service_role;
grant all on all tables in schema content to anon, authenticated, service_role;
grant all on all sequences in schema content to anon, authenticated, service_role;
```

> 나머지 정책(`click_events` anon insert / authenticated select, `contents` authenticated select, `tracking_links` anon+authenticated select)은 `users`를 참조하지 않으므로 테이블과 함께 그대로 이동된다. 변경 불필요.

### 4.2 Exposed schemas (PostgREST 노출) — ⚠️ 불확실 관문
클라이언트가 `content` 스키마에 접근하려면 PostgREST 노출 목록에 추가돼야 한다. SQL로 시도:
```sql
alter role authenticator set pgrst.db_schemas = 'public, content, graphql_public';
notify pgrst, 'reload config';
```
적용 후 확인(아래 검증). **SQL이 안 먹거나 되돌려지면 → Supabase 대시보드 Settings → API → Exposed schemas 에 `content` 추가(사용자 1회 조작).** 이 단계에서 한 번 멈출 수 있음.

### 4.3 백엔드 클라이언트 기본 스키마
`backend/app/core/database.py`의 `get_supabase()`를 `content` 스키마 기본으로:
```python
from functools import lru_cache
from supabase import create_client, Client
from supabase.client import ClientOptions
from app.core.config import settings


@lru_cache
def get_supabase() -> Client:
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY,
        options=ClientOptions(schema="content"),
    )
```
4개 라우터의 `.table("contents")` 등은 자동으로 `content.contents`로 향한다(코드 변경 없음). `ClientOptions` import 경로는 구현 시 supabase-py 버전에 맞춰 확정.

### 4.4 프론트 클라이언트 기본 스키마
`frontend/src/lib/supabase.ts`:
```ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'content' },
})
```
content 프론트는 자기 테이블만 `.from(...)` 하므로 한 줄로 끝(인테리어/public 테이블 미접근 — 확인됨). 인증 메서드(`supabase.auth`)는 `db.schema`와 무관하므로 영향 없음.

---

## 5. 테스트 / 검증

### 백엔드 유닛테스트
FakeSupabase는 스키마를 무시하므로 16개 테스트는 그대로 green이지만 **스키마 변경 자체는 검증하지 못한다.** (즉 이 작업의 안전망은 유닛테스트가 아니라 라이브 스모크다.)

### 라이브 스모크 (핵심 검증)
1. 마이그레이션 + exposed schemas 적용 후, content 스키마로 띄운 로컬 백엔드로:
   - `GET /api/platforms/` → 200 + 실데이터(이제 `content.platform_connections`).
   - `/t/{short_code}` → 302 + 클릭 기록/카운트(트리거가 `content.tracking_links` 증분).
   - `POST /api/workflow/save` → `content.contents`에 draft 생성.
   - `PATCH /api/contents/{id}/schedule` → status=scheduled.
   - 각 검증 후 테스트 데이터 정리.
2. `public`에 content 테이블이 더는 없고 `content`에 있는지 SQL로 확인:
   ```sql
   select table_schema, table_name from information_schema.tables
   where table_name in ('contents','platform_connections','upload_history','tracking_links','click_events')
   order by table_name;
   ```
   → 전부 `content` 스키마여야 함.

---

## 6. 롤백
문제 시 즉시 복구 가능:
```sql
alter table content.contents set schema public;  -- ×5
-- 함수/트리거도 public 로 재구성, 클라이언트 옵션 원복
```
+ 백엔드/프론트 클라이언트의 `schema='content'`/`db.schema` 제거. exposed schemas 원복.

---

## 7. 결정 사항 (사용자 승인 완료)
1. 목적 = **정리(네임스페이스)**, 보안 격리 아님.
2. 전환 = **A 직접 이동 + 재배포**, 다운타임 허용(뷰 shim 안 씀).
3. 스키마명 = **`content`**.

---

## 8. 리스크 / 알려진 이슈
- **Exposed schemas(4.2)가 유일한 불확실 단계** — SQL이 안 되면 대시보드 조작 필요(사용자).
- **함수 본문 교정 필수** — `public.tracking_links` → `content.tracking_links` 안 바꾸면 클릭 카운트 트리거가 깨진다.
- **RLS `public.users` 한정 필수** — 안 하면 스키마 이동 후 admin 정책이 `users`를 못 찾을 수 있다.
- **배포 재구성:** 운영(Railway/Vercel)도 새 클라이언트 코드로 재배포해야 동작. content 앱은 실사용 적어 다운타임 허용.
- **유닛테스트 한계:** 스키마 변경은 라이브 스모크로만 검증됨.
- **RLS 동작은 보존:** 현재 anon이 못 읽는 테이블(click_events SELECT=authenticated 등)은 이동 후에도 동일하게 동작(이번 작업이 고치지 않음 — 범위 밖).

---

## 9. 범위 밖 / 후속
- 보안 격리(별도 프로젝트)
- RLS 정책 의미 개선(예: 프론트 anon 읽기 허용 여부)
- 인테리어 테이블 정리
