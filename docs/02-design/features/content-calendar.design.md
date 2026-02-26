# Design: 컨텐츠 캘린더

## 1. 컴포넌트 구조

```
Calendar.tsx (페이지)
├── CalendarHeader        (월 네비게이션 + 필터)
├── CalendarGrid          (월간 그리드)
│   └── CalendarCell      (날짜 셀)
│       └── ContentCard   (콘텐츠 카드)
├── ContentModal          (추가/수정 모달)
└── StatusFilter          (상태 필터 바)
```

## 2. 파일 구조

```
frontend/src/
├── pages/
│   └── Calendar.tsx              ← 신규
├── components/
│   └── calendar/
│       ├── CalendarHeader.tsx     ← 신규
│       ├── CalendarGrid.tsx       ← 신규
│       ├── CalendarCell.tsx       ← 신규
│       ├── ContentCard.tsx        ← 신규
│       └── ContentModal.tsx       ← 신규
├── App.tsx                        ← 수정 (라우트 추가)
└── components/
    └── Layout.tsx                 ← 수정 (네비 추가)
```

## 3. 타입 정의

```typescript
// types/calendar.ts

type ContentStatus =
  | 'planning'        // 기획중 - 회색
  | 'producing'       // 제작중 - 파란색
  | 'review_needed'   // 검수필요 - 주황색
  | 'approved'        // 승인완료 - 초록색
  | 'scheduled'       // 업로드 예정 - 보라색
  | 'uploaded'        // 업로드 완료 - 진한 녹색

interface CalendarContent {
  id: number
  title: string
  description: string
  status: ContentStatus
  scheduled_date: string          // YYYY-MM-DD
  platforms: string[]             // ['youtube', 'instagram', ...]
  youtube_url?: string
  thumbnail?: string
  created_at: string
  updated_at: string
}

interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  contents: CalendarContent[]
}
```

## 4. 상태 색상 맵

```typescript
const STATUS_CONFIG: Record<ContentStatus, {
  label: string
  color: string        // text
  bg: string           // background
  border: string       // border
  dot: string          // 작은 dot 색상
}> = {
  planning:      { label: '기획중',     color: 'text-gray-600',   bg: 'bg-gray-100',    border: 'border-gray-300',  dot: 'bg-gray-400' },
  producing:     { label: '제작중',     color: 'text-blue-600',   bg: 'bg-blue-50',     border: 'border-blue-300',  dot: 'bg-blue-500' },
  review_needed: { label: '검수필요',   color: 'text-amber-600',  bg: 'bg-amber-50',    border: 'border-amber-300', dot: 'bg-amber-500' },
  approved:      { label: '승인완료',   color: 'text-emerald-600',bg: 'bg-emerald-50',  border: 'border-emerald-300',dot: 'bg-emerald-500' },
  scheduled:     { label: '업로드 예정',color: 'text-violet-600', bg: 'bg-violet-50',   border: 'border-violet-300',dot: 'bg-violet-500' },
  uploaded:      { label: '업로드 완료',color: 'text-green-700',  bg: 'bg-green-100',   border: 'border-green-400', dot: 'bg-green-600' },
}
```

## 5. UI 설계

### 5-1. Calendar.tsx (메인 페이지)

```
┌─────────────────────────────────────────────────────────────┐
│  📅 컨텐츠 캘린더                          [+ 새 콘텐츠]     │
├─────────────────────────────────────────────────────────────┤
│  [전체] [기획중] [제작중] [검수필요] [승인완료] [업로드예정]  │
├─────────────────────────────────────────────────────────────┤
│         ◀  2026년 2월  ▶            [오늘]                  │
├────┬────┬────┬────┬────┬────┬────┤
│ 일 │ 월 │ 화 │ 수 │ 목 │ 금 │ 토 │
├────┼────┼────┼────┼────┼────┼────┤
│    │    │    │    │    │    │  1 │
│    │    │    │    │    │    │    │
├────┼────┼────┼────┼────┼────┼────┤
│  2 │  3 │  4 │  5 │  6 │  7 │  8 │
│    │    │ ┌──────┐│    │    │    │
│    │    │ │🟠검수││    │    │    │
│    │    │ │영상A ││    │    │    │
│    │    │ └──────┘│    │    │    │
├────┼────┼────┼────┼────┼────┼────┤
│  9 │ 10 │ 11 │ 12 │ 13 │ 14 │ 15 │
│    │┌──────┐│    │    │┌──────┐│  │
│    ││🔵제작││    │    ││🟣예정││  │
│    ││영상B ││    │    ││영상C ││  │
│    │└──────┘│    │    │└──────┘│  │
└────┴────┴────┴────┴────┴────┴────┘
```

### 5-2. ContentCard (캘린더 셀 내 카드)

```
┌─────────────────────────┐
│ 🟠 영상 제목 줄임...     │
│ 📺 🖼 📘               │  ← 플랫폼 아이콘 (작게)
└─────────────────────────┘
```

- 높이: 고정 (최대 2줄)
- 한 날짜에 3개 이상이면 "+N개 더보기" 표시

### 5-3. ContentModal (추가/수정)

```
┌──────────────────────────────────────┐
│  새 콘텐츠 추가              [X]     │
├──────────────────────────────────────┤
│                                      │
│  제목 ─────────────────────────      │
│  [                            ]      │
│                                      │
│  설명 ─────────────────────────      │
│  [                            ]      │
│  [                            ]      │
│                                      │
│  예정일 ───────────────────────      │
│  [ 2026-02-26              📅 ]      │
│                                      │
│  상태 ─────────────────────────      │
│  [ 기획중              ▼     ]       │
│                                      │
│  대상 플랫폼 ──────────────────      │
│  [✅YouTube Shorts] [✅네이버]       │
│  [✅Facebook]      [✅Instagram]     │
│  [✅Insta Reels]   [✅Threads]       │
│                                      │
│  YouTube URL (선택) ───────────      │
│  [                            ]      │
│                                      │
│         [취소]     [저장]            │
└──────────────────────────────────────┘
```

