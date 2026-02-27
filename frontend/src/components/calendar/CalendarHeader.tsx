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
        className="p-1 rounded-md hover:bg-gray-100 transition"
      >
        <ChevronLeft size={16} className="text-gray-500" />
      </button>
      <span className="text-sm font-bold text-gray-800 min-w-[100px] text-center">
        {year}년 {month + 1}월
      </span>
      <button
        onClick={onNext}
        className="p-1 rounded-md hover:bg-gray-100 transition"
      >
        <ChevronRight size={16} className="text-gray-500" />
      </button>
      <button
        onClick={onToday}
        className="ml-1 px-2.5 py-1 text-[11px] font-semibold text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition"
      >
        오늘
      </button>
    </div>
  )
}
