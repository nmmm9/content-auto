import { useState, useMemo, useCallback } from 'react'
import { CalendarDays, CalendarClock, Inbox, Eye, Heart, MessageCircle, Share2, BarChart3, TrendingUp } from 'lucide-react'
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

export interface ContentMetrics {
  views: number
  likes: number
  comments: number
  shares: number
  impressions: number
}

export interface CalendarContent {
  id: number
  title: string
  description: string
  status: ContentStatus
  scheduled_date: string
  platforms: string[]
  youtube_url?: string
  thumbnail?: string
  metrics?: ContentMetrics
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
      metrics: { views: 12400, likes: 890, comments: 156, shares: 234, impressions: 45200 },
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
      metrics: { views: 34500, likes: 2100, comments: 312, shares: 890, impressions: 89000 },
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
      metrics: { views: 3200, likes: 180, comments: 42, shares: 67, impressions: 8900 },
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
      metrics: { views: 8700, likes: 1240, comments: 89, shares: 156, impressions: 22300 },
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
      metrics: { views: 21000, likes: 3400, comments: 278, shares: 510, impressions: 67800 },
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
      metrics: { views: 5600, likes: 420, comments: 67, shares: 312, impressions: 18400 },
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
      metrics: { views: 1800, likes: 290, comments: 34, shares: 45, impressions: 6200 },
      created_at: '2026-02-25T14:00:00Z',
      updated_at: '2026-02-27T12:00:00Z',
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

  const handleContentClick = useCallback((content: CalendarContent) => {
    setSelectedContent(prev => prev?.id === content.id ? null : content)
  }, [])

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <CalendarDays size={20} className="text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">컨텐츠 캘린더</h2>
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
        {/* 왼쪽: 캘린더 + 하단 성과 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 캘린더 */}
          <div className={`flex-1 flex flex-col transition-all duration-300 ${selectedContent ? 'min-h-0' : ''}`}>
            <CalendarGrid
            days={days}
            selectedDate={selectedDate}
            onDateClick={handleDateClick}
          />
          </div>

          {/* 하단 성과 패널 */}
          {selectedContent && selectedContent.metrics && (
            <div className="border-t border-gray-200 bg-gradient-to-r from-gray-50 to-white px-6 py-4 shrink-0">
              <div className="flex items-center gap-3 mb-3">
                <BarChart3 size={16} className="text-blue-500" />
                <span className="text-sm font-bold text-gray-900">{selectedContent.title}</span>
                <span className="text-[11px] text-gray-400">성과 데이터</span>
              </div>
              <div className="grid grid-cols-5 gap-4">
                <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Eye size={18} className="text-blue-500" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">조회수</div>
                    <div className="text-lg font-bold text-gray-900">{formatNumber(selectedContent.metrics.views)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
                  <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                    <Heart size={18} className="text-red-500" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">좋아요</div>
                    <div className="text-lg font-bold text-gray-900">{formatNumber(selectedContent.metrics.likes)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                    <MessageCircle size={18} className="text-amber-500" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">댓글</div>
                    <div className="text-lg font-bold text-gray-900">{formatNumber(selectedContent.metrics.comments)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
                  <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                    <Share2 size={18} className="text-green-500" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">공유</div>
                    <div className="text-lg font-bold text-gray-900">{formatNumber(selectedContent.metrics.shares)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
                    <TrendingUp size={18} className="text-violet-500" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">노출수</div>
                    <div className="text-lg font-bold text-gray-900">{formatNumber(selectedContent.metrics.impressions)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 상세 패널 */}
        <div className="w-[380px] border-l border-gray-200 bg-white flex flex-col overflow-hidden">
          {selectedDate && (
            <>
              {/* 패널 헤더 */}
              <div className="flex items-center px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <CalendarClock size={16} className="text-blue-500" />
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{formatSelectedDate(selectedDate)}</div>
                    <div className="text-[11px] text-gray-400">
                      {selectedDayContents.length > 0
                        ? `${selectedDayContents.length}개 콘텐츠`
                        : '콘텐츠 없음'}
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
