import { useState, useEffect } from 'react'
import { X, Youtube, FileText, Facebook, Instagram, Clapperboard, Film, AtSign } from 'lucide-react'
import type { CalendarContent, ContentStatus } from '../../pages/Calendar'

const STATUS_OPTIONS: { value: ContentStatus; label: string }[] = [
  { value: 'planning', label: '기획중' },
  { value: 'producing', label: '제작중' },
  { value: 'review_needed', label: '검수필요' },
  { value: 'approved', label: '승인완료' },
  { value: 'scheduled', label: '업로드 예정' },
  { value: 'uploaded', label: '업로드 완료' },
]

const PLATFORM_OPTIONS = [
  { id: 'youtube_shorts', name: 'YouTube Shorts', icon: Clapperboard, color: 'text-orange-500' },
  { id: 'naver_blog', name: '네이버 블로그', icon: FileText, color: 'text-green-500' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-500' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-pink-500' },
  { id: 'instagram_reels', name: 'Instagram Reels', icon: Film, color: 'text-purple-500' },
  { id: 'threads', name: 'Threads', icon: AtSign, color: 'text-gray-700' },
]

interface ContentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (content: Omit<CalendarContent, 'id' | 'created_at' | 'updated_at'>) => void
  onDelete?: (id: number) => void
  editingContent: CalendarContent | null
  defaultDate: string | null
}

export default function ContentModal({ isOpen, onClose, onSave, onDelete, editingContent, defaultDate }: ContentModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ContentStatus>('planning')
  const [scheduledDate, setScheduledDate] = useState('')
  const [platforms, setPlatforms] = useState<string[]>([])
  const [youtubeUrl, setYoutubeUrl] = useState('')

  useEffect(() => {
    if (editingContent) {
      setTitle(editingContent.title)
      setDescription(editingContent.description)
      setStatus(editingContent.status)
      setScheduledDate(editingContent.scheduled_date)
      setPlatforms(editingContent.platforms)
      setYoutubeUrl(editingContent.youtube_url || '')
    } else {
      setTitle('')
      setDescription('')
      setStatus('planning')
      setScheduledDate(defaultDate || '')
      setPlatforms([])
      setYoutubeUrl('')
    }
  }, [editingContent, defaultDate, isOpen])

  if (!isOpen) return null

  const togglePlatform = (id: string) => {
    setPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !scheduledDate) return

    onSave({
      title: title.trim(),
      description: description.trim(),
      status,
      scheduled_date: scheduledDate,
      platforms,
      youtube_url: youtubeUrl || undefined,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">
            {editingContent ? '콘텐츠 수정' : '새 콘텐츠 추가'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="콘텐츠 제목을 입력하세요"
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="콘텐츠에 대한 설명"
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* 예정일 + 상태 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">예정일</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">상태</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ContentStatus)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 대상 플랫폼 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">대상 플랫폼</label>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORM_OPTIONS.map((p) => {
                const selected = platforms.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-2 transition text-left ${
                      selected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p.icon size={16} className={selected ? p.color : 'text-gray-400'} />
                    <span className={`text-sm font-medium ${selected ? 'text-gray-900' : 'text-gray-500'}`}>
                      {p.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* YouTube URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              YouTube URL <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <div className="relative">
              <Youtube size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            {editingContent && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(editingContent.id)}
                className="px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
              >
                삭제
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              {editingContent ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