## 6. 데이터 관리

### 프론트엔드 상태 (MVP - 로컬 상태)

```typescript
// Calendar.tsx 내부 상태
const [currentDate, setCurrentDate] = useState(new Date())         // 현재 보고있는 월
const [contents, setContents] = useState<CalendarContent[]>([])    // 콘텐츠 목록
const [selectedFilter, setSelectedFilter] = useState<ContentStatus | 'all'>('all')
const [modalOpen, setModalOpen] = useState(false)
const [selectedDate, setSelectedDate] = useState<string | null>(null)
const [editingContent, setEditingContent] = useState<CalendarContent | null>(null)
```

### 샘플 데이터 (데모용)

```typescript
const SAMPLE_CONTENTS: CalendarContent[] = [
  {
    id: 1,
    title: '제품 리뷰 영상',
    description: '새로운 제품 언박싱 & 리뷰',
    status: 'review_needed',
    scheduled_date: '2026-02-26',
    platforms: ['youtube_shorts', 'instagram', 'naver_blog'],
    created_at: '2026-02-20T10:00:00Z',
    updated_at: '2026-02-25T15:00:00Z',
  },
  {
    id: 2,
    title: '브이로그 #15',
    description: '일상 브이로그',
    status: 'producing',
    scheduled_date: '2026-03-01',
    platforms: ['youtube_shorts', 'instagram_reels', 'threads'],
    created_at: '2026-02-22T09:00:00Z',
    updated_at: '2026-02-22T09:00:00Z',
  },
  {
    id: 3,
    title: '튜토리얼: 편집 팁',
    description: '영상 편집 초보자를 위한 팁',
    status: 'scheduled',
    scheduled_date: '2026-02-28',
    platforms: ['youtube_shorts', 'naver_blog', 'facebook'],
    created_at: '2026-02-18T14:00:00Z',
    updated_at: '2026-02-26T10:00:00Z',
  },
  {
    id: 4,
    title: '주간 하이라이트',
    description: '이번 주 베스트 모먼트',
    status: 'uploaded',
    scheduled_date: '2026-02-24',
    platforms: ['youtube_shorts', 'instagram_reels'],
    created_at: '2026-02-20T08:00:00Z',
    updated_at: '2026-02-24T18:00:00Z',
  },
  {
    id: 5,
    title: 'Q&A 라이브 정리',
    description: '라이브 방송 하이라이트 정리',
    status: 'planning',
    scheduled_date: '2026-03-05',
    platforms: ['naver_blog', 'threads'],
    created_at: '2026-02-26T11:00:00Z',
    updated_at: '2026-02-26T11:00:00Z',
  },
  {
    id: 6,
    title: '협찬 콘텐츠 A',
    description: '브랜드 협업 콘텐츠',
    status: 'approved',
    scheduled_date: '2026-03-03',
    platforms: ['youtube_shorts', 'instagram', 'facebook', 'naver_blog'],
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-02-25T16:00:00Z',
  },
]
```

## 7. 캘린더 로직

### 월 생성 알고리즘

```typescript
function generateCalendarDays(year: number, month: number, contents: CalendarContent[]): CalendarDay[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay()  // 일요일 = 0
  const days: CalendarDay[] = []
  const today = new Date()

  // 이전 달 빈칸
  for (let i = startOffset - 1; i >= 0; i--) {
    const date = new Date(year, month, -i)
    days.push({ date, isCurrentMonth: false, isToday: false, contents: [] })
  }

  // 현재 달
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d)
    const dateStr = formatDate(date)  // YYYY-MM-DD
    days.push({
      date,
      isCurrentMonth: true,
      isToday: isSameDay(date, today),
      contents: contents.filter(c => c.scheduled_date === dateStr),
    })
  }

  // 다음 달 빈칸 (6주 맞추기)
  while (days.length < 42) {
    const date = new Date(year, month + 1, days.length - startOffset - lastDay.getDate() + 1)
    days.push({ date, isCurrentMonth: false, isToday: false, contents: [] })
  }

  return days
}
```

## 8. 수정 대상 기존 파일

### Layout.tsx - 사이드바에 캘린더 메뉴 추가

```typescript
// 변경: navItems 배열에 캘린더 추가
const navItems = [
  { path: '/', icon: LayoutDashboard, label: '대시보드' },
  { path: '/calendar', icon: CalendarDays, label: '캘린더' },   // ← 추가
  { path: '/upload', icon: Upload, label: '업로드' },
  { path: '/workflow', icon: Workflow, label: '워크플로우' },
  { path: '/templates', icon: FileText, label: '템플릿' },
  { path: '/settings', icon: Settings, label: '설정' },
]
```

### App.tsx - 라우트 추가

```typescript
// 변경: Calendar 라우트 추가
<Route path="calendar" element={<Calendar />} />
```

## 9. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | Calendar.tsx 페이지 기본 틀 + 캘린더 그리드 | Calendar.tsx |
| 2 | CalendarHeader (월 이동, 오늘 버튼) | CalendarHeader.tsx |
| 3 | CalendarCell + ContentCard (상태 색상) | CalendarCell.tsx, ContentCard.tsx |
| 4 | 샘플 데이터 + 필터 기능 | Calendar.tsx |
| 5 | ContentModal (추가/수정) | ContentModal.tsx |
| 6 | Layout.tsx, App.tsx 수정 (라우트, 네비) | Layout.tsx, App.tsx |
