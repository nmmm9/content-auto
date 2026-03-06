import { useState, useEffect } from 'react'
import { X, Sparkles, Save, Youtube, FileText, Facebook, Instagram, Clapperboard, Film, AtSign, Heart, MessageCircle, Send, Bookmark, Share2, ThumbsUp, MoreHorizontal, Search, Home } from 'lucide-react'

interface GeneratedContent {
  title?: string
  description?: string
  content?: string
  caption?: string
  hashtags?: string[]
  tags?: string[]
}

interface EditModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (content: GeneratedContent) => void
  onRegenerate: () => void
  platform: string
  platformName: string
  content: GeneratedContent
  videoThumbnail?: string
}

// ── 플랫폼별 미리보기 컴포넌트 ──

function YouTubeShortsPreview({ content, thumbnail }: { content: GeneratedContent; thumbnail?: string }) {
  return (
    <div className="w-[220px] mx-auto bg-black rounded-2xl overflow-hidden shadow-xl border border-gray-700 relative" style={{ height: 390 }}>
      {/* 영상 영역 */}
      <div className="absolute inset-0">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-gray-800 to-gray-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      </div>
      {/* 우측 액션 버튼 */}
      <div className="absolute right-2 bottom-24 flex flex-col items-center gap-4">
        {[
          { icon: ThumbsUp, label: '좋아요' },
          { icon: MessageCircle, label: '댓글' },
          { icon: Share2, label: '공유' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-0.5">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Icon size={14} className="text-white" />
            </div>
            <span className="text-[8px] text-white/70">{label}</span>
          </div>
        ))}
      </div>
      {/* 하단 정보 */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
            <Youtube size={10} className="text-white" />
          </div>
          <span className="text-[10px] text-white font-medium">채널명</span>
        </div>
        <p className="text-white text-[11px] font-semibold leading-snug line-clamp-2 mb-1">
          {content.title || '제목을 입력하세요'}
        </p>
        <div className="flex flex-wrap gap-0.5">
          {(content.hashtags || []).slice(0, 4).map((tag, i) => (
            <span key={i} className="text-[8px] text-blue-300">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function NaverBlogPreview({ content }: { content: GeneratedContent }) {
  const blogContent = content.content || content.description || ''
  return (
    <div className="w-full max-w-[320px] mx-auto bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
      {/* 네이버 헤더 */}
      <div className="bg-[#03C75A] px-3 py-2 flex items-center gap-2">
        <span className="text-white font-bold text-xs">N</span>
        <span className="text-white/90 text-[10px]">블로그</span>
        <div className="flex-1" />
        <Search size={12} className="text-white/70" />
      </div>
      {/* 블로그 글 */}
      <div className="p-3">
        <h2 className="font-bold text-sm text-gray-900 leading-snug mb-2">
          {content.title || '제목을 입력하세요'}
        </h2>
        <div className="flex items-center gap-1.5 mb-2 text-[10px] text-gray-400">
          <span>블로거</span>
          <span>·</span>
          <span>방금 전</span>
        </div>
        <div className="border-t border-gray-100 pt-2">
          <p className="text-xs text-gray-700 leading-relaxed line-clamp-[12] whitespace-pre-line">
            {blogContent || '본문 내용이 여기에 표시됩니다.'}
          </p>
        </div>
        {/* 태그 */}
        {(content.tags || content.hashtags || []).length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-100 flex flex-wrap gap-1">
            {(content.tags || content.hashtags || []).slice(0, 8).map((tag, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-[#03C75A]/10 text-[#03C75A] text-[9px] rounded">
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FacebookPreview({ content }: { content: GeneratedContent }) {
  return (
    <div className="w-full max-w-[320px] mx-auto bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
      {/* 프로필 */}
      <div className="px-3 py-2.5 flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
          <Facebook size={14} className="text-white" />
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-900">페이지 이름</div>
          <div className="text-[10px] text-gray-500">방금 전 · 🌐</div>
        </div>
        <div className="flex-1" />
        <MoreHorizontal size={16} className="text-gray-400" />
      </div>
      {/* 본문 */}
      <div className="px-3 pb-2">
        <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-line line-clamp-[8]">
          {content.caption || '게시물 내용을 입력하세요'}
        </p>
        {(content.hashtags || []).length > 0 && (
          <p className="text-xs text-blue-600 mt-1">
            {(content.hashtags || []).slice(0, 6).join(' ')}
          </p>
        )}
      </div>
      {/* 반응 바 */}
      <div className="px-3 py-1.5 border-t border-gray-100 flex items-center gap-1 text-[10px] text-gray-500">
        <span>👍 😮 ❤️</span>
        <span className="ml-1">24</span>
        <div className="flex-1" />
        <span>댓글 3개</span>
        <span className="mx-1">·</span>
        <span>공유 1회</span>
      </div>
      <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-around">
        {[
          { icon: ThumbsUp, label: '좋아요' },
          { icon: MessageCircle, label: '댓글' },
          { icon: Share2, label: '공유' },
        ].map(({ icon: Icon, label }) => (
          <button key={label} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-blue-600">
            <Icon size={13} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function InstagramPreview({ content, thumbnail }: { content: GeneratedContent; thumbnail?: string }) {
  return (
    <div className="w-full max-w-[280px] mx-auto bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
      {/* 프로필 */}
      <div className="px-3 py-2 flex items-center gap-2">
        <div className="w-7 h-7 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 rounded-full p-[2px]">
          <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
            <Instagram size={10} className="text-pink-500" />
          </div>
        </div>
        <span className="text-[11px] font-semibold text-gray-900">username</span>
        <div className="flex-1" />
        <MoreHorizontal size={14} className="text-gray-600" />
      </div>
      {/* 이미지 */}
      <div className="aspect-square bg-gray-100">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
            <Instagram size={32} className="text-gray-400" />
          </div>
        )}
      </div>
      {/* 액션 */}
      <div className="px-3 py-2 flex items-center gap-3">
        <Heart size={18} className="text-gray-800" />
        <MessageCircle size={18} className="text-gray-800" />
        <Send size={18} className="text-gray-800" />
        <div className="flex-1" />
        <Bookmark size={18} className="text-gray-800" />
      </div>
      {/* 좋아요 */}
      <div className="px-3 text-[10px] font-semibold text-gray-900">좋아요 128개</div>
      {/* 캡션 */}
      <div className="px-3 py-1.5">
        <p className="text-[10px] text-gray-800 leading-relaxed line-clamp-4 whitespace-pre-line">
          <span className="font-semibold">username </span>
          {content.caption || '캡션을 입력하세요'}
        </p>
        {(content.hashtags || []).length > 0 && (
          <p className="text-[10px] text-blue-500 mt-0.5 line-clamp-2">
            {(content.hashtags || []).slice(0, 10).join(' ')}
          </p>
        )}
      </div>
      <div className="px-3 pb-2 text-[9px] text-gray-400">댓글 모두 보기</div>
    </div>
  )
}

function InstagramReelsPreview({ content, thumbnail }: { content: GeneratedContent; thumbnail?: string }) {
  return (
    <div className="w-[220px] mx-auto bg-black rounded-2xl overflow-hidden shadow-xl border border-gray-700 relative" style={{ height: 390 }}>
      {/* 영상 영역 */}
      <div className="absolute inset-0">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-purple-900 to-pink-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      </div>
      {/* 우측 액션 */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-4">
        {[Heart, MessageCircle, Send, Bookmark].map((Icon, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <Icon size={18} className="text-white" />
            {i < 2 && <span className="text-[8px] text-white/70">{i === 0 ? '1.2K' : '48'}</span>}
          </div>
        ))}
      </div>
      {/* 하단 정보 */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-5 h-5 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full" />
          <span className="text-[10px] text-white font-medium">username</span>
        </div>
        <p className="text-white text-[10px] leading-snug line-clamp-2 mb-1">
          {content.caption || '캡션을 입력하세요'}
        </p>
        <div className="flex flex-wrap gap-0.5">
          {(content.hashtags || []).slice(0, 4).map((tag, i) => (
            <span key={i} className="text-[8px] text-blue-300">{tag}</span>
          ))}
        </div>
      </div>
      {/* 하단 내비 */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-around py-1.5 bg-black/50">
        {[Home, Search, Film, Heart, Instagram].map((Icon, i) => (
          <Icon key={i} size={14} className={i === 2 ? 'text-white' : 'text-white/40'} />
        ))}
      </div>
    </div>
  )
}

function ThreadsPreview({ content }: { content: GeneratedContent }) {
  return (
    <div className="w-full max-w-[320px] mx-auto bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
      {/* 헤더 */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-center">
        <AtSign size={18} className="text-gray-900" />
      </div>
      {/* 게시물 */}
      <div className="px-3 py-3 flex gap-2.5">
        {/* 프로필 + 라인 */}
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
            <AtSign size={12} className="text-white" />
          </div>
          <div className="w-0.5 flex-1 bg-gray-200 mt-1.5" />
        </div>
        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-semibold text-gray-900">username</span>
            <span className="text-[10px] text-gray-400">2분</span>
          </div>
          <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-line line-clamp-[8]">
            {content.caption || '게시물 내용을 입력하세요'}
          </p>
          {(content.hashtags || []).length > 0 && (
            <p className="text-xs text-blue-500 mt-1">
              {(content.hashtags || []).slice(0, 5).join(' ')}
            </p>
          )}
          {/* 반응 */}
          <div className="flex items-center gap-4 mt-2.5">
            {[Heart, MessageCircle, Share2].map((Icon, i) => (
              <Icon key={i} size={14} className="text-gray-400" />
            ))}
          </div>
        </div>
      </div>
      <div className="px-3 pb-2 text-[10px] text-gray-400 flex items-center gap-1.5 ml-[42px]">
        <span>답글 3개</span>
        <span>·</span>
        <span>좋아요 24개</span>
      </div>
    </div>
  )
}

// ── 플랫폼 설정 ──

const platformIcons: Record<string, typeof Youtube> = {
  youtube_shorts: Clapperboard,
  naver_blog: FileText,
  facebook: Facebook,
  instagram: Instagram,
  instagram_reels: Film,
  threads: AtSign,
}

const platformColors: Record<string, string> = {
  youtube_shorts: 'from-orange-500 to-red-500',
  naver_blog: 'from-green-500 to-green-600',
  facebook: 'from-blue-500 to-blue-600',
  instagram: 'from-purple-500 via-pink-500 to-orange-400',
  instagram_reels: 'from-purple-600 to-pink-500',
  threads: 'from-gray-800 to-gray-900',
}

// ── 메인 컴포넌트 ──

export default function EditModal({
  isOpen,
  onClose,
  onSave,
  onRegenerate,
  platform,
  platformName,
  content,
  videoThumbnail,
}: EditModalProps) {
  const [editedContent, setEditedContent] = useState<GeneratedContent>(content)
  const [hashtagInput, setHashtagInput] = useState('')

  useEffect(() => {
    setEditedContent(content)
    const tags = content.hashtags || content.tags || []
    setHashtagInput(tags.join(' '))
  }, [content])

  if (!isOpen) return null

  const Icon = platformIcons[platform] || Youtube
  const gradient = platformColors[platform] || 'from-gray-500 to-gray-600'

  const handleSave = () => {
    const parsedTags = hashtagInput
      .split(/[\s,]+/)
      .filter(tag => tag.length > 0)
      .map(tag => tag.startsWith('#') ? tag : `#${tag}`)

    const saved: GeneratedContent = { ...editedContent }
    if (platform === 'naver_blog') {
      saved.tags = parsedTags
    } else {
      saved.hashtags = parsedTags
    }
    onSave(saved)
    onClose()
  }

  // 미리보기 렌더링
  const renderPreview = () => {
    const previewContent = {
      ...editedContent,
      hashtags: hashtagInput.split(/[\s,]+/).filter(t => t.length > 0).map(t => t.startsWith('#') ? t : `#${t}`),
      tags: hashtagInput.split(/[\s,]+/).filter(t => t.length > 0).map(t => t.startsWith('#') ? t : `#${t}`),
    }
    switch (platform) {
      case 'youtube_shorts':
        return <YouTubeShortsPreview content={previewContent} thumbnail={videoThumbnail} />
      case 'naver_blog':
        return <NaverBlogPreview content={previewContent} />
      case 'facebook':
        return <FacebookPreview content={previewContent} />
      case 'instagram':
        return <InstagramPreview content={previewContent} thumbnail={videoThumbnail} />
      case 'instagram_reels':
        return <InstagramReelsPreview content={previewContent} thumbnail={videoThumbnail} />
      case 'threads':
        return <ThreadsPreview content={previewContent} />
      default:
        return null
    }
  }

  // 플랫폼별 편집 필드
  const renderFields = () => {
    switch (platform) {
      case 'youtube_shorts':
        return (
          <>
            <Field label="제목" value={editedContent.title || ''} onChange={(v) => setEditedContent({ ...editedContent, title: v })} maxLength={100} />
            <Field label="설명" value={editedContent.description || ''} onChange={(v) => setEditedContent({ ...editedContent, description: v })} rows={4} />
            <TagField value={hashtagInput} onChange={setHashtagInput} />
          </>
        )
      case 'naver_blog':
        return (
          <>
            <Field label="제목" value={editedContent.title || ''} onChange={(v) => setEditedContent({ ...editedContent, title: v })} maxLength={60} />
            <Field label="본문" value={editedContent.content || editedContent.description || ''} onChange={(v) => setEditedContent({ ...editedContent, content: v })} rows={10} />
            <TagField value={hashtagInput} onChange={setHashtagInput} label="태그" />
          </>
        )
      case 'facebook':
      case 'threads':
        return (
          <>
            <Field label="캡션" value={editedContent.caption || ''} onChange={(v) => setEditedContent({ ...editedContent, caption: v })} rows={6} />
            <TagField value={hashtagInput} onChange={setHashtagInput} />
          </>
        )
      case 'instagram':
        return (
          <>
            <Field label="캡션" value={editedContent.caption || ''} onChange={(v) => setEditedContent({ ...editedContent, caption: v })} rows={6} />
            <TagField value={hashtagInput} onChange={setHashtagInput} />
          </>
        )
      case 'instagram_reels':
        return (
          <>
            <Field label="캡션" value={editedContent.caption || ''} onChange={(v) => setEditedContent({ ...editedContent, caption: v })} rows={4} />
            <TagField value={hashtagInput} onChange={setHashtagInput} />
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-3 bg-gradient-to-r ${gradient}`}>
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Icon size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">{platformName}</h3>
            <p className="text-[10px] text-white/60">콘텐츠 미리보기 & 수정</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {/* Body: Preview + Edit */}
        <div className="flex flex-1 overflow-hidden">
          {/* 좌측: 미리보기 */}
          <div className="w-[380px] flex-shrink-0 bg-gray-100 p-5 overflow-y-auto flex items-start justify-center border-r border-gray-200">
            <div className="sticky top-0">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3 text-center">미리보기</div>
              {renderPreview()}
            </div>
          </div>

          {/* 우측: 수정 폼 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 p-5 space-y-4 overflow-y-auto">
              {renderFields()}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
              >
                <Sparkles size={14} />
                AI 재생성
              </button>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded-lg transition">
                  취소
                </button>
                <button
                  onClick={handleSave}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-lg bg-gradient-to-r ${gradient} hover:shadow-md transition`}
                >
                  <Save size={14} />
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 공통 필드 컴포넌트 ──

function Field({ label, value, onChange, rows, maxLength }: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  maxLength?: number
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      {rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          maxLength={maxLength}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white"
          placeholder={`${label}을 입력하세요`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          placeholder={`${label}을 입력하세요`}
        />
      )}
      <div className="text-[10px] text-gray-400 mt-0.5 text-right">
        {value.length}자{maxLength && ` / ${maxLength}`}
      </div>
    </div>
  )
}

function TagField({ value, onChange, label = '해시태그' }: {
  value: string
  onChange: (v: string) => void
  label?: string
}) {
  const count = value.split(/[\s,]+/).filter(t => t.length > 0).length
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono bg-white"
        placeholder="#태그1 #태그2 #태그3"
      />
      <div className="text-[10px] text-gray-400 mt-0.5">공백/쉼표로 구분 · {count}개</div>
    </div>
  )
}

export type { GeneratedContent }
