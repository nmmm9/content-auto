import { STATUS_CONFIG } from './ContentCard'
import type { ContentStatus } from '../../pages/Calendar'

const ALL_STATUSES: ContentStatus[] = ['planning', 'producing', 'review_needed', 'approved', 'scheduled', 'uploaded']

interface StatusFilterProps {
  selectedFilter: ContentStatus | 'all'
  statusCounts: Record<string, number>
  onFilterChange: (filter: ContentStatus | 'all') => void
}

export default function StatusFilter({ selectedFilter, statusCounts, onFilterChange }: StatusFilterProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => onFilterChange('all')}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
          selectedFilter === 'all'
            ? 'bg-gray-900 text-white shadow-sm'
            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
        }`}
      >
        전체 {statusCounts.all > 0 && <span className="ml-1 opacity-70">{statusCounts.all}</span>}
      </button>
      {ALL_STATUSES.map((s) => {
        const config = STATUS_CONFIG[s]
        const count = statusCounts[s] || 0
        const isActive = selectedFilter === s
        return (
          <button
            key={s}
            onClick={() => onFilterChange(s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              isActive
                ? `${config.bg} ${config.text} ring-1 ring-current/20`
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
            {count > 0 && <span className="opacity-60">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export { ALL_STATUSES }
