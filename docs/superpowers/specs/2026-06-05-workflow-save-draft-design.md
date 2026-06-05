# Workflow 변환 결과 저장 (draft) — 설계 스펙

- **날짜:** 2026-06-05
- **상태:** 승인됨 (구현 대기)
- **브랜치:** `feature/workflow-save-draft`
- **범위:** Workflow의 분석·변환 결과를 Supabase `contents`에 draft로 영구 저장.

---

## 1. 배경

직전 작업으로 백엔드 데이터 계층이 Supabase로 통일됐다(`docs/superpowers/specs/2026-06-05-supabase-db-migration-design.md`). 그러나 전체 분석에서 드러난 핵심 공백 중 하나는 **Workflow가 변환 결과를 저장하지 않는다**는 점이다:

- `Workflow.tsx`는 `/api/workflow/analyze` → `/api/workflow/transform`을 호출해 `videoInfo`/`analysisResult`/`transformResults`를 얻지만 **React state에만** 보관한다(`Workflow.tsx:670-689, 721-741`). 새로고침하면 사라진다.
- 프론트는 RLS 때문에 `contents`에 직접 INSERT할 수 없다(insert 정책 없음). 쓰기는 백엔드(service_role)를 거쳐야 한다.
- `contents.metrics`(jsonb)는 이미 Calendar가 **플랫폼별 숫자 분석**용으로 사용한다(`Calendar.tsx:227,252`). 따라서 생성 콘텐츠 저장에 재사용하면 안 된다 — 별도 컬럼이 필요하다.

이 스펙은 "변환 결과를 잃지 않고 draft로 저장"하는 최소 기능만 다룬다. 실제 업로드·예약·인증은 별도 후속 작업이다.

---

## 2. 목표 / 비목표

### 목표
1. Workflow 화면에 명시적 **'저장'** 버튼을 추가한다.
2. 저장 시 현재 `video_info` + `analysis` + 변환 결과를 백엔드(service_role)를 통해 `contents`에 **status='draft'** 행으로 INSERT한다.
3. 저장된 draft가 Dashboard(`api.getContents()`)에 노출된다.

### 비목표 (이번에 하지 않음)
- 실제 플랫폼 업로드 / OAuth 연동
- 캘린더 예약(`scheduled_at` 설정)·`status='completed'` 전환
- draft 재열기/편집 UI
- 인증(로그인)
- 저장 멱등성(중복 방지) — 두 번 누르면 draft 2개가 생기며, MVP에서는 허용한다.

---

## 3. 데이터 흐름

```
[Workflow.tsx]  videoInfo + analysisResult + transformResults (React state)
      │  '저장' 버튼 클릭
      ▼
POST /api/workflow/save   body: {video_info, analysis, results}
      │  백엔드: service_role 로 contents INSERT (RLS 우회)
      ▼
[Supabase] contents 새 행 (status='draft', workflow_data=스냅샷)
      │
      ▼
[Dashboard]  api.getContents() 로 노출
```

---

## 4. 상세 설계

### 4.1 DB 마이그레이션 (1건)
`contents`에 jsonb 컬럼 하나 추가. 워크플로우 스냅샷 전체(video_info + analysis + 성공 플랫폼 결과)를 담는다.
```sql
alter table public.contents add column if not exists workflow_data jsonb;
```
`metrics` 컬럼은 건드리지 않는다. `mcp__supabase__apply_migration`으로 적용.

### 4.2 백엔드 — `POST /api/workflow/save`
`backend/app/api/workflow.py`에 추가. supabase-py + `get_supabase`(service_role) 사용.

**요청 본문 (Pydantic 모델 `SaveRequest`):**
```
video_info: dict
analysis: dict
results: dict   # {platform_key: {status, data?, error?}}  (Workflow.tsx의 transformResults 형태)
```

**처리:**
1. `results`에서 `status == "success"`인 항목만 추려 `{platform: data}` 형태의 `generated`를 만든다.
2. `contents`에 INSERT (파생 flat 컬럼 + 스냅샷 jsonb):

