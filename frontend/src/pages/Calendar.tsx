import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { CalendarDays, CalendarClock, Inbox, Eye, Heart, MessageCircle, Share2, BarChart3, TrendingUp, ArrowUpRight, ArrowDownRight, Minus, Clock, MousePointerClick, Users, Bookmark, UserPlus, Search, Repeat2, Timer } from 'lucide-react'
import CalendarHeader from '../components/calendar/CalendarHeader'
import CalendarGrid from '../components/calendar/CalendarGrid'
import ContentCard from '../components/calendar/ContentCard'
import { supabase } from '../lib/supabase'

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
  platformMetrics?: Record<string, Record<string, number>>
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
    { key: 'views', label: '조회수', icon: Eye, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'watch_time', label: '시청 시간', icon: Clock, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink', format: 'time' },
    { key: 'avg_duration', label: '평균 시청 지속시간', icon: Timer, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink', format: 'time' },
    { key: 'ctr', label: 'CTR', icon: MousePointerClick, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink', format: 'pct' },
    { key: 'impressions', label: '노출수', icon: TrendingUp, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'subscribers', label: '구독자 증감', icon: UserPlus, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
  ],
  youtube_shorts: [
    { key: 'views', label: '조회수', icon: Eye, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'likes', label: '좋아요', icon: Heart, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'avg_duration', label: '평균 시청시간', icon: Timer, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink', format: 'time' },
    { key: 'comments', label: '댓글', icon: MessageCircle, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'shares', label: '공유', icon: Share2, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
  ],
  naver_blog: [
    { key: 'views', label: '조회수', icon: Eye, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'likes', label: '공감', icon: Heart, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'comments', label: '댓글', icon: MessageCircle, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'search_visits', label: '검색 유입', icon: Search, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'neighbor_add', label: '이웃 추가', icon: UserPlus, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
  ],
  instagram: [
    { key: 'reach', label: '도달', icon: Users, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'impressions', label: '노출', icon: Eye, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'likes', label: '좋아요', icon: Heart, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'saves', label: '저장', icon: Bookmark, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'profile_visits', label: '프로필 방문', icon: UserPlus, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
  ],
  instagram_reels: [
    { key: 'plays', label: '재생수', icon: Eye, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'reach', label: '도달', icon: Users, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'likes', label: '좋아요', icon: Heart, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'saves', label: '저장', icon: Bookmark, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'shares', label: '공유', icon: Share2, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
  ],
  facebook: [
    { key: 'reach', label: '도달', icon: Users, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'engagement', label: '참여', icon: TrendingUp, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'likes', label: '좋아요', icon: Heart, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'shares', label: '공유', icon: Share2, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'comments', label: '댓글', icon: MessageCircle, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
  ],
  threads: [
    { key: 'views', label: '조회수', icon: Eye, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'likes', label: '좋아요', icon: Heart, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'replies', label: '답글', icon: MessageCircle, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'reposts', label: '리포스트', icon: Repeat2, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'quotes', label: '인용', icon: Share2, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
  ],
  linkedin: [
    { key: 'impressions', label: '노출', icon: Eye, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'likes', label: '좋아요', icon: Heart, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'comments', label: '댓글', icon: MessageCircle, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'shares', label: '공유', icon: Share2, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'clicks', label: '클릭', icon: MousePointerClick, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
  ],
  living_sequence_lab: [
    { key: 'views', label: '조회수', icon: Eye, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'likes', label: '좋아요', icon: Heart, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'comments', label: '댓글', icon: MessageCircle, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
    { key: 'shares', label: '공유', icon: Share2, color: 'text-ink', bg: 'bg-paper-beige', gradient: 'bg-paper-ink' },
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

// DB status → CalendarContent status 매핑
function mapDbStatus(status: string): ContentStatus {
  switch (status) {
    case 'completed': return 'uploaded'
    case 'scheduled': return 'scheduled'
    case 'uploading': return 'scheduled'
    case 'failed': return 'review_needed'
    case 'draft':
    default: return 'planning'
  }
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [contents, setContents] = useState<CalendarContent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(formatDate(new Date()))
  const [selectedContent, setSelectedContent] = useState<CalendarContent | null>(null)

  // Supabase에서 콘텐츠 조회
  useEffect(() => {
    const fetchContents = async () => {
      try {
        // 예약일이 있는 콘텐츠 조회
        const { data: dbContents } = await supabase
          .from('contents')
          .select('*')
          .in('status', ['scheduled', 'completed'])
          .not('scheduled_at', 'is', null)
          .order('scheduled_at', { ascending: true })

        if (!dbContents || dbContents.length === 0) {
          setContents([])
          setIsLoading(false)
          return
        }

        // 업로드 이력에서 플랫폼 정보 조회
        const contentIds = dbContents.map(c => c.id)
        const { data: uploads } = await supabase
          .from('upload_history')
          .select('content_id, platform')
          .in('content_id', contentIds)

        // content_id별 platforms 맵
        const platformMap: Record<number, string[]> = {}
        uploads?.forEach(u => {
          if (!platformMap[u.content_id]) platformMap[u.content_id] = []
          if (!platformMap[u.content_id].includes(u.platform)) {
            platformMap[u.content_id].push(u.platform)
          }
        })

        // DB 데이터 → 플랫폼별 CalendarContent로 펼치기
        const expanded: CalendarContent[] = []
        dbContents.forEach(row => {
          const pMetrics = row.metrics as Record<string, Record<string, number>> | null
          let platforms = platformMap[row.id] || []
          if (platforms.length === 0) {
            const generated = (row.workflow_data as { generated?: Record<string, unknown> } | null | undefined)?.generated
            if (generated) platforms = Object.keys(generated)
          }

          if (platforms.length === 0) {
            // 플랫폼 없는 콘텐츠는 그대로
            expanded.push({
              id: row.id,
              title: row.title,
              description: row.description || '',
              status: mapDbStatus(row.status),
              scheduled_date: row.scheduled_at?.slice(0, 10) || '',
              platforms: [],
              created_at: row.created_at,
              updated_at: row.updated_at,
            })
          } else {
            // 플랫폼별로 카드 1개씩 생성
            platforms.forEach((platform, idx) => {
              expanded.push({
                id: row.id * 100 + idx, // 유니크 ID
                title: row.title,
                description: row.description || '',
                status: mapDbStatus(row.status),
                scheduled_date: row.scheduled_at?.slice(0, 10) || '',
                platforms: [platform],
                metrics: pMetrics?.[platform] || undefined,
                platformMetrics: pMetrics || undefined,
                created_at: row.created_at,
                updated_at: row.updated_at,
              })
            })
          }
        })
        setContents(expanded)
      } catch (error) {
        console.error('Failed to fetch calendar contents:', error)
        setContents([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchContents()
  }, [])

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-paper-gray border-t-paper-ink animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col animate-in fade-in duration-500">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-paper-gray bg-paper-white z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-paper-ink flex items-center justify-center">
              <CalendarDays size={20} className="text-paper-white" strokeWidth={2.5} />
            </div>
            <h2 className="text-lg font-extrabold tracking-tight text-ink">컨텐츠 캘린더</h2>
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
              <div ref={metricsRef} className="border-t border-paper-gray bg-paper-ivory px-8 py-8">
                {/* 헤더 */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded bg-paper-ink flex items-center justify-center">
                    <BarChart3 size={20} className="text-paper-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-ink">{selectedContent.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-paper-white bg-paper-ink px-2.5 py-0.5 rounded-none font-medium font-instrument-cond">{platformLabel[platform]}</span>
                      <span className="text-xs text-ash-gray">{selectedContent.scheduled_date}</span>
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
                      <div key={key} className="relative overflow-hidden rounded border border-paper-gray bg-paper-white p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-10 h-10 rounded ${bg} flex items-center justify-center`}>
                            <Icon size={20} className={color} />
                          </div>
                          <span className="text-xs font-semibold text-muted-gray">{label}</span>
                        </div>
                        <div className={`text-2xl font-extrabold ${color} mb-2`}>{formatMetricValue(value, format)}</div>
                        {/* 평균 대비 */}
                        <div className="flex items-center gap-1.5 mb-3">
                          {diff > 0 ? (
                            <div className="flex items-center gap-0.5 border border-success px-2 py-0.5 rounded-none">
                              <ArrowUpRight size={14} className="text-success" />
                              <span className="text-xs font-bold text-success">+{diff}%</span>
                            </div>
                          ) : diff < 0 ? (
                            <div className="flex items-center gap-0.5 border border-danger px-2 py-0.5 rounded-none">
                              <ArrowDownRight size={14} className="text-danger" />
                              <span className="text-xs font-bold text-danger">{diff}%</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-0.5 border border-paper-gray px-2 py-0.5 rounded-none">
                              <Minus size={14} className="text-muted-gray" />
                              <span className="text-xs font-bold text-muted-gray">0%</span>
                            </div>
                          )}
                          <span className="text-[10px] text-ash-gray">vs 플랫폼 평균</span>
                        </div>
                        {!isSpecial && (
                          <div className="w-full h-2.5 bg-paper-beige rounded-none overflow-hidden">
                            <div
                              className={`h-full rounded-none ${gradient} transition-all duration-700 ease-out`}
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
                  <div className="bg-paper-white rounded p-6 border border-paper-gray">
                    <div className="flex items-center gap-2.5 mb-5">
                      <div className="w-8 h-8 rounded bg-paper-beige flex items-center justify-center">
                        <BarChart3 size={16} className="text-ink" />
                      </div>
                      <span className="text-sm font-bold text-charcoal">지표 분포 (vs 평균)</span>
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
                          fill={level === 1 ? 'none' : 'none'} stroke="#efece3" strokeWidth="1"
                        />
                      ))}
                      {/* 축 */}
                      {metricDefs.map((_, i) => {
                        const angle = (i * 2 * Math.PI / metricDefs.length) - Math.PI / 2
                        return (
                          <line key={i} x1="150" y1="150"
                            x2={150 + Math.cos(angle) * 105} y2={150 + Math.sin(angle) * 105}
                            stroke="#efece3" strokeWidth="1" />
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
                        fill="rgba(125, 125, 125, 0.08)" stroke="#9e9e9e" strokeWidth="1.5" strokeDasharray="5 3"
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
                        fill="rgba(12, 12, 12, 0.08)" stroke="#0c0c0c" strokeWidth="2.5"
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
                            r="4.5" fill="#0c0c0c" stroke="#fffefb" strokeWidth="2" />
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
                            style={{ fontSize: '11px', fontWeight: 600, fill: '#7d7d7d' }}>
                            {def.label.length > 6 ? def.label.slice(0, 5) + '..' : def.label}
                          </text>
                        )
                      })}
                    </svg>
                    <div className="flex items-center justify-center gap-6 mt-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full bg-paper-ink" />
                        <span className="text-xs text-muted-gray font-medium">현재 콘텐츠</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full bg-paper-gray border border-dashed border-ash-gray" />
                        <span className="text-xs text-muted-gray font-medium">플랫폼 평균</span>
                      </div>
                    </div>
                  </div>

                  {/* 도넛 링 비교 */}
                  {ranked.length >= 2 ? (
                    <div className="bg-paper-white rounded p-6 border border-paper-gray">
                      <div className="flex items-center gap-2.5 mb-5">
                        <div className="w-8 h-8 rounded bg-paper-beige flex items-center justify-center">
                          <TrendingUp size={16} className="text-muted-gray" />
                        </div>
                        <span className="text-sm font-bold text-charcoal">{platformLabel[platform]} {metricDefs[0].label} 순위</span>
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
                            <div key={c.id} className={`flex items-center gap-4 p-3.5 rounded transition ${isCurrent ? 'bg-paper-beige border border-paper-ink' : 'bg-paper-ivory'}`}>
                              <div className="relative shrink-0">
                                <svg viewBox="0 0 64 64" className="w-14 h-14">
                                  <circle cx="32" cy="32" r={ringR} fill="none" stroke="#efece3" strokeWidth="5" />
                                  <circle cx="32" cy="32" r={ringR} fill="none"
                                    stroke={isCurrent ? '#0c0c0c' : '#dbdbdb'}
                                    strokeWidth="5" strokeLinecap="round"
                                    strokeDasharray={circ} strokeDashoffset={ringOffset}
                                    transform="rotate(-90 32 32)"
                                    className="transition-all duration-700" />
                                  <text x="32" y="32" textAnchor="middle" dominantBaseline="middle"
                                    style={{ fontSize: '12px', fontWeight: 700, fill: isCurrent ? '#0c0c0c' : '#9e9e9e' }}>
                                    {Math.round(pct)}%
                                  </text>
                                </svg>
                                <div className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                                  ${idx === 0 ? 'bg-paper-ink text-paper-white' : idx === 1 ? 'bg-paper-gray text-charcoal' : 'bg-paper-beige text-muted-gray'}`}>
                                  {idx + 1}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm block truncate ${isCurrent ? 'font-bold text-ink' : 'text-muted-gray'}`}>{c.title}</span>
                                <span className={`text-lg font-mono ${isCurrent ? 'font-extrabold text-ink' : 'text-ash-gray'}`}>
                                  {formatMetricValue(v, metricDefs[0].format)}
                                </span>
                              </div>
                              {isCurrent && (
                                <div className="shrink-0 px-2.5 py-1 border border-paper-ink bg-paper-white rounded-none">
                                  <span className="text-[10px] font-bold text-ink">현재</span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-paper-white rounded p-6 border border-paper-gray flex items-center justify-center">
                      <p className="text-sm text-ash-gray">비교할 다른 콘텐츠가 없습니다</p>
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
                    <div className="bg-paper-white rounded p-4 border border-paper-gray mt-6">
                      {/* 헤더 */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded bg-paper-ink flex items-center justify-center">
                            <TrendingUp size={14} className="text-paper-white" />
                          </div>
                          <span className="text-xs font-bold text-charcoal">{platformLabel[platform]} {pDef.label} 추이</span>
                        </div>
                        {changeRate !== 0 && (
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-none border ${changeRate > 0 ? 'border-success' : 'border-danger'
                            }`}>
                            {changeRate > 0
                              ? <ArrowUpRight size={12} className="text-success" />
                              : <ArrowDownRight size={12} className="text-danger" />
                            }
                            <span className={`text-xs font-bold ${changeRate > 0 ? 'text-success' : 'text-danger'}`}>
                              {changeRate > 0 ? '+' : ''}{changeRate}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 라인 차트 */}
                      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl mx-auto block">
                        {/* 수평 그리드 */}
                        {[0, 0.5, 1].map(pct => {
                          const gy = PT + cH * (1 - pct)
                          const gv = Math.round(minV + range * pct)
                          return (
                            <g key={pct}>
                              <line x1={PL} y1={gy} x2={W - PR} y2={gy}
                                stroke={pct === 0 ? '#dbdbdb' : '#efece3'} strokeWidth="1" />
                              <text x={PL - 6} y={gy} textAnchor="end" dominantBaseline="middle"
                                style={{ fontSize: '8px', fill: '#9e9e9e' }}>
                                {formatMetricValue(gv, pDef.format)}
                              </text>
                            </g>
                          )
                        })}

                        {/* 면적 */}
                        <path d={areaPath} fill="rgba(12, 12, 12, 0.05)" />

                        {/* 선 */}
                        <path d={linePath} fill="none" stroke="#0c0c0c" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

                        {/* 점 + 라벨 */}
                        {points.map((p, i) => {
                          const isCur = p.c.id === selectedContent.id
                          return (
                            <g key={i}>
                              {isCur && <circle cx={p.x} cy={p.y} r="7" fill="#0c0c0c" opacity="0.12" />}
                              <circle cx={p.x} cy={p.y} r={isCur ? 4 : 3}
                                fill={isCur ? '#0c0c0c' : '#fffefb'} stroke="#0c0c0c" strokeWidth="1.5" />
                              {/* 값 (현재만) */}
                              {isCur && (
                                <>
                                  <rect x={p.x - 22} y={p.y - 22} width="44" height="14" rx="4" fill="#0c0c0c" />
                                  <text x={p.x} y={p.y - 13} textAnchor="middle"
                                    style={{ fontSize: '8px', fontWeight: 700, fill: '#fffefb' }}>
                                    {formatMetricValue(p.v, pDef.format)}
                                  </text>
                                  <polygon points={`${p.x - 3},${p.y - 8} ${p.x + 3},${p.y - 8} ${p.x},${p.y - 4}`} fill="#0c0c0c" />
                                </>
                              )}
                              {/* X축 */}
                              <text x={p.x} y={H - 10} textAnchor="middle"
                                style={{ fontSize: '7px', fontWeight: isCur ? 700 : 400, fill: isCur ? '#0c0c0c' : '#7d7d7d' }}>
                                {p.c.scheduled_date.slice(5)}
                              </text>
                              <text x={p.x} y={H - 2} textAnchor="middle"
                                style={{ fontSize: '6px', fill: isCur ? '#0c0c0c' : '#9e9e9e' }}>
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
        <div className="w-[400px] border-l border-paper-gray bg-paper-ivory flex flex-col overflow-hidden relative z-0">
          {selectedDate && (
            <>
              {/* 패널 헤더 */}
              <div className="flex items-center px-6 py-5 border-b border-paper-gray bg-paper-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-paper-beige rounded flex items-center justify-center">
                    <CalendarClock size={20} className="text-ink" strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="font-bold text-ink text-base">{formatSelectedDate(selectedDate)}</div>
                    <div className="text-xs font-semibold text-muted-gray mt-0.5">
                      {selectedDayContents.length > 0
                        ? `${selectedDayContents.length}개 콘텐츠`
                        : '업로드된 콘텐츠 없음'}
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
                    {contents.length === 0 ? (
                      <>
                        <div className="w-16 h-16 bg-paper-beige rounded flex items-center justify-center mb-4">
                          <CalendarDays size={28} className="text-ash-gray" />
                        </div>
                        <p className="text-sm font-semibold text-muted-gray mb-1.5">아직 업로드된 콘텐츠가 없습니다</p>
                        <p className="text-xs text-ash-gray leading-relaxed">콘텐츠를 업로드하면<br/>캘린더에 자동으로 표시됩니다</p>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 bg-paper-beige rounded flex items-center justify-center mb-3">
                          <Inbox size={24} className="text-ash-gray" />
                        </div>
                        <p className="text-sm font-medium text-muted-gray mb-1">콘텐츠가 없습니다</p>
                        <p className="text-xs text-ash-gray">이 날짜에 업로드된 콘텐츠가 없습니다</p>
                      </>
                    )}
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
