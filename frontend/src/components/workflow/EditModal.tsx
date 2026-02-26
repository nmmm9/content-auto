import { useState, useEffect } from 'react'
import { X, Sparkles, Save } from 'lucide-react'

interface GeneratedContent {
  title?: string
  description?: string
  caption?: string
  hashtags?: string[]
}

interface EditModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (content: GeneratedContent) => void
  onRegenerate: () => void
  platform: string
  platformName: string
  content: GeneratedContent
}

export default function EditModal({
  isOpen,
  onClose,
  onSave,
  onRegenerate,
  platform,
  platformName,
  content,
}: EditModalProps) {
  const [editedContent, setEditedContent] = useState<GeneratedContent>(content)
  const [hashtagInput, setHashtagInput] = useState('')

  useEffect(() => {
    setEditedContent(content)
    setHashtagInput(content.hashtags?.join(' ') || '')
  }, [content])

  if (!isOpen) return null

  const handleSave = () => {
    const hashtags = hashtagInput
      .split(/[\s,]+/)
      .filter(tag => tag.length > 0)
      .map(tag => tag.startsWith('#') ? tag : `#${tag}`)

    onSave({
      ...editedContent,
      hashtags,
    })
    onClose()
  }

  const handleRegenerate = () => {
    onRegenerate()
  }

  // 플랫폼별 필드 설정
  const getFields = () => {
    switch (platform) {
      case 'youtube_shorts':
        return ['title', 'hashtags']
      case 'naver_blog':
        return ['title', 'description']
      case 'facebook':
        return ['caption', 'hashtags']
      case 'instagram':
      case 'instagram_reels':
        return ['caption', 'hashtags']
      case 'threads':
        return ['caption', 'hashtags']
      default:
        return ['title', 'description', 'hashtags']
    }
  }

  const fields = getFields()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-bold text-gray-900">콘텐츠 수정</h3>
            <p className="text-sm text-gray-500">{platformName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Title Field */}
          {fields.includes('title') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                제목
              </label>
              <input
                type="text"
                value={editedContent.title || ''}
                onChange={(e) => setEditedContent({ ...editedContent, title: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="제목을 입력하세요"
              />
              <div className="text-xs text-gray-400 mt-1 text-right">
                {editedContent.title?.length || 0}자
              </div>
            </div>
          )}

          {/* Description Field */}
          {fields.includes('description') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                본문/설명
              </label>
              <textarea
                value={editedContent.description || ''}
                onChange={(e) => setEditedContent({ ...editedContent, description: e.target.value })}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="본문 내용을 입력하세요"
              />
              <div className="text-xs text-gray-400 mt-1 text-right">
                {editedContent.description?.length || 0}자
              </div>
            </div>
          )}

          {/* Caption Field */}
          {fields.includes('caption') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                캡션
              </label>
              <textarea
                value={editedContent.caption || ''}
                onChange={(e) => setEditedContent({ ...editedContent, caption: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="캡션을 입력하세요"
              />
              <div className="text-xs text-gray-400 mt-1 text-right">
                {editedContent.caption?.length || 0}자
              </div>
            </div>
          )}

          {/* Hashtags Field */}
          {fields.includes('hashtags') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                해시태그
              </label>
              <textarea
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                placeholder="#해시태그1 #해시태그2 #해시태그3"
              />
              <div className="text-xs text-gray-400 mt-1">
                공백 또는 쉼표로 구분 •
                {hashtagInput.split(/[\s,]+/).filter(t => t.length > 0).length}개
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="text-xs font-medium text-gray-500 mb-2">미리보기</div>
            <div className="text-sm text-gray-800 whitespace-pre-wrap">
              {editedContent.title && <div className="font-bold mb-1">{editedContent.title}</div>}
              {editedContent.caption && <div className="mb-2">{editedContent.caption}</div>}
              {editedContent.description && <div className="mb-2">{editedContent.description}</div>}
              {hashtagInput && (
                <div className="text-blue-600">
                  {hashtagInput.split(/[\s,]+/).filter(t => t.length > 0).map(tag =>
                    tag.startsWith('#') ? tag : `#${tag}`
                  ).join(' ')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleRegenerate}
            className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
          >
            <Sparkles size={16} />
            AI 재생성
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Save size={16} />
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
