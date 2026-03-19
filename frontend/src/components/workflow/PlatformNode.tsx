import { useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Youtube, FileText, Facebook, Instagram, CheckCircle, XCircle, Loader2, Clock, Clapperboard, Film, AtSign, UserCheck, Edit3, Link, ArrowRight } from 'lucide-react'

export interface PlatformNodeData {
  label: string
  platform: string
  status: 'idle' | 'pending' | 'waiting_approval' | 'uploading' | 'success' | 'failed' | 'ready'
  progress?: number
  message?: string
  url?: string
  isMain?: boolean
  nodeId?: string
  youtubeUrl?: string
  videoTitle?: string
  videoThumbnail?: string
  channelName?: string
  analysisResult?: Record<string, unknown>
  analysisSteps?: { message: string; progress: number; active: boolean; done: boolean }[]
  generatedContent?: {
    title?: string
    description?: string
    content?: string
    caption?: string
    hashtags?: string[]
    tags?: string[]
  }
}

const platformConfig: Record<string, {
  name: string
  icon: typeof Youtube
  gradient: string
  iconBg: string
  iconColor: string
}> = {
  youtube: {
    name: 'YouTube',
    icon: Youtube,
    gradient: 'from-red-500 to-red-600',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
  youtube_shorts: {
    name: 'YouTube Shorts',
    icon: Clapperboard,
    gradient: 'from-orange-400 to-orange-500',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
  },
  naver_blog: {
    name: '네이버 블로그',
    icon: FileText,
    gradient: 'from-green-500 to-green-600',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    gradient: 'from-blue-500 to-blue-600',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    gradient: 'from-pink-500 to-purple-600',
    iconBg: 'bg-pink-100',
    iconColor: 'text-pink-600',
  },
  instagram_reels: {
    name: 'Instagram Reels',
    icon: Film,
    gradient: 'from-purple-500 to-pink-500',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
  },
  threads: {
    name: 'Threads',
    icon: AtSign,
    gradient: 'from-gray-700 to-gray-900',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-800',
  },
}

export default function PlatformNode({ id, data }: NodeProps) {
  const d = data as unknown as PlatformNodeData
  const config = platformConfig[d.platform] || platformConfig.youtube
  const Icon = config.icon
  const [urlInput, setUrlInput] = useState('')

  const handleApprove = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.workflowEvents?.emit('approve', id)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.workflowEvents?.emit('edit', id)
  }

  const handleReject = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.workflowEvents?.emit('reject', id)
  }

  const handleUrlSubmit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!urlInput.trim()) return
    window.workflowEvents?.emit('youtube-url', urlInput.trim())
    setUrlInput('')
  }

  const handleNodeClick = () => {
    if (d.isMain && d.analysisResult && (d.status === 'ready' || d.status === 'success')) {
      window.workflowEvents?.emit('show-analysis', null)
    }
  }

  const statusInfo: Record<string, { icon: React.ReactNode; text: string; color: string }> = {
    idle: { icon: <Clock size={14} className="text-gray-400" />, text: 'URL을 입력하세요', color: 'text-gray-500' },
    ready: { icon: <CheckCircle size={14} className="text-green-500" />, text: '준비 완료', color: 'text-green-600' },
    pending: { icon: <Clock size={14} className="text-yellow-500" />, text: '준비 중', color: 'text-yellow-600' },
    waiting_approval: { icon: <UserCheck size={14} className="text-amber-500" />, text: '승인 대기', color: 'text-amber-600' },
    uploading: { icon: <Loader2 size={14} className="text-blue-500 animate-spin" />, text: '처리 중', color: 'text-blue-600' },
    success: { icon: <CheckCircle size={14} className="text-green-500" />, text: '완료', color: 'text-green-600' },
    failed: { icon: <XCircle size={14} className="text-red-500" />, text: '실패', color: 'text-red-600' },
  }

  const currentStatus = statusInfo[d.status || 'idle'] || statusInfo.idle

  const borderByStatus: Record<string, string> = {
    idle: 'border-gray-200',
    ready: 'border-green-400 shadow-green-100',
    pending: 'border-yellow-300',
    waiting_approval: 'border-amber-400 shadow-amber-100',
    uploading: 'border-blue-400 shadow-blue-100',
    success: 'border-green-400 shadow-green-100',
    failed: 'border-red-400 shadow-red-100',
  }

  return (
    <div
      onClick={handleNodeClick}
      className={`px-5 py-4 rounded-xl border-2 shadow-lg bg-white overflow-hidden ${borderByStatus[d.status || 'idle'] || 'border-gray-200'} ${d.isMain ? 'ring-2 ring-red-500 ring-offset-2' : ''} ${d.isMain && d.analysisResult && (d.status === 'ready' || d.status === 'success') ? 'cursor-pointer hover:shadow-xl transition-shadow' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white" />

      {/* Main Badge */}
      {d.isMain && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
          메인
        </div>
      )}

      {/* Waiting Approval Badge */}
      {d.status === 'waiting_approval' && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full animate-pulse">
          승인 필요
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 ${config.iconBg} rounded-lg flex items-center justify-center ${config.iconColor}`}>
          <Icon size={20} />
        </div>
        <div>
          <div className="font-bold text-gray-900 text-sm">{config.name}</div>
          <div className={`flex items-center gap-1 text-xs ${currentStatus.color}`}>
            {currentStatus.icon}
            <span>{currentStatus.text}</span>
          </div>
        </div>
      </div>

      {/* YouTube URL Input (main node only, idle state) */}
      {d.isMain && d.status === 'idle' && (
        <div className="mb-2">
          <div className="flex gap-1.5">
            <div className="flex-1 relative">
              <Link size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(e as unknown as React.MouseEvent) }}
                placeholder="YouTube URL 붙여넣기"
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent nowheel nodrag"
              />
            </div>
            <button
              onClick={handleUrlSubmit}
              className="px-2 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition nowheel nodrag"
            >
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Analysis Progress (main node, pending state) */}
      {d.isMain && d.status === 'pending' && d.analysisSteps && (
        <div className="mb-3">
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
            <div
              className="bg-gradient-to-r from-red-500 to-orange-500 h-1.5 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${d.progress || 0}%` }}
            />
          </div>
          {/* Steps */}
          <div className="space-y-1.5">
            {d.analysisSteps.map((step, i) => (
              <div key={i} className={`flex items-center gap-2 text-xs ${step.active ? 'text-red-600 font-semibold' : step.done ? 'text-green-600' : 'text-gray-400'}`}>
                {step.done ? (
                  <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                ) : step.active ? (
                  <Loader2 size={12} className="animate-spin text-red-500 flex-shrink-0" />
                ) : (
                  <Clock size={12} className="text-gray-300 flex-shrink-0" />
                )}
                <span>{step.message.replace(/^\d\/\d /, '')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* YouTube Video Preview (after URL submitted) */}
      {d.isMain && d.videoTitle && d.status !== 'idle' && (
        <div className="mb-3 rounded-lg overflow-hidden border border-red-200">
          {d.videoThumbnail && (
            <img
              src={d.videoThumbnail}
              alt="thumbnail"
              className="w-full h-[120px] object-cover bg-gray-100"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className="p-2 bg-red-50">
            <div className="font-semibold text-gray-900 text-xs leading-tight line-clamp-2">{d.videoTitle}</div>
            {d.channelName && (
              <div className="text-[10px] text-gray-500 mt-1">{d.channelName}</div>
            )}
            {d.youtubeUrl && (
              <div className="text-[10px] text-red-400 truncate mt-0.5">{d.youtubeUrl}</div>
            )}
          </div>
        </div>
      )}

      {/* Generated Content Preview (when waiting approval) */}
      {d.status === 'waiting_approval' && d.generatedContent && (
        <div className="mb-3 p-2 bg-gray-50 rounded-lg text-xs overflow-hidden max-h-[100px]">
          {d.generatedContent.title && (
            <div className="font-medium text-gray-900 line-clamp-1">{d.generatedContent.title}</div>
          )}
          {(d.generatedContent.caption || d.generatedContent.content || d.generatedContent.description) && (
            <div className="text-gray-600 line-clamp-2 mt-1">
              {d.generatedContent.caption || d.generatedContent.content || d.generatedContent.description}
            </div>
          )}
          {(d.generatedContent.hashtags || d.generatedContent.tags || []).length > 0 && (
            <div className="text-blue-500 line-clamp-1 mt-1">
              {(d.generatedContent.hashtags || d.generatedContent.tags || []).slice(0, 3).join(' ')}
            </div>
          )}
        </div>
      )}

      {/* Approval Buttons */}
      {d.status === 'waiting_approval' && (
        <div className="flex gap-2 mb-2">
          <button
            onClick={handleApprove}
            className="flex-1 py-1.5 px-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 flex items-center justify-center gap-1"
          >
            <CheckCircle size={12} />
            승인
          </button>
          <button
            onClick={handleEdit}
            className="py-1.5 px-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 flex items-center justify-center"
          >
            <Edit3 size={12} />
          </button>
          <button
            onClick={handleReject}
            className="py-1.5 px-2 bg-gray-400 text-white text-xs font-medium rounded-lg hover:bg-gray-500 flex items-center justify-center"
          >
            <XCircle size={12} />
          </button>
        </div>
      )}

      {/* Progress Bar */}
      {d.status === 'uploading' && d.progress !== undefined && (
        <div className="mb-2">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className={`bg-gradient-to-r ${config.gradient} h-1.5 rounded-full transition-all duration-500`}
              style={{ width: `${d.progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1 text-right">{d.progress}%</div>
        </div>
      )}

      {/* Message */}
      {d.message && d.status !== 'waiting_approval' && (
        <div className={`text-xs mt-1 ${d.status === 'failed' ? 'text-red-500' : 'text-gray-500'}`}>
          {d.message}
        </div>
      )}

      {/* Link */}
      {d.status === 'success' && d.url && (
        <a
          href={d.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline mt-1 block"
        >
          게시물 보기
        </a>
      )}

      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white" />
    </div>
  )
}
