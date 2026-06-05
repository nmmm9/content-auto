# Supabase DB 통일 마이그레이션 — 설계 스펙

- **날짜:** 2026-06-05
- **상태:** 승인됨 (구현 대기)
- **브랜치:** `feature/supabase-db-migration`
- **범위:** 백엔드 데이터 저장소를 SQLite → Supabase로 통일. 죽은 코드 제거.

---

## 1. 배경 (현재 상태)

이 프로젝트(`auto`)는 유튜브 URL을 입력하면 Gemini AI가 영상을 분석해 8개 플랫폼용 콘텐츠로 변환하고, 자동 업로드까지 하려는 시스템이다. 전체 분석 결과 데이터 계층이 둘로 갈려 있다:

- **프론트엔드(React)**는 거의 모든 데이터를 **Supabase에 직접** 접근한다 (`frontend/src/services/api.ts`, `Calendar.tsx`).
- **백엔드(FastAPI)**는 **SQLite**(`auto_upload.db`)만 사용하며 Supabase를 전혀 모른다 (`backend/app/core/config.py:11`, 백엔드에 `supabase` 참조 0건).

두 저장소는 동기화되지 않아 서로 따로 논다. 예: 단축링크 리다이렉트(`/t/{short_code}`)는 클릭을 SQLite에 기록하지만(`backend/app/api/redirect.py:31`), 대시보드 분석은 Supabase를 읽는다(`api.ts:125`).

연결된 Supabase 프로젝트는 `hieolsicwhladrmvbaba`이며, 인테리어 플랫폼과 공유하는 프로젝트다(사용자 확인: 의도된 구성). `auto` 관련 테이블 5개가 이미 존재하고 데이터도 들어 있다: `contents`(4), `platform_connections`(7), `upload_history`(28), `tracking_links`(28), `click_events`(126). `templates` 테이블은 **없다**.

### 참고: 이번 범위 밖이지만 분석으로 드러난 사실
- 실제 플랫폼 업로드는 어디에도 구현돼 있지 않다(`backend/app/services/platforms/youtube.py:27-35`는 placeholder, 나머지 플랫폼 업로더는 파일조차 없음).
- 워크플로우의 변환 결과는 저장되지 않고 React state에만 존재한다(`frontend/src/pages/Workflow.tsx:688-741`). "업로드" 버튼은 가짜 진행률 애니메이션이다(`Workflow.tsx:387-414`).
- 프론트엔드에는 인증(로그인)이 없다. anon 키만 사용하며 RLS에 의존한다.

→ 이 스펙은 **DB 통일(토대)만** 다룬다. 저장·실제 업로드·인증은 별도 후속 작업이다.

---

## 2. 목표 / 비목표

### 목표
1. 백엔드가 SQLite 대신 **Supabase**를 단일 데이터 저장소로 사용한다.
2. SQLite·SQLAlchemy·`auto_upload.db`를 완전히 제거한다.
3. 안 쓰는 죽은 백엔드 코드를 삭제한다.
4. 마이그레이션 후 백엔드/프론트가 **같은 데이터**를 본다 (예: Settings 화면과 Dashboard가 동일한 `platform_connections`를 보게 됨).

### 비목표 (이번에 하지 않음)
- 변환 결과를 `contents`에 저장하는 기능 추가
- 실제 플랫폼 업로드/OAuth 연동
- 인증(로그인) 도입
- 프론트엔드 변경 (프론트는 지금처럼 Supabase 직접 사용 유지)
- AI 파이프라인(`ai.py`, `workflow.py`, `services/*`) 변경

---

## 3. 접근 방식

**supabase-py 클라이언트 + `service_role` 키**로 백엔드가 Supabase에 접근한다. `service_role`은 RLS를 우회하므로 서버 작업(리다이렉트 클릭 기록, 업로드 기록 등)이 정책 제약 없이 동작한다. SQLAlchemy ORM은 완전히 제거한다.

대안으로 "SQLAlchemy 연결 문자열만 Supabase Postgres로 교체"하는 방법도 있었으나, 사용자가 supabase-py 방식을 선택했다 (프론트와 동일한 멘탈 모델, HTTPS 기반, DB 직접 접속 비밀번호 불필요).

---

## 4. 상세 변경 — 백엔드

### 4.1 핵심 인프라
| 파일 | 변경 |
|---|---|
| `backend/app/core/config.py` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 추가. `DATABASE_URL` 제거 |
| `backend/app/core/database.py` | SQLAlchemy `engine`/`SessionLocal`/`Base`/`get_db` 제거 → `get_supabase() -> Client` 싱글톤 provider로 교체 |
| `backend/main.py` | `Base.metadata.create_all(bind=engine)` 및 관련 import 제거 (`main.py:6-9`) |
| `backend/app/models/` | **전체 삭제** — `content.py`, `platform.py`, `tracking_link.py`, `click_event.py`, `upload_history.py`, `template.py`, `__init__.py` (supabase-py는 ORM 모델 불필요) |
| `backend/requirements.txt` | `supabase` 추가. `sqlalchemy` 제거. `python-multipart`·`aiofiles` 제거 (오직 `contents.py`에서만 사용 확인됨 → 삭제 후 미사용) |