| contents 컬럼 | 값 | 비고 |
|---|---|---|
| `title` | `video_info.get("title") or "제목 없음"` | 빈 값 폴백 |
| `description` | `analysis.get("summary", "")` | |
| `tags` | `analysis.get("keywords", [])` | 배열(jsonb) |
| `thumbnail_path` | `video_info.get("thumbnail_url")` | nullable |
| `status` | `"draft"` | 고정 |
| `workflow_data` | `{"video_info": video_info, "analysis": analysis, "generated": generated}` | 스냅샷 |

3. 응답: `{"content_id": <id>, "status": "draft"}`.

**에러 처리:**
- 본문 필수 필드 누락 → FastAPI 422 (Pydantic 검증).
- INSERT 실패(빈 `data`) → HTTP 500 `"Failed to save content"`.

### 4.3 프론트엔드 — Workflow.tsx '저장' 버튼
- 변환이 끝나 승인 단계(`currentPhase === 'approval'`)에 진입하면 노출되는 **'저장'** 버튼을 헤더 영역에 추가한다.
- 클릭 핸들러 `handleSave`:
  - 가드: `videoInfo`, `analysisResult`, `transformResults`가 있어야 함(없으면 버튼 비활성).
  - `POST ${API_BASE}/workflow/save`, body `{video_info: videoInfo, analysis: analysisResult, results: transformResults}`.
  - 성공: 저장 완료 표시(예: `alert` 또는 인라인 메시지 + content_id). 저장 상태 플래그로 버튼 라벨을 '저장됨'으로.
  - 실패: 에러 메시지 표시, 버튼 재시도 가능 상태 유지.

---

## 5. 테스트

### 백엔드 (중점, TDD)
`backend/tests/test_workflow_save.py` — FakeSupabase + client 픽스처 사용:
1. 정상 저장: `results`에 성공 1 + 실패 1을 주면, `contents`에 1행 생성되고 `status='draft'`, `title`/`tags`/`description`/`thumbnail_path`가 매핑되며 `workflow_data.generated`에는 **성공 플랫폼만** 들어간다. 응답에 `content_id`.
2. 필수 본문 누락(`analysis` 빠짐) → 422.

> FakeSupabase의 insert는 `id`를 자동 부여하므로 `content_id` 반환 검증 가능.

### 프론트엔드
테스트 인프라가 없으므로 라이브 수동 검증으로 대체(6절).

---

## 6. 검증 (라이브 스모크)
1. 백엔드 기동 + 프론트 `npm run dev`.
2. Workflow에서 유튜브 URL로 분석→변환 실행 → '저장' 클릭.
3. Supabase `contents`에 새 행(status='draft', workflow_data 채워짐) 생성 확인(`mcp__supabase__execute_sql`).
4. Dashboard 새로고침 → 저장된 draft가 목록에 보이는지 확인.
5. 검증 후 테스트로 만든 draft 행 정리(삭제).

---

## 7. 결정 사항 (사용자 승인 완료)
1. 저장 트리거 = **명시적 '저장' 버튼** (자동 저장 아님).
2. 저장 상태 = **draft** (캘린더 예약은 별도 후속).
3. 저장 위치 = `contents`에 **`workflow_data` jsonb 컬럼 1개** 추가, 스냅샷 전체 보관 + flat 컬럼은 표시용 파생.

---

## 8. 리스크 / 알려진 이슈
- **비멱등:** '저장'을 두 번 누르면 draft가 2개 생긴다. MVP 허용. 추후 "이미 저장됨" 가드 또는 update-on-resave로 개선 가능.
- **결과 형태 가정:** `results`는 `{platform_key: {status, data}}` 형태라고 가정한다(현재 `transformResults`와 일치). 형태가 바뀌면 매핑도 갱신해야 한다.
- **프론트 변경 포함:** 이 기능은 `Workflow.tsx`를 수정한다(저장 버튼·핸들러). 직전 마이그레이션의 "프론트 불변"과 달리 불가피하다.

---

## 9. 범위 밖 / 후속 작업
- 실제 플랫폼 업로드 + OAuth (#2)
- 캘린더 예약(scheduled_at) + status='completed' 전환
- draft 재열기/편집, 중복 저장 방지
- 인증
