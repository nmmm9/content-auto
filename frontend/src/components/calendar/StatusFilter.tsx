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
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => onFilterChange('all')}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
          selectedFilter === 'all'
            ? 'bg-gray-900 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        전체 ({statusCounts.all})
      </button>
      {ALL_STATUSES.map((s) => {
        const config = STATUS_CONFIG[s]
        const count = statusCounts[s] || 0
        return (
          <button
            key={s}
            onClick={() => onFilterChange(s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              selectedFilter === s
                ? `${config.bg} ${config.text} ring-2 ring-offset-1 ring-current`
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${config.dot}`} />
            {config.label} ({count})
          </button>
        )
      })}
    </div>
  )
}

export { ALL_STATUSES }
