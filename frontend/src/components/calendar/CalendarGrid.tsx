import CalendarCell from './CalendarCell'
import type { CalendarContent, CalendarDay } from '../../pages/Calendar'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

interface CalendarGridProps {
  days: CalendarDay[]
  onDateClick: (date: string) => void
  onContentClick: (content: CalendarContent) => void
}

export default function CalendarGrid({ days, onDateClick, onContentClick }: CalendarGridProps) {
  return (
    <div className="border-t border-l border-gray-200 rounded-lg overflow-hidden">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((day, i) => (
          <div
            key={day}
            className={`py-2 text-center text-xs font-semibold border-b border-r border-gray-200 bg-gray-50 ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-500'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => (
          <CalendarCell
            key={i}
            day={day}
            onDateClick={onDateClick}
            onContentClick={onContentClick}
          />
        ))}
      </div>
    </div>
  )
}
