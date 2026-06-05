# draft 캘린더 예약 — 설계 스펙

- **날짜:** 2026-06-05
- **상태:** 승인됨 (구현 대기)
- **브랜치:** `feature/draft-calendar-scheduling`
- **범위:** 저장된 draft를 날짜 지정해 예약(status='scheduled')하고 Calendar에 노출.

---

## 1. 배경

직전 작업으로 Workflow 변환 결과를 `contents`에 draft로 저장할 수 있게 됐다(`docs/superpowers/specs/2026-06-05-workflow-save-draft-design.md`). 다음 공백은 **저장한 draft를 예약해 캘린더에 띄우는 것**이다.

현재 Calendar(`frontend/src/pages/Calendar.tsx`)의 동작:
- `contents`를 `status='completed'` AND `scheduled_at not null`로만 조회한다(`Calendar.tsx:198-199`). 따라서 draft/scheduled는 보이지 않는다.
- 화면 표시용 `mapDbStatus`는 **이미 `'scheduled'`를 지원**한다(`Calendar.tsx:175`). 즉 'scheduled' 상태만 들어오면 표시 자체는 문제없다.
- 플랫폼 배지는 `upload_history`에서 읽는다(`Calendar.tsx:210-213`). 아직 업로드 안 한 예약 draft는 `upload_history`가 없으므로 배지가 비게 된다.

Dashboard(`frontend/src/pages/Dashboard.tsx`)는 최근 콘텐츠 목록을 이미 렌더링한다(`Dashboard.tsx:259`).

---

## 2. 목표 / 비목표

### 목표
1. Dashboard에 **draft 예약 섹션**을 추가한다(`status==='draft'` 콘텐츠 목록 + 날짜 선택 + '예약' 버튼).
2. 예약 시 백엔드(service_role)가 `contents` 행을 `scheduled_at` 설정 + `status='scheduled'`로 갱신한다.
3. Calendar가 `scheduled` 상태 콘텐츠를 해당 날짜에 노출한다.

### 비목표 (이번에 하지 않음)
- 실제 플랫폼 업로드 / OAuth
- 예약 시각(시:분) 단위, 반복 예약, 드래그앤드롭
- draft 재열기/편집
- 인증

---

## 3. 데이터 흐름

```
[Dashboard]  draft 목록 → 날짜 선택 + '예약' 클릭
     │  PATCH /api/contents/{id}/schedule  body {scheduled_at}
     ▼  백엔드(service_role): contents.scheduled_at 설정 + status='scheduled'
[Supabase] contents 행 갱신
     ▼
[Calendar]  status IN ('scheduled','completed') 조회 → scheduled_at 날짜에 카드 표시
            (플랫폼 배지는 upload_history 없으면 workflow_data.generated 키에서 파생)
```

---

## 4. 상세 설계

### 4.1 백엔드 — 예약 엔드포인트
삭제했던 contents CRUD 전체는 되살리지 않는다. **예약 전용** 엔드포인트 하나만 새 라우터로 추가한다.

- **파일:** `backend/app/api/contents.py` (신규, 엔드포인트 1개)
- **등록:** `backend/app/api/__init__.py`에 `contents` 라우터를 prefix `/contents`로 추가.
- **엔드포인트:** `PATCH /api/contents/{content_id}/schedule`
  - 본문(Pydantic `ScheduleRequest`): `scheduled_at: str` (ISO 날짜, 예 `"2026-06-10"`)
  - 동작: `contents`를 `{"scheduled_at": <값>, "status": "scheduled"}`로 update, `.eq("id", content_id)`.
  - `res.data`가 비면 → HTTP 404 `"Content not found"`. 성공 시 `res.data[0]` 반환.

