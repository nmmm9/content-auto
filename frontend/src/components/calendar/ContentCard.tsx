import { Youtube, FileText, Facebook, Instagram, Clapperboard, Film, AtSign } from 'lucide-react'
import type { CalendarContent, ContentStatus } from '../../pages/Calendar'

const STATUS_CONFIG: Record<ContentStatus, {
  label: string
  bg: string
  text: string
  border: string
  dot: string
}> = {
  planning:      { label: '기획중',      bg: 'bg-gray-100',    text: 'text-gray-600',    border: 'border-gray-300',   dot: 'bg-gray-400' },
  producing:     { label: '제작중',      bg: 'bg-blue-50',     text: 'text-blue-600',    border: 'border-blue-300',   dot: 'bg-blue-500' },
  review_needed: { label: '검수필요',    bg: 'bg-amber-50',    text: 'text-amber-600',   border: 'border-amber-300',  dot: 'bg-amber-500' },
  approved:      { label: '승인완료',    bg: 'bg-emerald-50',  text: 'text-emerald-600', border: 'border-emerald-300',dot: 'bg-emerald-500' },
  scheduled:     { label: '업로드 예정', bg: 'bg-violet-50',   text: 'text-violet-600',  border: 'border-violet-300', dot: 'bg-violet-500' },
  uploaded:      { label: '업로드 완료', bg: 'bg-green-100',   text: 'text-green-700',   border: 'border-green-400',  dot: 'bg-green-600' },
}

const platformIcons: Record<string, typeof Youtube> = {
  youtube: Youtube,
  youtube_shorts: Clapperboard,
  naver_blog: FileText,
  facebook: Facebook,
  instagram: Instagram,
  instagram_reels: Film,
  threads: AtSign,
}

interface ContentCardProps {
  content: CalendarContent
  onClick: (content: CalendarContent) => void
}

export default function ContentCard({ content, onClick }: ContentCardProps) {
  const config = STATUS_CONFIG[content.status]

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick(content)
      }}
      className={`w-full text-left px-2 py-1 rounded-md ${config.bg} hover:opacity-80 transition cursor-pointer`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
        <span className={`text-xs font-medium truncate ${config.text}`}>
          {content.title}
        </span>
      </div>
      <div className="flex items-center gap-0.5 mt-0.5 pl-3">
        {content.platforms.slice(0, 4).map((p) => {
          const Icon = platformIcons[p]
          return Icon ? <Icon key={p} size={10} className="text-gray-400" /> : null
        })}
        {content.platforms.length > 4 && (
          <span className="text-[9px] text-gray-400">+{content.platforms.length - 4}</span>
        )}
      </div>
    </button>
  )
}

export { STATUS_CONFIG }
