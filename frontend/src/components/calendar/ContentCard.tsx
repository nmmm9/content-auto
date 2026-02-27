import { Youtube, FileText, Facebook, Instagram, Clapperboard, Film, AtSign } from 'lucide-react'
import type { CalendarContent, ContentStatus } from '../../pages/Calendar'

const STATUS_CONFIG: Record<ContentStatus, {
  label: string
  bg: string
  text: string
  dot: string
  gradient: string
}> = {
  planning:      { label: '기획중',      bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400',    gradient: 'from-gray-400 to-gray-500' },
  producing:     { label: '제작중',      bg: 'bg-blue-50',     text: 'text-blue-600',    dot: 'bg-blue-500',    gradient: 'from-blue-400 to-blue-600' },
  review_needed: { label: '검수필요',    bg: 'bg-amber-50',    text: 'text-amber-600',   dot: 'bg-amber-500',   gradient: 'from-amber-400 to-amber-600' },
  approved:      { label: '승인완료',    bg: 'bg-emerald-50',  text: 'text-emerald-600', dot: 'bg-emerald-500', gradient: 'from-emerald-400 to-emerald-600' },
  scheduled:     { label: '업로드 예정', bg: 'bg-violet-50',   text: 'text-violet-600',  dot: 'bg-violet-500',  gradient: 'from-violet-400 to-violet-600' },
  uploaded:      { label: '업로드 완료', bg: 'bg-green-50',    text: 'text-green-700',   dot: 'bg-green-600',   gradient: 'from-green-400 to-green-600' },
}

const platformConfig: Record<string, { icon: typeof Youtube; label: string; color: string }> = {
  youtube:         { icon: Youtube,       label: 'YouTube',      color: 'text-red-500' },
  youtube_shorts:  { icon: Clapperboard,  label: 'Shorts',       color: 'text-red-400' },
  naver_blog:      { icon: FileText,      label: 'Blog',         color: 'text-green-500' },
  facebook:        { icon: Facebook,      label: 'Facebook',     color: 'text-blue-600' },
  instagram:       { icon: Instagram,     label: 'Instagram',    color: 'text-pink-500' },
  instagram_reels: { icon: Film,          label: 'Reels',        color: 'text-purple-500' },
  threads:         { icon: AtSign,        label: 'Threads',      color: 'text-gray-700' },
}

interface ContentCardProps {
  content: CalendarContent
  onClick: (content: CalendarContent) => void
  isSelected?: boolean
}

export default function ContentCard({ content, onClick, isSelected }: ContentCardProps) {
  const config = STATUS_CONFIG[content.status]

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick(content)
      }}
      className={`w-full text-left rounded-xl border p-4 hover:shadow-md transition-all duration-200 group ${
        isSelected
          ? 'bg-blue-50/50 border-blue-300 ring-1 ring-blue-200 shadow-sm'
          : 'bg-white border-gray-100 hover:border-gray-200'
      }`}
    >
      {/* 상단: 상태 + 제목 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-sm truncate group-hover:text-blue-600 transition-colors">
            {content.title}
          </h4>
          {content.description && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{content.description}</p>
          )}
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.bg} ${config.text}`}>
          {config.label}
        </span>
      </div>

      {/* 하단: 플랫폼 아이콘 */}
      <div className="flex items-center gap-2">
        {/* 상태 바 */}
        <div className={`w-1 h-8 rounded-full bg-gradient-to-b ${config.gradient}`} />

        <div className="flex items-center gap-1.5 flex-wrap">
          {content.platforms.map((p) => {
            const pc = platformConfig[p]
            if (!pc) return null
            const Icon = pc.icon
            return (
              <div
                key={p}
                className="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-md"
                title={pc.label}
              >
                <Icon size={12} className={pc.color} />
                <span className="text-[10px] text-gray-500 font-medium">{pc.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 썸네일 */}
      {content.thumbnail && (
        <div className="mt-3 rounded-lg overflow-hidden">
          <img
            src={content.thumbnail}
            alt={content.title}
            className="w-full h-24 object-cover"
          />
        </div>
      )}
    </button>
  )
}

export { STATUS_CONFIG }
