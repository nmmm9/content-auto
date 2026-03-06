# Design: Supabase Integration

> Plan 문서: `docs/01-plan/features/supabase-integration.plan.md`
> Supabase Project: MGM (`hieolsicwhladrmvbaba`) / ap-northeast-2

## 1. 아키텍처 변경

```
Before (As-Is):
  Frontend → fetch('localhost:8000/api/...') → FastAPI → SQLite

After (To-Be):
  Frontend → @supabase/supabase-js → Supabase (PostgreSQL)
  (FastAPI는 Gemini 분석 등 서버사이드 로직용으로 유지)
```

## 2. 파일 구조

```
frontend/src/
├── lib/
│   └── supabase.ts              ← 신규: Supabase 클라이언트
├── services/
│   └── api.ts                   ← 전면 수정: fetch → supabase 쿼리
├── pages/
│   ├── Calendar.tsx             ← 수정: 더미 데이터 → DB 조회
│   └── Dashboard.tsx            ← 수정: localhost fetch → supabase
├── types/
│   └── index.ts                 ← 수정: DB 스키마 맞게 타입 조정
frontend/
├── .env                         ← 신규: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
└── package.json                 ← 수정: @supabase/supabase-js 추가
```

## 3. Supabase 클라이언트 설정

### 3-1. `frontend/src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 3-2. `frontend/.env`

```env
VITE_SUPABASE_URL=https://hieolsicwhladrmvbaba.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpZW9sc2ljd2hsYWRybXZiYWJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NTk4ODAsImV4cCI6MjA4MjAzNTg4MH0.QdJnHpvqyOsd9dl2v33oZ4cQa1nbbkd8iGedlzif0c4
```

## 4. DB 스키마 ↔ 프론트엔드 타입 매핑

### 4-1. `contents` 테이블

| DB 컬럼 | 타입 | 프론트 타입 | 비고 |
|---------|------|-----------|------|
| id | bigint (PK) | number | auto-increment |
| title | text | string | 필수 |
| description | text | string \| null | |
| tags | jsonb | string[] | 기본값 [] |
| file_path | text | string \| null | |
| file_type | text | string \| null | |
| thumbnail_path | text | string \| null | |
| status | text | ContentStatus | 'draft' \| 'scheduled' \| 'uploading' \| 'completed' \| 'failed' |
| scheduled_at | timestamptz | string \| null | ISO 8601 |
| created_at | timestamptz | string | |
| updated_at | timestamptz | string | |

### 4-2. `platform_connections` 테이블

| DB 컬럼 | 타입 | 프론트 타입 |
|---------|------|-----------|
| id | bigint (PK) | number |
| platform | text (unique) | string |
| is_connected | boolean | boolean |
| account_name | text | string \| null |
| account_id | text | string \| null |
| access_token | text | - | 프론트 노출 안 함 |
| refresh_token | text | - | 프론트 노출 안 함 |

### 4-3. `upload_history` 테이블

| DB 컬럼 | 타입 | 프론트 타입 |
|---------|------|-----------|
| id | bigint (PK) | number |
| content_id | bigint (FK) | number |
| platform | text | string |
| status | text | 'pending' \| 'uploading' \| 'success' \| 'failed' |
| platform_post_id | text | string \| null |
| platform_url | text | string \| null |
| error_message | text | string \| null |
| uploaded_at | timestamptz | string \| null |
| created_at | timestamptz | string | |

### 4-4. `tracking_links` / `click_events`

기존 타입(`AnalyticsSummary` 등) 유지. API 서비스 레이어에서 집계 쿼리 결과를 변환.

## 5. API 서비스 교체 설계 (`api.ts`)

### 5-1. Contents CRUD

```typescript
// Before
const response = await fetch('http://localhost:8000/api/contents/')

// After
const { data, error } = await supabase
  .from('contents')
  .select('*')
  .order('created_at', { ascending: false })
```

| 메서드 | Before (fetch) | After (Supabase) |
|--------|---------------|-----------------|
| getContents | GET /api/contents/ | `.from('contents').select('*')` + 필터 |
| getContent | GET /api/contents/{id} | `.from('contents').select('*').eq('id', id).single()` |
| createContent | POST /api/contents/ (FormData) | `.from('contents').insert({...}).select().single()` |
| updateContent | PATCH /api/contents/{id} | `.from('contents').update({...}).eq('id', id)` |
| deleteContent | DELETE /api/contents/{id} | `.from('contents').delete().eq('id', id)` |

### 5-2. Platforms

| 메서드 | After (Supabase) |
|--------|-----------------|
| getPlatforms | `.from('platform_connections').select('id, platform, is_connected, account_name, account_id')` |
| disconnectPlatform | `.from('platform_connections').update({ is_connected: false }).eq('platform', platform)` |

> `access_token`, `refresh_token` 컬럼은 select에서 제외하여 프론트 노출 방지

### 5-3. Upload History

| 메서드 | After (Supabase) |
|--------|-----------------|
| getUploadHistory | `.from('upload_history').select('*').eq('content_id', contentId)` |

> `startUpload`, `retryUpload`는 FastAPI 유지 (서버사이드 API 호출 필요)

