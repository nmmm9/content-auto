import { Youtube, FileText, Facebook, Instagram, Clapperboard, Film, AtSign, Linkedin, FlaskConical } from 'lucide-react'
import type { CalendarContent, ContentStatus } from '../../pages/Calendar'

const STATUS_CONFIG: Record<ContentStatus, {
  label: string
  bg: string
  text: string
  dot: string
  gradient: string
}> = {
  planning:      { label: '기획중',      bg: 'bg-paper-white', text: 'text-muted-gray', dot: 'bg-muted-gray', gradient: 'bg-muted-gray' },
  producing:     { label: '제작중',      bg: 'bg-paper-white', text: 'text-charcoal',   dot: 'bg-charcoal',   gradient: 'bg-charcoal' },
  review_needed: { label: '검수필요',    bg: 'bg-paper-white', text: 'text-danger',     dot: 'bg-danger',     gradient: 'bg-danger' },
  approved:      { label: '승인완료',    bg: 'bg-paper-white', text: 'text-success',    dot: 'bg-success',    gradient: 'bg-success' },
  scheduled:     { label: '업로드 예정', bg: 'bg-paper-white', text: 'text-ink',        dot: 'bg-paper-ink',  gradient: 'bg-paper-ink' },
  uploaded:      { label: '업로드 완료', bg: 'bg-paper-white', text: 'text-success',    dot: 'bg-success',    gradient: 'bg-success' },
}

const platformConfig: Record<string, { icon: typeof Youtube; label: string; color: string }> = {
  youtube:         { icon: Youtube,       label: 'YouTube',      color: 'text-ink' },
  youtube_shorts:  { icon: Clapperboard,  label: 'Shorts',       color: 'text-ink' },
  naver_blog:      { icon: FileText,      label: 'Blog',         color: 'text-ink' },
  facebook:        { icon: Facebook,      label: 'Facebook',     color: 'text-ink' },
  instagram:       { icon: Instagram,     label: 'Instagram',    color: 'text-ink' },
  instagram_reels: { icon: Film,          label: 'Reels',        color: 'text-ink' },
  threads:         { icon: AtSign,        label: 'Threads',      color: 'text-ink' },
  linkedin:        { icon: Linkedin,      label: 'LinkedIn',     color: 'text-ink' },
  living_sequence_lab: { icon: FlaskConical, label: 'LSL',       color: 'text-ink' },
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
      className={`w-full text-left rounded border p-4 transition-all duration-200 group ${
        isSelected
          ? 'bg-paper-beige border-paper-ink ring-1 ring-paper-ink'
          : 'bg-paper-white border-paper-gray hover:bg-paper-beige'
      }`}
    >
      {/* 상단: 상태 + 제목 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-ink text-sm truncate transition-colors">
            {content.title}
          </h4>
          {content.description && (
            <p className="text-xs text-ash-gray mt-0.5 truncate">{content.description}</p>
          )}
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-none border border-paper-gray text-[10px] font-bold ${config.bg} ${config.text}`}>
          {config.label}
        </span>
      </div>

      {/* 하단: 플랫폼 아이콘 */}
      <div className="flex items-center gap-2">
        {/* 상태 바 */}
        <div className={`w-1 h-8 rounded-none ${config.gradient}`} />

        <div className="flex items-center gap-1.5 flex-wrap">
          {content.platforms.map((p) => {
            const pc = platformConfig[p]
            if (!pc) return null
            const Icon = pc.icon
            return (
              <div
                key={p}
                className="flex items-center gap-1 px-2 py-1 bg-paper-beige rounded-none"
                title={pc.label}
              >
                <Icon size={12} className={pc.color} />
                <span className="text-[10px] text-muted-gray font-medium font-instrument-cond">{pc.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 썸네일 */}
      {content.thumbnail && (
        <div className="mt-3 rounded overflow-hidden">
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
