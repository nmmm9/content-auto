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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onPrev}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <h3 className="text-lg font-bold text-gray-900 min-w-[140px] text-center">
          {year}년 {month + 1}월
        </h3>
        <button
          onClick={onNext}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition"
        >
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>
      <button
        onClick={onToday}
        className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
      >
        오늘
      </button>
    </div>
  )
}
