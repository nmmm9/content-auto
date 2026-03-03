import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { CalendarDays, CalendarClock, Inbox, Eye, Heart, MessageCircle, Share2, BarChart3, TrendingUp, ArrowUpRight, ArrowDownRight, Minus, Clock, MousePointerClick, Users, Bookmark, UserPlus, Search, Repeat2, Timer } from 'lucide-react'
import CalendarHeader from '../components/calendar/CalendarHeader'
import CalendarGrid from '../components/calendar/CalendarGrid'
import ContentCard from '../components/calendar/ContentCard'

// 타입 export (하위 컴포넌트에서 사용)
export type ContentStatus =
  | 'planning'
  | 'producing'
  | 'review_needed'
  | 'approved'
  | 'scheduled'
  | 'uploaded'

export interface CalendarContent {
  id: number
  title: string
  description: string
  status: ContentStatus
  scheduled_date: string
  platforms: string[]
  youtube_url?: string
  thumbnail?: string
  metrics?: Record<string, number>
  created_at: string
  updated_at: string
}

export interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  contents: CalendarContent[]
}


function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function generateCalendarDays(year: number, month: number, contents: CalendarContent[]): CalendarDay[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay()
  const days: CalendarDay[] = []
  const today = new Date()

  for (let i = startOffset - 1; i >= 0; i--) {
    const date = new Date(year, month, -i)
    days.push({ date, isCurrentMonth: false, isToday: false, contents: [] })
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d)
    const dateStr = formatDate(date)
    days.push({
      date,
      isCurrentMonth: true,
      isToday: isSameDay(date, today),
      contents: contents.filter(c => c.scheduled_date === dateStr),
    })
  }

  while (days.length < 42) {
    const date = new Date(year, month + 1, days.length - startOffset - lastDay.getDate() + 1)
    days.push({ date, isCurrentMonth: false, isToday: false, contents: [] })
  }

  return days
}

function formatSelectedDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`
}

// 플랫폼별 핵심 지표 정의
const PLATFORM_METRICS: Record<string, { key: string; label: string; icon: typeof Eye; color: string; bg: string; gradient: string; format?: 'time' | 'pct' }[]> = {
  youtube: [
    { key: 'views', label: '조회수', icon: Eye, color: 'text-blue-600', bg: 'bg-blue-500/10', gradient: 'from-blue-500 to-cyan-400' },
    { key: 'watch_time', label: '시청 시간', icon: Clock, color: 'text-purple-600', bg: 'bg-purple-500/10', gradient: 'from-purple-500 to-violet-400', format: 'time' },
    { key: 'avg_duration', label: '평균 시청 지속시간', icon: Timer, color: 'text-indigo-600', bg: 'bg-indigo-500/10', gradient: 'from-indigo-500 to-blue-400', format: 'time' },
    { key: 'ctr', label: 'CTR', icon: MousePointerClick, color: 'text-amber-600', bg: 'bg-amber-500/10', gradient: 'from-amber-500 to-yellow-400', format: 'pct' },
    { key: 'impressions', label: '노출수', icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-500/10', gradient: 'from-teal-500 to-emerald-400' },
    { key: 'subscribers', label: '구독자 증감', icon: UserPlus, color: 'text-rose-600', bg: 'bg-rose-500/10', gradient: 'from-rose-500 to-pink-400' },
  ],
  youtube_shorts: [
    { key: 'views', label: '조회수', icon: Eye, color: 'text-blue-600', bg: 'bg-blue-500/10', gradient: 'from-blue-500 to-cyan-400' },
    { key: 'likes', label: '좋아요', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-500/10', gradient: 'from-rose-500 to-pink-400' },
    { key: 'avg_duration', label: '평균 시청시간', icon: Timer, color: 'text-indigo-600', bg: 'bg-indigo-500/10', gradient: 'from-indigo-500 to-blue-400', format: 'time' },
    { key: 'comments', label: '댓글', icon: MessageCircle, color: 'text-amber-600', bg: 'bg-amber-500/10', gradient: 'from-amber-500 to-yellow-400' },
    { key: 'shares', label: '공유', icon: Share2, color: 'text-emerald-600', bg: 'bg-emerald-500/10', gradient: 'from-emerald-500 to-green-400' },
  ],
  naver_blog: [
    { key: 'views', label: '조회수', icon: Eye, color: 'text-blue-600', bg: 'bg-blue-500/10', gradient: 'from-blue-500 to-cyan-400' },
    { key: 'likes', label: '공감', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-500/10', gradient: 'from-rose-500 to-pink-400' },
    { key: 'comments', label: '댓글', icon: MessageCircle, color: 'text-amber-600', bg: 'bg-amber-500/10', gradient: 'from-amber-500 to-yellow-400' },
    { key: 'search_visits', label: '검색 유입', icon: Search, color: 'text-green-600', bg: 'bg-green-500/10', gradient: 'from-green-500 to-emerald-400' },
    { key: 'neighbor_add', label: '이웃 추가', icon: UserPlus, color: 'text-violet-600', bg: 'bg-violet-500/10', gradient: 'from-violet-500 to-purple-400' },
  ],
  instagram: [
    { key: 'reach', label: '도달', icon: Users, color: 'text-blue-600', bg: 'bg-blue-500/10', gradient: 'from-blue-500 to-cyan-400' },
    { key: 'impressions', label: '노출', icon: Eye, color: 'text-purple-600', bg: 'bg-purple-500/10', gradient: 'from-purple-500 to-violet-400' },
    { key: 'likes', label: '좋아요', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-500/10', gradient: 'from-rose-500 to-pink-400' },
    { key: 'saves', label: '저장', icon: Bookmark, color: 'text-amber-600', bg: 'bg-amber-500/10', gradient: 'from-amber-500 to-yellow-400' },
    { key: 'profile_visits', label: '프로필 방문', icon: UserPlus, color: 'text-emerald-600', bg: 'bg-emerald-500/10', gradient: 'from-emerald-500 to-green-400' },
  ],
  instagram_reels: [
    { key: 'plays', label: '재생수', icon: Eye, color: 'text-blue-600', bg: 'bg-blue-500/10', gradient: 'from-blue-500 to-cyan-400' },
    { key: 'reach', label: '도달', icon: Users, color: 'text-purple-600', bg: 'bg-purple-500/10', gradient: 'from-purple-500 to-violet-400' },
    { key: 'likes', label: '좋아요', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-500/10', gradient: 'from-rose-500 to-pink-400' },
    { key: 'saves', label: '저장', icon: Bookmark, color: 'text-amber-600', bg: 'bg-amber-500/10', gradient: 'from-amber-500 to-yellow-400' },
    { key: 'shares', label: '공유', icon: Share2, color: 'text-emerald-600', bg: 'bg-emerald-500/10', gradient: 'from-emerald-500 to-green-400' },
  ],
  facebook: [
    { key: 'reach', label: '도달', icon: Users, color: 'text-blue-600', bg: 'bg-blue-500/10', gradient: 'from-blue-500 to-cyan-400' },
    { key: 'engagement', label: '참여', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-500/10', gradient: 'from-purple-500 to-violet-400' },
    { key: 'likes', label: '좋아요', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-500/10', gradient: 'from-rose-500 to-pink-400' },
    { key: 'shares', label: '공유', icon: Share2, color: 'text-emerald-600', bg: 'bg-emerald-500/10', gradient: 'from-emerald-500 to-green-400' },
    { key: 'comments', label: '댓글', icon: MessageCircle, color: 'text-amber-600', bg: 'bg-amber-500/10', gradient: 'from-amber-500 to-yellow-400' },
  ],
  threads: [
    { key: 'views', label: '조회수', icon: Eye, color: 'text-blue-600', bg: 'bg-blue-500/10', gradient: 'from-blue-500 to-cyan-400' },
    { key: 'likes', label: '좋아요', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-500/10', gradient: 'from-rose-500 to-pink-400' },
    { key: 'replies', label: '답글', icon: MessageCircle, color: 'text-amber-600', bg: 'bg-amber-500/10', gradient: 'from-amber-500 to-yellow-400' },
    { key: 'reposts', label: '리포스트', icon: Repeat2, color: 'text-emerald-600', bg: 'bg-emerald-500/10', gradient: 'from-emerald-500 to-green-400' },
    { key: 'quotes', label: '인용', icon: Share2, color: 'text-violet-600', bg: 'bg-violet-500/10', gradient: 'from-violet-500 to-purple-400' },
  ],
}

function formatMetricValue(value: number, format?: 'time' | 'pct'): string {
  if (format === 'time') {
    if (value >= 3600) return `${(value / 3600).toFixed(1)}시간`
    if (value >= 60) return `${Math.floor(value / 60)}분 ${value % 60}초`
    return `${value}초`
  }
  if (format === 'pct') return `${value}%`
  return formatNumber(value)
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toLocaleString()
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [contents] = useState<CalendarContent[]>([
    {
      id: 1,
      title: '카페 브이로그',
      description: '성수동 신상 카페 3곳 투어 영상',
      status: 'uploaded',
      scheduled_date: '2026-02-27',
      platforms: ['youtube'],
      youtube_url: 'https://youtube.com/watch?v=example1',
      thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      metrics: { views: 12400, watch_time: 18600, avg_duration: 245, ctr: 6.8, impressions: 45200, subscribers: 38 },
      created_at: '2026-02-25T10:00:00Z',
      updated_at: '2026-02-27T09:00:00Z',
    },
    {
      id: 2,
      title: '카페 브이로그 숏츠',
      description: '성수동 카페 하이라이트 60초',
      status: 'uploaded',
      scheduled_date: '2026-02-27',
      platforms: ['youtube_shorts'],
      metrics: { views: 34500, likes: 2100, avg_duration: 42, comments: 312, shares: 890 },
      created_at: '2026-02-25T10:00:00Z',
      updated_at: '2026-02-27T09:30:00Z',
    },
    {
      id: 3,
      title: '성수동 카페 추천 TOP3',
      description: '성수동 신상 카페 블로그 리뷰',
      status: 'uploaded',
      scheduled_date: '2026-02-27',
      platforms: ['naver_blog'],
      metrics: { views: 3200, likes: 180, comments: 42, search_visits: 1840, neighbor_add: 12 },
      created_at: '2026-02-25T11:00:00Z',
      updated_at: '2026-02-27T10:00:00Z',
    },
    {
      id: 4,
      title: '카페 인스타 포스트',
      description: '성수동 카페 감성 사진 포스트',
      status: 'uploaded',
      scheduled_date: '2026-02-27',
      platforms: ['instagram'],
      metrics: { reach: 6200, impressions: 22300, likes: 1240, saves: 320, profile_visits: 89 },
      created_at: '2026-02-25T12:00:00Z',
      updated_at: '2026-02-27T10:30:00Z',
    },
    {
      id: 5,
      title: '카페 릴스',
      description: '성수동 카페 15초 릴스',
      status: 'uploaded',
      scheduled_date: '2026-02-27',
      platforms: ['instagram_reels'],
      metrics: { plays: 21000, reach: 15400, likes: 3400, saves: 890, shares: 510 },
      created_at: '2026-02-25T12:00:00Z',
      updated_at: '2026-02-27T11:00:00Z',
    },
    {
      id: 6,
      title: '카페 페이스북 포스트',
      description: '성수동 카페 투어 후기',
      status: 'uploaded',
      scheduled_date: '2026-02-27',
      platforms: ['facebook'],
      metrics: { reach: 8400, engagement: 1240, likes: 420, shares: 312, comments: 67 },
      created_at: '2026-02-25T13:00:00Z',
      updated_at: '2026-02-27T11:30:00Z',
    },
    {
      id: 7,
      title: '오늘의 카페 일상',
      description: '쓰레드 감성 텍스트 포스트',
      status: 'uploaded',
      scheduled_date: '2026-02-27',
      platforms: ['threads'],
      metrics: { views: 1800, likes: 290, replies: 34, reposts: 45, quotes: 12 },
      created_at: '2026-02-25T14:00:00Z',
      updated_at: '2026-02-27T12:00:00Z',
    },
    {
      id: 8,
      title: '홍대 맛집 투어',
      description: '홍대 숨은 맛집 5곳 리뷰 영상',
      status: 'uploaded',
      scheduled_date: '2026-03-03',
      platforms: ['youtube'],
      youtube_url: 'https://youtube.com/watch?v=example2',
      metrics: { views: 18700, watch_time: 28400, avg_duration: 312, ctr: 8.2, impressions: 52100, subscribers: 67 },
      created_at: '2026-03-01T10:00:00Z',
      updated_at: '2026-03-03T09:00:00Z',
    },
    {
      id: 9,
      title: '홍대 맛집 숏츠',
      description: '홍대 떡볶이 먹방 30초',
      status: 'uploaded',
      scheduled_date: '2026-03-03',
      platforms: ['youtube_shorts'],
      metrics: { views: 52000, likes: 4200, avg_duration: 28, comments: 580, shares: 1200 },
      created_at: '2026-03-01T10:00:00Z',
      updated_at: '2026-03-03T09:30:00Z',
    },
    {
      id: 10,
      title: '홍대 맛집 블로그',
      description: '홍대 맛집 상세 리뷰 포스팅',
      status: 'uploaded',
      scheduled_date: '2026-03-03',
      platforms: ['naver_blog'],
      metrics: { views: 4800, likes: 320, comments: 78, search_visits: 2900, neighbor_add: 24 },
      created_at: '2026-03-01T11:00:00Z',
      updated_at: '2026-03-03T10:00:00Z',
    },
    {
      id: 11,
      title: '홍대 맛집 인스타',
      description: '홍대 맛집 감성 피드',
      status: 'uploaded',
      scheduled_date: '2026-03-03',
      platforms: ['instagram'],
      metrics: { reach: 9100, impressions: 31500, likes: 1890, saves: 520, profile_visits: 145 },
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-03T10:30:00Z',
    },
    {
      id: 12,
      title: '홍대 맛집 릴스',
      description: '홍대 떡볶이 릴스',
      status: 'uploaded',
      scheduled_date: '2026-03-03',
      platforms: ['instagram_reels'],
      metrics: { plays: 38000, reach: 28000, likes: 5600, saves: 1340, shares: 780 },
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-03T11:00:00Z',
    },
    {
      id: 13,
      title: '홍대 맛집 페북',
      description: '홍대 맛집 투어 후기 공유',
      status: 'uploaded',
      scheduled_date: '2026-03-03',
      platforms: ['facebook'],
      metrics: { reach: 12400, engagement: 1890, likes: 560, shares: 430, comments: 92 },
      created_at: '2026-03-01T13:00:00Z',
      updated_at: '2026-03-03T11:30:00Z',
    },
    {
      id: 14,
      title: '홍대 맛집 스레드',
      description: '홍대 떡볶이 솔직후기',
      status: 'uploaded',
      scheduled_date: '2026-03-03',
      platforms: ['threads'],
      metrics: { views: 2400, likes: 410, replies: 56, reposts: 78, quotes: 23 },
      created_at: '2026-03-01T14:00:00Z',
      updated_at: '2026-03-03T12:00:00Z',
    },
  ])
  const [selectedDate, setSelectedDate] = useState<string | null>(formatDate(new Date()))
  const [selectedContent, setSelectedContent] = useState<CalendarContent | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const days = useMemo(() => {
    return generateCalendarDays(year, month, contents)
  }, [year, month, contents])

  const selectedDayContents = useMemo(() => {
    if (!selectedDate) return []
    return contents.filter(c => c.scheduled_date === selectedDate)
  }, [contents, selectedDate])

  const handlePrev = useCallback(() => {
    setCurrentDate(new Date(year, month - 1, 1))
  }, [year, month])

  const handleNext = useCallback(() => {
    setCurrentDate(new Date(year, month + 1, 1))
  }, [year, month])

  const handleToday = useCallback(() => {
    setCurrentDate(new Date())
  }, [])

  const handleDateClick = useCallback((dateStr: string) => {
    setSelectedDate(dateStr)
    setSelectedContent(null)
  }, [])

  const metricsRef = useRef<HTMLDivElement>(null)

  const handleContentClick = useCallback((content: CalendarContent) => {
    setSelectedContent(prev => prev?.id === content.id ? null : content)
  }, [])

  // 성과 패널 나타나면 스크롤 이동
  useEffect(() => {
    if (selectedContent && metricsRef.current) {
      setTimeout(() => {
        metricsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [selectedContent])

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col animate-in fade-in duration-500">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shadow-inner">
              <CalendarDays size={20} className="text-indigo-600" strokeWidth={2.5} />
            </div>
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">컨텐츠 캘린더</h2>
          </div>

          {/* 캘린더 네비게이션 */}
          <CalendarHeader
            year={year}
            month={month}
            onPrev={handlePrev}
            onNext={handleNext}
            onToday={handleToday}
          />
        </div>
      </div>

      {/* 메인 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽: 캘린더 + 하단 성과 (스크롤 가능) */}
        <div className="flex-1 overflow-y-auto">
          {/* 캘린더 */}
          <div className="min-h-[500px]">
            <CalendarGrid
              days={days}
              selectedDate={selectedDate}
              onDateClick={handleDateClick}
            />
          </div>

          {/* 하단 성과 패널 */}
          {selectedContent && selectedContent.metrics && (() => {
            const m = selectedContent.metrics!
            const platform = selectedContent.platforms[0]
            const metricDefs = PLATFORM_METRICS[platform]
            if (!metricDefs) return null

            const values = metricDefs.map(def => m[def.key] ?? 0)
            const maxVal = Math.max(...values.filter(v => !metricDefs[values.indexOf(v)]?.format), 1)

            // 같은 플랫폼 평균 계산
            const samePlatformContents = contents.filter(c => c.metrics && c.platforms.includes(platform))
            const avgMap: Record<string, number> = {}
            metricDefs.forEach(def => {
              const vals = samePlatformContents.map(c => c.metrics?.[def.key] ?? 0)
              avgMap[def.key] = vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0
            })

            // 같은 플랫폼 비교 (첫 번째 지표 기준)
            const primaryKey = metricDefs[0].key
            const ranked = [...samePlatformContents].sort((a, b) => (b.metrics?.[primaryKey] ?? 0) - (a.metrics?.[primaryKey] ?? 0))
            const bestVal = ranked[0]?.metrics?.[primaryKey] ?? 1
            const platformLabel: Record<string, string> = {
              youtube: 'YouTube', youtube_shorts: 'Shorts', naver_blog: '네이버 블로그',
              facebook: 'Facebook', instagram: 'Instagram', instagram_reels: 'Reels', threads: 'Threads',
            }

            return (
              <div ref={metricsRef} className="border-t-2 border-blue-100 bg-gradient-to-b from-slate-50 to-white px-8 py-8">
                {/* 헤더 */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-md">
                    <BarChart3 size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedContent.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-white bg-gray-800 px-2.5 py-0.5 rounded-full font-medium">{platformLabel[platform]}</span>
                      <span className="text-xs text-gray-400">{selectedContent.scheduled_date}</span>
                    </div>
                  </div>
                </div>

                {/* 지표 카드 */}
                <div className={`grid gap-4 mb-6`} style={{ gridTemplateColumns: `repeat(${metricDefs.length}, 1fr)` }}>
                  {metricDefs.map(({ key, label, icon: Icon, gradient, bg, color, format }) => {
                    const value = m[key] ?? 0
                    const avgVal = avgMap[key] ?? 0
                    const diff = avgVal > 0 ? Math.round(((value - avgVal) / avgVal) * 100) : 0
                    const isSpecial = format === 'time' || format === 'pct'
                    return (
                      <div key={key} className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                            <Icon size={20} className={color} />
                          </div>
                          <span className="text-xs font-semibold text-gray-400">{label}</span>
                        </div>
                        <div className={`text-2xl font-extrabold ${color} mb-2`}>{formatMetricValue(value, format)}</div>
                        {/* 평균 대비 */}
                        <div className="flex items-center gap-1.5 mb-3">
                          {diff > 0 ? (
                            <div className="flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <ArrowUpRight size={14} className="text-emerald-600" />
                              <span className="text-xs font-bold text-emerald-600">+{diff}%</span>
                            </div>
                          ) : diff < 0 ? (
                            <div className="flex items-center gap-0.5 bg-red-50 px-2 py-0.5 rounded-full">
                              <ArrowDownRight size={14} className="text-red-600" />
                              <span className="text-xs font-bold text-red-600">{diff}%</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-0.5 bg-gray-100 px-2 py-0.5 rounded-full">
                              <Minus size={14} className="text-gray-500" />
                              <span className="text-xs font-bold text-gray-500">0%</span>
                            </div>
                          )}
                          <span className="text-[10px] text-gray-400">vs 플랫폼 평균</span>
                        </div>
                        {!isSpecial && (
                          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700 ease-out`}
                              style={{ width: `${Math.max(8, (value / maxVal) * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* 시각적 비교 분석 */}
                <div className="grid grid-cols-2 gap-6">
                  {/* 레이더 차트: 현재 vs 평균 */}
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <BarChart3 size={16} className="text-blue-500" />
                      </div>
                      <span className="text-sm font-bold text-gray-700">지표 분포 (vs 평균)</span>
                    </div>
                    <svg viewBox="0 0 300 300" className="w-full max-w-[340px] mx-auto">
                      {/* 그리드 */}
                      {[0.25, 0.5, 0.75, 1.0].map(level => (
                        <polygon
                          key={level}
                          points={metricDefs.map((_, i) => {
                            const angle = (i * 2 * Math.PI / metricDefs.length) - Math.PI / 2
                            return `${150 + Math.cos(angle) * 105 * level},${150 + Math.sin(angle) * 105 * level}`
                          }).join(' ')}
                          fill={level === 1 ? 'none' : 'none'} stroke="#f0f0f0" strokeWidth="1"
                        />
                      ))}
                      {/* 축 */}
                      {metricDefs.map((_, i) => {
                        const angle = (i * 2 * Math.PI / metricDefs.length) - Math.PI / 2
                        return (
                          <line key={i} x1="150" y1="150"
                            x2={150 + Math.cos(angle) * 105} y2={150 + Math.sin(angle) * 105}
                            stroke="#f0f0f0" strokeWidth="1" />
                        )
                      })}
                      {/* 평균 다각형 */}
                      <polygon
                        points={metricDefs.map((def, i) => {
                          const angle = (i * 2 * Math.PI / metricDefs.length) - Math.PI / 2
                          const curVal = m[def.key] ?? 0
                          const avg2 = avgMap[def.key] ?? 0
                          const maxV = Math.max(curVal, avg2, 1)
                          const n = avg2 / maxV
                          return `${150 + Math.cos(angle) * 105 * n},${150 + Math.sin(angle) * 105 * n}`
                        }).join(' ')}
                        fill="rgba(156, 163, 175, 0.08)" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="5 3"
                      />
                      {/* 현재 다각형 */}
                      <polygon
                        points={metricDefs.map((def, i) => {
                          const angle = (i * 2 * Math.PI / metricDefs.length) - Math.PI / 2
                          const curVal = m[def.key] ?? 0
                          const avg2 = avgMap[def.key] ?? 0
                          const maxV = Math.max(curVal, avg2, 1)
                          const n = curVal / maxV
                          return `${150 + Math.cos(angle) * 105 * n},${150 + Math.sin(angle) * 105 * n}`
                        }).join(' ')}
                        fill="rgba(59, 130, 246, 0.12)" stroke="#3b82f6" strokeWidth="2.5"
                      />
                      {/* 현재 꼭짓점 */}
                      {metricDefs.map((def, i) => {
                        const angle = (i * 2 * Math.PI / metricDefs.length) - Math.PI / 2
                        const curVal = m[def.key] ?? 0
                        const avg2 = avgMap[def.key] ?? 0
                        const maxV = Math.max(curVal, avg2, 1)
                        const n = curVal / maxV
                        return (
                          <circle key={i}
                            cx={150 + Math.cos(angle) * 105 * n}
                            cy={150 + Math.sin(angle) * 105 * n}
                            r="4.5" fill="#3b82f6" stroke="white" strokeWidth="2" />
                        )
                      })}
                      {/* 라벨 */}
                      {metricDefs.map((def, i) => {
                        const angle = (i * 2 * Math.PI / metricDefs.length) - Math.PI / 2
                        const labelR = 130
                        const x = 150 + Math.cos(angle) * labelR
                        const y = 150 + Math.sin(angle) * labelR
                        return (
                          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
                            style={{ fontSize: '11px', fontWeight: 600, fill: '#6b7280' }}>
                            {def.label.length > 6 ? def.label.slice(0, 5) + '..' : def.label}
                          </text>
                        )
                      })}
                    </svg>
                    <div className="flex items-center justify-center gap-6 mt-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-sm" />
                        <span className="text-xs text-gray-500 font-medium">현재 콘텐츠</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full bg-gray-300 border border-dashed border-gray-400" />
                        <span className="text-xs text-gray-500 font-medium">플랫폼 평균</span>
                      </div>
                    </div>
                  </div>

                  {/* 도넛 링 비교 */}
                  {ranked.length >= 2 ? (
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-2.5 mb-5">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                          <TrendingUp size={16} className="text-gray-500" />
                        </div>
                        <span className="text-sm font-bold text-gray-700">{platformLabel[platform]} {metricDefs[0].label} 순위</span>
                      </div>
                      <div className="space-y-3">
                        {ranked.map((c, idx) => {
                          const v = c.metrics?.[primaryKey] ?? 0
                          const pct = (v / bestVal) * 100
                          const isCurrent = c.id === selectedContent.id
                          const ringR = 26
                          const circ = 2 * Math.PI * ringR
                          const ringOffset = circ - (pct / 100) * circ
                          return (
                            <div key={c.id} className={`flex items-center gap-4 p-3.5 rounded-xl transition ${isCurrent ? 'bg-blue-50 border border-blue-200 shadow-sm' : 'bg-gray-50/70'}`}>
                              <div className="relative shrink-0">
                                <svg viewBox="0 0 64 64" className="w-14 h-14">
                                  <circle cx="32" cy="32" r={ringR} fill="none" stroke="#f3f4f6" strokeWidth="5" />
                                  <circle cx="32" cy="32" r={ringR} fill="none"
                                    stroke={isCurrent ? '#3b82f6' : '#d1d5db'}
                                    strokeWidth="5" strokeLinecap="round"
                                    strokeDasharray={circ} strokeDashoffset={ringOffset}
                                    transform="rotate(-90 32 32)"
                                    className="transition-all duration-700" />
                                  <text x="32" y="32" textAnchor="middle" dominantBaseline="middle"
                                    style={{ fontSize: '12px', fontWeight: 700, fill: isCurrent ? '#2563eb' : '#9ca3af' }}>
                                    {Math.round(pct)}%
                                  </text>
                                </svg>
                                <div className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm
                                  ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-gray-300 text-gray-600' : 'bg-gray-200 text-gray-500'}`}>
                                  {idx + 1}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm block truncate ${isCurrent ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{c.title}</span>
                                <span className={`text-lg font-mono ${isCurrent ? 'font-extrabold text-blue-600' : 'text-gray-400'}`}>
                                  {formatMetricValue(v, metricDefs[0].format)}
                                </span>
                              </div>
                              {isCurrent && (
                                <div className="shrink-0 px-2.5 py-1 bg-blue-100 rounded-full">
                                  <span className="text-[10px] font-bold text-blue-600">현재</span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex items-center justify-center">
                      <p className="text-sm text-gray-400">비교할 다른 콘텐츠가 없습니다</p>
                    </div>
                  )}
                </div>

                {/* 성장 추이 라인 차트 */}
                {samePlatformContents.length >= 2 && (() => {
                  const trendData = [...samePlatformContents].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
                  const pDef = metricDefs[0]
                  const vals = trendData.map(c => c.metrics?.[pDef.key] ?? 0)
                  const maxV = Math.max(...vals, 1)
                  const minV = Math.min(...vals, 0)
                  const range = maxV - minV || 1

                  // 변화율
                  const first = vals[0], last = vals[vals.length - 1]
                  const changeRate = first > 0 ? Math.round(((last - first) / first) * 100) : 0

                  // 차트 사이즈
                  const W = 500, H = 220, PL = 40, PR = 15, PT = 28, PB = 28
                  const cW = W - PL - PR, cH = H - PT - PB

                  const points = vals.map((v, i) => ({
                    x: PL + (vals.length === 1 ? cW / 2 : (i / (vals.length - 1)) * cW),
                    y: PT + cH - ((v - minV) / range) * cH,
                    v, c: trendData[i],
                  }))

                  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
                  const areaPath = `${linePath} L${points[points.length - 1].x},${PT + cH} L${points[0].x},${PT + cH} Z`

                  return (
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mt-6">
                      {/* 헤더 */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                            <TrendingUp size={14} className="text-white" />
                          </div>
                          <span className="text-xs font-bold text-gray-700">{platformLabel[platform]} {pDef.label} 추이</span>
                        </div>
                        {changeRate !== 0 && (
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${changeRate > 0 ? 'bg-emerald-50' : 'bg-red-50'
                            }`}>
                            {changeRate > 0
                              ? <ArrowUpRight size={12} className="text-emerald-600" />
                              : <ArrowDownRight size={12} className="text-red-600" />
                            }
                            <span className={`text-xs font-bold ${changeRate > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              {changeRate > 0 ? '+' : ''}{changeRate}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 라인 차트 */}
                      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl mx-auto block">
                        <defs>
                          <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.12" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
                          </linearGradient>
                        </defs>

                        {/* 수평 그리드 */}
                        {[0, 0.5, 1].map(pct => {
                          const gy = PT + cH * (1 - pct)
                          const gv = Math.round(minV + range * pct)
                          return (
                            <g key={pct}>
                              <line x1={PL} y1={gy} x2={W - PR} y2={gy}
                                stroke={pct === 0 ? '#e5e7eb' : '#f5f5f5'} strokeWidth="1" />
                              <text x={PL - 6} y={gy} textAnchor="end" dominantBaseline="middle"
                                style={{ fontSize: '8px', fill: '#b0b0b0' }}>
                                {formatMetricValue(gv, pDef.format)}
                              </text>
                            </g>
                          )
                        })}

                        {/* 면적 */}
                        <path d={areaPath} fill="url(#trendAreaGrad)" />

                        {/* 선 */}
                        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

                        {/* 점 + 라벨 */}
                        {points.map((p, i) => {
                          const isCur = p.c.id === selectedContent.id
                          return (
                            <g key={i}>
                              {isCur && <circle cx={p.x} cy={p.y} r="7" fill="#3b82f6" opacity="0.12" />}
                              <circle cx={p.x} cy={p.y} r={isCur ? 4 : 3}
                                fill={isCur ? '#3b82f6' : 'white'} stroke="#3b82f6" strokeWidth="1.5" />
                              {/* 값 (현재만) */}
                              {isCur && (
                                <>
                                  <rect x={p.x - 22} y={p.y - 22} width="44" height="14" rx="4" fill="#3b82f6" />
                                  <text x={p.x} y={p.y - 13} textAnchor="middle"
                                    style={{ fontSize: '8px', fontWeight: 700, fill: 'white' }}>
                                    {formatMetricValue(p.v, pDef.format)}
                                  </text>
                                  <polygon points={`${p.x - 3},${p.y - 8} ${p.x + 3},${p.y - 8} ${p.x},${p.y - 4}`} fill="#3b82f6" />
                                </>
                              )}
                              {/* X축 */}
                              <text x={p.x} y={H - 10} textAnchor="middle"
                                style={{ fontSize: '7px', fontWeight: isCur ? 700 : 400, fill: isCur ? '#3b82f6' : '#aaa' }}>
                                {p.c.scheduled_date.slice(5)}
                              </text>
                              <text x={p.x} y={H - 2} textAnchor="middle"
                                style={{ fontSize: '6px', fill: isCur ? '#3b82f6' : '#ccc' }}>
                                {p.c.title.length > 6 ? p.c.title.slice(0, 5) + '..' : p.c.title}
                              </text>
                            </g>
                          )
                        })}
                      </svg>
                    </div>
                  )
                })()}
              </div>
            )
          })()}
        </div>

        {/* 상세 패널 */}
        <div className="w-[400px] border-l border-slate-200/60 bg-slate-50 flex flex-col overflow-hidden shadow-sm relative z-0">
          {selectedDate && (
            <>
              {/* 패널 헤더 */}
              <div className="flex items-center px-6 py-5 border-b border-slate-200/60 bg-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg shadow-inner flex items-center justify-center">
                    <CalendarClock size={20} className="text-indigo-600" strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-base">{formatSelectedDate(selectedDate)}</div>
                    <div className="text-xs font-semibold text-slate-500 mt-0.5">
                      {selectedDayContents.length > 0
                        ? `${selectedDayContents.length}개 콘텐츠 업로드`
                        : '업로드 예정 콘텐츠 없음'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 패널 콘텐츠 */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedDayContents.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDayContents.map(content => (
                      <ContentCard
                        key={content.id}
                        content={content}
                        onClick={handleContentClick}
                        isSelected={selectedContent?.id === content.id}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                      <Inbox size={24} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-400 mb-1">콘텐츠가 없습니다</p>
                    <p className="text-xs text-gray-300">이 날짜에 예정된 콘텐츠가 없습니다</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
