import { useState, useMemo, useCallback } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import CalendarHeader from '../components/calendar/CalendarHeader'
import CalendarGrid from '../components/calendar/CalendarGrid'
import ContentModal from '../components/calendar/ContentModal'
import StatusFilter, { ALL_STATUSES } from '../components/calendar/StatusFilter'

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

  // 이전 달 빈칸
  for (let i = startOffset - 1; i >= 0; i--) {
    const date = new Date(year, month, -i)
    days.push({ date, isCurrentMonth: false, isToday: false, contents: [] })
  }

  // 현재 달
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

  // 다음 달 빈칸 (6주 맞추기)
  while (days.length < 42) {
    const date = new Date(year, month + 1, days.length - startOffset - lastDay.getDate() + 1)
    days.push({ date, isCurrentMonth: false, isToday: false, contents: [] })
  }

  return days
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [contents, setContents] = useState<CalendarContent[]>([])
  const [selectedFilter, setSelectedFilter] = useState<ContentStatus | 'all'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<CalendarContent | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // 필터링된 콘텐츠
  const filteredContents = useMemo(() => {
    if (selectedFilter === 'all') return contents
    return contents.filter(c => c.status === selectedFilter)
  }, [contents, selectedFilter])

  // 캘린더 일자 생성
  const days = useMemo(() => {
    return generateCalendarDays(year, month, filteredContents)
  }, [year, month, filteredContents])

  // 상태별 개수
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: contents.length }
    ALL_STATUSES.forEach(s => {
      counts[s] = contents.filter(c => c.status === s).length
    })
    return counts
  }, [contents])

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
    setEditingContent(null)
    setModalOpen(true)
  }, [])

  const handleContentClick = useCallback((content: CalendarContent) => {
    setEditingContent(content)
    setSelectedDate(content.scheduled_date)
    setModalOpen(true)
  }, [])

  const handleSave = useCallback((data: Omit<CalendarContent, 'id' | 'created_at' | 'updated_at'>) => {
    const now = new Date().toISOString()
    if (editingContent) {
      // 수정
      setContents(prev => prev.map(c =>
        c.id === editingContent.id
          ? { ...c, ...data, updated_at: now }
          : c
      ))
    } else {
      // 추가
      const newId = Math.max(0, ...contents.map(c => c.id)) + 1
      setContents(prev => [...prev, {
        ...data,
        id: newId,
        created_at: now,
        updated_at: now,
      } as CalendarContent])
    }
    setModalOpen(false)
    setEditingContent(null)
  }, [editingContent, contents])

  const handleDelete = useCallback((id: number) => {
    if (!confirm('이 콘텐츠를 삭제하시겠습니까?')) return
    setContents(prev => prev.filter(c => c.id !== id))
    setModalOpen(false)
    setEditingContent(null)
  }, [])

  return (
    <div className="space-y-4">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays size={24} className="text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">컨텐츠 캘린더</h2>
        </div>
        <button
          onClick={() => {
            setSelectedDate(formatDate(new Date()))
            setEditingContent(null)
            setModalOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <Plus size={16} />
          새 콘텐츠
        </button>
      </div>

      {/* 상태 필터 */}
      <StatusFilter
        selectedFilter={selectedFilter}
        statusCounts={statusCounts}
        onFilterChange={setSelectedFilter}
      />

      {/* 캘린더 헤더 */}
      <CalendarHeader
        year={year}
        month={month}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
      />

      {/* 캘린더 그리드 */}
      <CalendarGrid
        days={days}
        onDateClick={handleDateClick}
        onContentClick={handleContentClick}
      />

      {/* 콘텐츠 모달 */}
      <ContentModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingContent(null)
        }}
        onSave={handleSave}
        onDelete={handleDelete}
        editingContent={editingContent}
        defaultDate={selectedDate}
      />
    </div>
  )
}
