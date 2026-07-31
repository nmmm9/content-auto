import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalendarHeaderProps {
  year: number
  month: number
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export default function CalendarHeader({ year, month, onPrev, onNext, onToday }: CalendarHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        className="p-1 rounded hover:bg-paper-beige transition"
      >
        <ChevronLeft size={16} className="text-muted-gray" />
      </button>
      <span className="text-sm font-bold text-ink min-w-[100px] text-center">
        {year}년 {month + 1}월
      </span>
      <button
        onClick={onNext}
        className="p-1 rounded hover:bg-paper-beige transition"
      >
        <ChevronRight size={16} className="text-muted-gray" />
      </button>
      <button
        onClick={onToday}
        className="ml-1 px-2.5 py-1 text-[11px] font-semibold text-ink bg-paper-white border border-paper-gray rounded hover:bg-paper-beige transition"
      >
        오늘
      </button>
    </div>
  )
}