### 4.2 Calendar 조회 변경 (`frontend/src/pages/Calendar.tsx`)
- 조회 필터 변경: `.eq('status', 'completed')` → `.in('status', ['scheduled', 'completed'])` (`Calendar.tsx:198`).
- 플랫폼 파생: 콘텐츠를 펼치는 로직(`Calendar.tsx:226-258`)에서 `platformMap[row.id]`가 비어 있으면, `row.workflow_data?.generated`의 키 목록을 플랫폼으로 사용한다. (이 경로는 메트릭 없는 카드로 렌더된다 — 기존 "플랫폼 있는" 분기를 타되 메트릭은 없음.)

### 4.3 Dashboard UI (`frontend/src/pages/Dashboard.tsx`)
- 최근 콘텐츠 섹션 부근에 **'예약 대기 드래프트'** 섹션을 추가한다.
- `api.getContents()`로 받은 콘텐츠 중 `status === 'draft'`인 것만 목록으로 보여준다.
- 각 항목: 제목 + `<input type="date">`(상태 보관) + **'예약'** 버튼.
- '예약' 클릭 → `api.scheduleContent(id, scheduledAt)` 호출(아래 4.4).
  - 성공: 콘텐츠 목록 refetch → draft 목록에서 사라지고 status가 scheduled로.
  - 실패: 에러 표시.
- 날짜 미선택 시 '예약' 버튼 비활성.

### 4.4 api.ts 헬퍼 (확정)
`Dashboard.tsx`는 이미 `api`(`services/api.ts`)를 사용하므로, 일관성을 위해 `frontend/src/services/api.ts`에 헬퍼를 추가하고 Dashboard는 이를 호출한다(직접 fetch 아님):
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

---

## 5. 테스트

### 백엔드 (TDD)
`backend/tests/test_schedule.py` — FakeSupabase + client:
1. 정상 예약: 시드한 contents 행에 `PATCH /api/contents/{id}/schedule {scheduled_at}` → 그 행의 `scheduled_at`이 설정되고 `status='scheduled'`로 바뀐다. 200 + 갱신 행 반환.
2. 없는 id → 404.

### 프론트엔드
테스트 인프라 없음 → `npm run build`(타입체크) + 라이브 검증(6절).

---

## 6. 검증 (라이브 스모크)
1. 백엔드 + 프론트 기동.
2. (사전) draft 행 하나 확보 — 직전 기능의 save로 만들거나 SQL로 시드.
3. `PATCH /api/contents/{id}/schedule` 직접 호출(curl) → 200 + status='scheduled', scheduled_at 설정 확인(`mcp__supabase__execute_sql`).
4. Calendar 화면에서 해당 날짜에 카드가 보이는지 확인(플랫폼 배지는 generated 키 기준).
5. 테스트 데이터 정리.

---

## 7. 결정 사항 (사용자 승인 완료)
1. 예약 진입점 = **Dashboard의 draft 목록**.
2. 예약 상태 = **`status='scheduled'`** (프론트 mapDbStatus가 이미 지원).
3. 백엔드는 예약 전용 엔드포인트만 추가(삭제한 CRUD 부활 안 함).

---

## 8. 리스크 / 알려진 이슈
- **플랫폼 키 불일치:** `workflow_data.generated`의 키는 `youtube_shorts` 같은 플랫폼 키라, Calendar의 `PLATFORM_METRICS`(youtube 등)와 정확히 안 맞을 수 있다. 예약 draft는 메트릭이 없으므로 표시에는 문제없으나, 배지 라벨/아이콘 매핑이 누락될 수 있다. MVP 허용.
- **scheduled_at 타입:** Supabase `scheduled_at`은 timestamptz. `"2026-06-10"` 문자열을 보내면 자정 timestamptz로 저장된다. Calendar는 `slice(0,10)`로 날짜만 쓰므로 정합.
- **Dashboard recentContents는 상위 5개:** 예약 섹션은 별도로 `status==='draft'` 전체를 필터링해 보여주므로 상위 5 제한과 무관하다.
- **프론트 변경 포함:** Calendar.tsx + Dashboard.tsx 수정.

---

## 9. 범위 밖 / 후속 작업
- 실제 업로드 + OAuth
- 예약 시각 단위·반복·드래그앤드롭
- draft 편집/삭제 UI
- 인증