### 4.2 라우터 — Supabase로 재작성 (유지)
| 파일 | 동작 |
|---|---|
| `backend/app/api/redirect.py` | `tracking_links`를 `short_code`로 조회 → `click_events` INSERT → UTM 병합 후 302. `click_count` 증분은 **DB 트리거**가 처리(아래 5절) |
| `backend/app/api/platforms.py` | `platform_connections` 조회 / disconnect. GET 시 누락된 지원 플랫폼 행 lazy-seed 동작 유지 |
| `backend/app/api/upload.py` | `upload_history`·`tracking_links` INSERT, `contents.status` UPDATE. `short_code = secrets.token_urlsafe(6)` 유지 |

### 4.3 라우터 — 삭제 (죽은 코드)
| 파일 | 이유 |
|---|---|
| `backend/app/api/contents.py` | 프론트가 Supabase 직접 사용 (`createContent` 등 호출처 0) |
| `backend/app/api/tracking.py` | 분석 로직이 프론트에 완전 중복 구현됨 (`api.ts:118-228`) |
| `backend/app/api/templates.py` | 이를 쓰는 `Templates.tsx`가 라우팅 안 된 고아 페이지 + Supabase에 `templates` 테이블 없음 → 판단 ①로 삭제 |

### 4.4 변경 없음
- `backend/app/api/ai.py`, `backend/app/api/workflow.py` — DB 미사용
- `backend/app/services/*` — AI 파이프라인 그대로

### 4.5 라우터 등록 / 스키마
- `backend/app/api/__init__.py` — `contents`, `tracking`, `templates` 라우터 등록 제거 (`__init__.py:6-12`)
- `backend/app/schemas/` — `content.py`, `template.py` 삭제. `platform.py`는 `platforms.py` 응답 모델용으로 유지

---

## 5. 상세 변경 — Supabase

### 5.1 click_count 자동 증분 트리거 (마이그레이션 SQL)
redirect 핸들러의 수동 카운트 증분을 DB 트리거로 대체한다. 이 프로젝트가 이미 쓰는 패턴(`portfolio_views` INSERT 트리거가 `portfolios.view_count` 증분)과 동일하다. 백엔드는 `click_events`만 INSERT하면 카운트가 자동 유지된다.

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

→ `mcp__supabase__apply_migration`로 적용한다.

### 5.2 스키마 정합 (모델 삭제로 자동 해소)
- `platform_connections.created_at`: 모델을 삭제하므로 더 이상 문제되지 않음 (백엔드는 dict로 필요한 컬럼만 다룸).
- `contents.metrics`(Supabase 추가 컬럼): 백엔드는 건드리지 않음 (프론트 전용).

---

## 6. 보안
- `SUPABASE_SERVICE_ROLE_KEY`는 **백엔드 `backend/.env`에만** 저장 (이미 gitignore됨). 절대 프론트엔드나 git에 노출 금지.
- `backend/.env.example`에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 항목 추가(값은 비움).
- `service_role` 키는 공유 Supabase 프로젝트의 모든 테이블(인테리어 앱 포함)에 RLS 우회 접근이 가능하므로, 백엔드 코드는 `auto` 관련 5개 테이블에만 접근하도록 유지한다.

---

## 7. 검증
1. **리다이렉트:** 로컬에서 유효한 `short_code`로 `/t/{code}` 호출 → Supabase `click_events`에 1행 추가 + 해당 `tracking_links.click_count` +1 확인. 없는 코드 → 기본 목적지로 302, 기록 없음.
2. **플랫폼:** `/api/platforms/` GET → Supabase `platform_connections` 반환. Settings 화면과 Dashboard가 동일 데이터를 보는지 확인.
3. **업로드:** `/api/upload/{content_id}` 호출 → Supabase `upload_history`·`tracking_links`에 행 생성 확인.
4. **SQLite 부재:** `auto_upload.db`가 더 이상 생성되지 않고, 백엔드 기동 시 SQLAlchemy 관련 에러가 없는지 확인.

---

## 8. 결정 사항 (사용자 승인 완료)
1. **`templates.py` 라우터 삭제.** Templates.tsx가 고아 페이지이고 Supabase에 테이블도 없으므로 새 테이블을 만들지 않고 삭제한다. (템플릿 기능 부활은 별도 작업.)
2. **`auto_upload.db`(SQLite) 데이터 이전 안 함.** 프론트는 늘 Supabase만 봤으므로 SQLite 데이터는 버려진 테스트 데이터로 간주하고 파일을 삭제한다.

---

## 9. 리스크 / 알려진 이슈
- **`upload.py` 요청 본문 형식 불일치:** 백엔드가 `platforms: List[str]`(raw 배열)을 기대하나 프론트는 `{"platforms":[...]}`를 보낸다(`api.ts:90-96`). 현재 이 엔드포인트는 UI에서 호출되지 않으므로 즉시 문제는 아니나, 재작성 시 본문 스키마를 `{"platforms": [...]}`로 맞춘다.
- **`short_code` 충돌 미검사:** `secrets.token_urlsafe(6)`는 충돌 확률이 극히 낮으나 unique 제약 위반 시 INSERT가 실패한다. 재작성 시 간단한 재시도(예: 충돌 시 1회 재생성)를 추가한다.
- **supabase-py 버전:** `requirements.txt`에 버전 핀(예: `supabase>=2.0`)을 명시한다.

---

## 10. 범위 밖 / 후속 작업 (참고)
- 워크플로우 변환 결과를 `contents`에 저장
- 실제 플랫폼 업로드 + OAuth 연동
- 인증(로그인) 도입
- 고아 페이지(`Upload.tsx`, `Templates.tsx`) 정리 또는 라우팅 복구
