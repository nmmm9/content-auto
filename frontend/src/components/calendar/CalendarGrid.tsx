import { Youtube, FileText, Facebook, Instagram, Clapperboard, Film, AtSign, Linkedin, FlaskConical } from 'lucide-react'
import type { CalendarContent, CalendarDay } from '../../pages/Calendar'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const platformConfig: Record<string, { color: string; iconColor: string; icon: typeof Youtube; label: string }> = {
  youtube:         { color: 'bg-gradient-to-r from-red-600 via-red-400 to-rose-300',              iconColor: 'text-red-500',    icon: Youtube,       label: 'YouTube' },
  youtube_shorts:  { color: 'bg-gradient-to-r from-orange-600 via-orange-400 to-yellow-300',      iconColor: 'text-orange-500', icon: Clapperboard,  label: 'Shorts' },
  naver_blog:      { color: 'bg-gradient-to-r from-green-600 via-emerald-400 to-teal-300',        iconColor: 'text-green-500',  icon: FileText,      label: 'Blog' },
  facebook:        { color: 'bg-gradient-to-r from-blue-700 via-blue-400 to-sky-300',             iconColor: 'text-blue-600',   icon: Facebook,      label: 'Facebook' },
  instagram:       { color: 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-300',        iconColor: 'text-pink-500',   icon: Instagram,     label: 'Instagram' },
  instagram_reels: { color: 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-300',       iconColor: 'text-purple-500', icon: Film,          label: 'Reels' },
  threads:         { color: 'bg-gradient-to-r from-gray-900 via-gray-600 to-gray-300',            iconColor: 'text-gray-700',   icon: AtSign,        label: 'Threads' },
  linkedin:        { color: 'bg-gradient-to-r from-blue-800 via-blue-500 to-sky-400',            iconColor: 'text-blue-700',   icon: Linkedin,      label: 'LinkedIn' },
  living_sequence_lab: { color: 'bg-gradient-to-r from-emerald-600 via-teal-400 to-cyan-300',    iconColor: 'text-emerald-600', icon: FlaskConical,  label: 'LSL' },
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
      <div className="grid grid-cols-7 border-b border-gray-200">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={`py-2.5 text-center text-xs font-bold tracking-wider ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
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
            return <div key={i} className="min-h-[200px] border-b border-r border-gray-100 bg-gray-50/40" />
          }

          return (
            <button
              key={i}
              onClick={() => onDateClick(dateStr)}
              className={`relative flex flex-col justify-between min-h-[200px] p-2 border-b border-r border-gray-100 text-left transition-all duration-150
                bg-white hover:bg-gray-50
                ${isSelected ? 'bg-blue-50/80 ring-2 ring-inset ring-blue-500' : ''}
              `}
            >
              {/* 날짜 숫자 */}
              <span className={`text-sm font-semibold leading-none
                ${isSelected
                  ? 'text-blue-700'
                  : dayOfWeek === 0
                    ? 'text-red-400'
                    : dayOfWeek === 6
                      ? 'text-blue-400'
                      : 'text-gray-700'
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
                      <div key={p} className={`flex items-center gap-1.5 h-5 px-1.5 rounded-md ${cfg.color} shadow-sm`}>
                        <Icon size={11} className="text-white shrink-0 drop-shadow-sm" />
                        <span className="text-[9px] font-semibold text-white truncate drop-shadow-sm">{cfg.label}</span>
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
