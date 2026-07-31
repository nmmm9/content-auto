import { Youtube, FileText, Facebook, Instagram, Clapperboard, Film, AtSign, Linkedin, FlaskConical } from 'lucide-react'
import type { CalendarContent, CalendarDay } from '../../pages/Calendar'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const platformConfig: Record<string, { color: string; iconColor: string; icon: typeof Youtube; label: string }> = {
  youtube:         { color: 'bg-paper-white border border-paper-gray', iconColor: 'text-ink', icon: Youtube,       label: 'YouTube' },
  youtube_shorts:  { color: 'bg-paper-white border border-paper-gray', iconColor: 'text-ink', icon: Clapperboard,  label: 'Shorts' },
  naver_blog:      { color: 'bg-paper-white border border-paper-gray', iconColor: 'text-ink', icon: FileText,      label: 'Blog' },
  facebook:        { color: 'bg-paper-white border border-paper-gray', iconColor: 'text-ink', icon: Facebook,      label: 'Facebook' },
  instagram:       { color: 'bg-paper-white border border-paper-gray', iconColor: 'text-ink', icon: Instagram,     label: 'Instagram' },
  instagram_reels: { color: 'bg-paper-white border border-paper-gray', iconColor: 'text-ink', icon: Film,          label: 'Reels' },
  threads:         { color: 'bg-paper-white border border-paper-gray', iconColor: 'text-ink', icon: AtSign,        label: 'Threads' },
  linkedin:        { color: 'bg-paper-white border border-paper-gray', iconColor: 'text-ink', icon: Linkedin,      label: 'LinkedIn' },
  living_sequence_lab: { color: 'bg-paper-white border border-paper-gray', iconColor: 'text-ink', icon: FlaskConical,  label: 'LSL' },
}

interface CalendarGridProps {
  days: CalendarDay[]
  selectedDate: string | null
  onDateClick: (date: string) => void
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 해당 날짜의 모든 콘텐츠에서 고유 플랫폼 추출
function getUniquePlatforms(contents: CalendarContent[]): string[] {
  const set = new Set<string>()
  contents.forEach(c => c.platforms.forEach(p => set.add(p)))
  return Array.from(set)
}

export default function CalendarGrid({ days, selectedDate, onDateClick }: CalendarGridProps) {
  return (
    <div className="flex-1 flex flex-col">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-paper-gray">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={`py-2.5 text-center text-xs font-bold tracking-wider ${
              i === 0 ? 'text-danger' : i === 6 ? 'text-charcoal' : 'text-muted-gray'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6">
        {days.map((day, i) => {
          const dateStr = formatDateStr(day.date)
          const isSelected = dateStr === selectedDate
          const platforms = getUniquePlatforms(day.contents)
          const dayOfWeek = day.date.getDay()

          if (!day.isCurrentMonth) {
            return <div key={i} className="min-h-[200px] border-b border-r border-paper-beige bg-paper-ivory" />
          }

          return (
            <button
              key={i}
              onClick={() => onDateClick(dateStr)}
              className={`relative flex flex-col justify-between min-h-[200px] p-2 border-b border-r border-paper-beige text-left transition-all duration-150
                bg-paper-white hover:bg-paper-beige
                ${isSelected ? 'bg-paper-beige ring-1 ring-inset ring-paper-ink' : ''}
              `}
            >
              {/* 날짜 숫자 */}
              <span className={`text-sm font-semibold leading-none
                ${isSelected
                  ? 'text-ink'
                  : dayOfWeek === 0
                    ? 'text-danger'
                    : dayOfWeek === 6
                      ? 'text-charcoal'
                      : 'text-charcoal'
                }`}
              >
                {day.date.getDate()}
              </span>

              {/* 플랫폼 바 */}
              {platforms.length > 0 && (
                <div className="flex flex-col gap-0.5 mt-auto">
                  {platforms.map(p => {
                    const cfg = platformConfig[p]
                    if (!cfg) return null
                    const Icon = cfg.icon
                    return (
                      <div key={p} className={`flex items-center gap-1.5 h-5 px-1.5 rounded-none ${cfg.color}`}>
                        <Icon size={11} className={`${cfg.iconColor} shrink-0`} />
                        <span className="text-[9px] font-semibold text-ink truncate font-instrument-cond">{cfg.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
