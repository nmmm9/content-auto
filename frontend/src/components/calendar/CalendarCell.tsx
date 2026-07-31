import ContentCard from './ContentCard'
import type { CalendarContent, CalendarDay } from '../../pages/Calendar'

interface CalendarCellProps {
  day: CalendarDay
  onDateClick: (date: string) => void
  onContentClick: (content: CalendarContent) => void
}

const MAX_VISIBLE = 2

export default function CalendarCell({ day, onDateClick, onContentClick }: CalendarCellProps) {
  const dateStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`

  return (
    <div
      onClick={() => onDateClick(dateStr)}
      className={`min-h-[100px] p-1.5 border-b border-r border-paper-gray cursor-pointer transition hover:bg-paper-beige ${
        !day.isCurrentMonth ? 'bg-paper-ivory' : 'bg-paper-white'
      }`}
    >
      <div className={`text-xs font-medium mb-1 ${
        day.isToday
          ? 'w-6 h-6 bg-paper-ink text-paper-white rounded-full flex items-center justify-center'
          : !day.isCurrentMonth
            ? 'text-ash-gray pl-1'
            : day.date.getDay() === 0
              ? 'text-danger pl-1'
              : day.date.getDay() === 6
                ? 'text-charcoal pl-1'
                : 'text-muted-gray pl-1'
      }`}>
        {day.date.getDate()}
      </div>

      <div className="space-y-0.5">
        {day.contents.slice(0, MAX_VISIBLE).map((content) => (
          <ContentCard
            key={content.id}
            content={content}
            onClick={onContentClick}
          />
        ))}
        {day.contents.length > MAX_VISIBLE && (
          <div className="text-[10px] text-ash-gray pl-2 font-medium">
            +{day.contents.length - MAX_VISIBLE}개 더보기
          </div>
        )}
      </div>
    </div>
  )
}