### 5-4. Analytics (트래킹)

| 메서드 | After (Supabase) |
|--------|-----------------|
| getAnalyticsSummary | Supabase 쿼리 조합 (아래 상세) |
| getTrackingLinks | `.from('tracking_links').select('*')` + 필터 |

**Analytics Summary 집계 로직:**

```typescript
// 1. 기간 내 클릭 이벤트 조회
const { data: clicks } = await supabase
  .from('click_events')
  .select('*')
  .gte('clicked_at', sinceDate)

// 2. 전체 트래킹 링크 수
const { count: totalLinks } = await supabase
  .from('tracking_links')
  .select('*', { count: 'exact', head: true })

// 3. 프론트에서 집계 계산
// - total_clicks: clicks.length
// - platform_breakdown: clicks를 platform으로 group by
// - top_content: clicks를 content_id로 group by, contents 조인
// - daily_trend: clicks를 날짜별 group by
// - today_clicks: 오늘 날짜 필터
// - avg_clicks_per_link: total_clicks / totalLinks
```

## 6. Calendar.tsx DB 연동 설계

### 6-1. 현재 (더미 데이터)

```typescript
const [contents, setContents] = useState<CalendarContent[]>([
  { id: 1, title: '...', scheduled_date: '2026-03-03', ... },
  // 하드코딩된 더미 배열
])
```

### 6-2. 변경 후 (Supabase 연동)

```typescript
const [contents, setContents] = useState<CalendarContent[]>([])
const [isLoading, setIsLoading] = useState(true)

useEffect(() => {
  const fetchContents = async () => {
    const { data, error } = await supabase
      .from('contents')
      .select('*')
      .not('scheduled_at', 'is', null)  // 예약일 있는 것만
      .order('scheduled_at', { ascending: true })

    if (data) {
      // DB 스키마 → CalendarContent 타입 변환
      setContents(data.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description || '',
        status: mapStatus(row.status),  // DB status → CalendarContent status 매핑
        scheduled_date: row.scheduled_at?.slice(0, 10) || '',
        platforms: [],  // upload_history에서 별도 조회 or 빈배열
        created_at: row.created_at,
        updated_at: row.updated_at,
      })))
    }
    setIsLoading(false)
  }
  fetchContents()
}, [])
```

### 6-3. Status 매핑

| DB status | Calendar status | 설명 |
|-----------|----------------|------|
| draft | planning | 초안 |
| scheduled | scheduled | 예약됨 |
| uploading | scheduled | 업로드 중 |
| completed | uploaded | 완료 |
| failed | review_needed | 실패 → 확인 필요 |

### 6-4. 플랫폼 정보 조회

캘린더에서 각 콘텐츠의 업로드 플랫폼 표시를 위해:

```typescript
// contents와 upload_history를 조인하여 플랫폼 목록 획득
const { data: uploads } = await supabase
  .from('upload_history')
  .select('content_id, platform')
  .in('content_id', contentIds)

// content_id별 platforms 배열로 변환
```

## 7. Dashboard.tsx DB 연동 설계

### 7-1. 기존 섹션 (Stats, Platforms, Recent Uploads)

```typescript
// Before
const contentsRes = await fetch('http://localhost:8000/api/contents/')
const platformsRes = await fetch('http://localhost:8000/api/platforms/')

// After
const { data: contents } = await supabase
  .from('contents')
  .select('id, title, status, created_at')
  .order('created_at', { ascending: false })

const { data: platforms } = await supabase
  .from('platform_connections')
  .select('id, platform, is_connected, account_name, account_id')
```

### 7-2. 링크 분석 섹션

기존 `api.getAnalyticsSummary()` 호출 → Supabase 직접 쿼리로 교체.
`getSampleAnalytics()` fallback은 데이터 없을 때 유지.

## 8. 환경 변수 관리

| 환경 | 파일 | 비고 |
|------|------|------|
| 로컬 개발 | `frontend/.env` | git에 포함 (anon key는 공개용) |
| Vercel 배포 | Vercel Dashboard → Environment Variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

> Supabase anon key는 RLS 정책으로 보호되는 공개 키이므로 `.env`에 포함해도 무방.
> 단, 추후 service_role key 사용 시에는 반드시 서버사이드에서만 사용.

## 9. 구현 순서

```
1. @supabase/supabase-js 설치
2. frontend/src/lib/supabase.ts 생성
3. frontend/.env 생성
4. frontend/src/types/index.ts 타입 조정
5. frontend/src/services/api.ts → Supabase 쿼리로 교체
6. frontend/src/pages/Dashboard.tsx → Supabase 연동
7. frontend/src/pages/Calendar.tsx → 더미 데이터 제거, DB 연동
8. 빌드 테스트 (사용자 허락 후)
```

## 10. 제약사항 및 참고

- `startUpload`, `retryUpload`는 서버사이드 로직 필요 → FastAPI 유지
- 파일 업로드(FormData)는 Supabase Storage 사용 가능하나 이번 범위 외
- RLS 정책은 Phase 5에서 별도 설정 (현재 비활성)
- 빌드는 반드시 사용자 허락 후 실행
- Vercel 환경변수 등록 필요 (배포 시)
