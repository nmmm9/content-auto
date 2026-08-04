import { useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Youtube, FileText, Facebook, Instagram, CheckCircle, XCircle, Loader2, Clock, Clapperboard, Film, AtSign, UserCheck, Edit3, Link, ArrowRight, Linkedin, FlaskConical } from 'lucide-react'

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
    gradient: 'bg-paper-ink',
    iconBg: 'bg-paper-beige',
    iconColor: 'text-red-600',
  },
  youtube_shorts: {
    name: 'YouTube Shorts',
    icon: Clapperboard,
    gradient: 'bg-paper-ink',
    iconBg: 'bg-paper-beige',
    iconColor: 'text-red-600',
  },
  naver_blog: {
    name: '네이버 블로그',
    icon: FileText,
    gradient: 'bg-paper-ink',
    iconBg: 'bg-paper-beige',
    iconColor: 'text-green-600',
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    gradient: 'bg-paper-ink',
    iconBg: 'bg-paper-beige',
    iconColor: 'text-blue-600',
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    gradient: 'bg-paper-ink',
    iconBg: 'bg-paper-beige',
    iconColor: 'text-pink-600',
  },
  instagram_reels: {
    name: 'Instagram Reels',
    icon: Film,
    gradient: 'bg-paper-ink',
    iconBg: 'bg-paper-beige',
    iconColor: 'text-pink-600',
  },
  threads: {
    name: 'Threads',
    icon: AtSign,
    gradient: 'bg-paper-ink',
    iconBg: 'bg-paper-beige',
    iconColor: 'text-ink',
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    gradient: 'bg-paper-ink',
    iconBg: 'bg-paper-beige',
    iconColor: 'text-blue-700',
  },
  living_sequence_lab: {
    name: 'Living Sequence Lab',
    icon: FlaskConical,
    gradient: 'bg-paper-ink',
    iconBg: 'bg-paper-beige',
    iconColor: 'text-ink',
  },
}

export default function PlatformNode({ id, data }: NodeProps) {
  const d = data as unknown as PlatformNodeData
  const config = platformConfig[d.platform] || platformConfig.youtube
  const Icon = config.icon
  const [urlInput, setUrlInput] = useState('')
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url')
  const [textInput, setTextInput] = useState('')

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

  const handleTextSubmit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (textInput.trim().length < 2) return
    window.workflowEvents?.emit('text-prompt', textInput.trim())
    setTextInput('')
  }

  const handleNodeClick = () => {
    if (d.isMain && d.analysisResult && (d.status === 'ready' || d.status === 'success')) {
      window.workflowEvents?.emit('show-analysis', null)
    }
  }

  const statusInfo: Record<string, { icon: React.ReactNode; text: string; color: string }> = {
    idle: { icon: <Clock size={14} className="text-ash-gray" />, text: 'URL 또는 주제를 입력하세요', color: 'text-muted-gray' },
    ready: { icon: <CheckCircle size={14} className="text-success" />, text: '준비 완료', color: 'text-success' },
    pending: { icon: <Clock size={14} className="text-muted-gray" />, text: '준비 중', color: 'text-muted-gray' },
    waiting_approval: { icon: <UserCheck size={14} className="text-ink" />, text: '승인 대기', color: 'text-ink' },
    uploading: { icon: <Loader2 size={14} className="text-ink animate-spin" />, text: '처리 중', color: 'text-charcoal' },
    success: { icon: <CheckCircle size={14} className="text-success" />, text: '완료', color: 'text-success' },
    failed: { icon: <XCircle size={14} className="text-danger" />, text: '실패', color: 'text-danger' },
  }

  const currentStatus = statusInfo[d.status || 'idle'] || statusInfo.idle

  const borderByStatus: Record<string, string> = {
    idle: 'border-paper-gray',
    ready: 'border-success',
    pending: 'border-paper-gray',
    waiting_approval: 'border-paper-ink',
    uploading: 'border-paper-ink',
    success: 'border-success',
    failed: 'border-danger',
  }

  return (
    <div
      onClick={handleNodeClick}
      className={`px-5 py-4 rounded border-2 bg-paper-white overflow-hidden ${borderByStatus[d.status || 'idle'] || 'border-paper-gray'} ${d.isMain ? 'ring-1 ring-paper-ink ring-offset-2' : ''} ${d.isMain && d.analysisResult && (d.status === 'ready' || d.status === 'success') ? 'cursor-pointer hover:bg-paper-beige transition-colors' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-paper-ink !border-2 !border-paper-white" />

      {/* Main Badge */}
      {d.isMain && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-paper-ink text-paper-white text-[10px] font-bold rounded-none">
          메인
        </div>
      )}

      {/* Waiting Approval Badge */}
      {d.status === 'waiting_approval' && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-paper-ink text-paper-white text-[10px] font-bold rounded-none animate-pulse">
          승인 필요
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 ${config.iconBg} rounded flex items-center justify-center ${config.iconColor}`}>
          <Icon size={20} />
        </div>
        <div>
          <div className="font-bold text-ink text-sm">{config.name}</div>
          <div className={`flex items-center gap-1 text-xs ${currentStatus.color}`}>
            {currentStatus.icon}
            <span>{currentStatus.text}</span>
          </div>
        </div>
      </div>

      {/* 소스 입력 (main node only, idle state) — YouTube URL 또는 주제 텍스트 */}
      {d.isMain && d.status === 'idle' && (
        <div className="mb-2">
          <div className="flex gap-1 mb-1.5">
            {([['url', 'YouTube URL'], ['text', '주제 입력']] as const).map(([mode, label]) => (
              <button
                key={mode}
                onClick={(e) => { e.stopPropagation(); setInputMode(mode) }}
                className={`px-2 py-1 text-[10px] font-bold rounded nowheel nodrag transition-colors ${
                  inputMode === mode
                    ? 'bg-paper-ink text-paper-white'
                    : 'bg-paper-beige text-muted-gray hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {inputMode === 'url' ? (
            <div className="flex gap-1.5">
              <div className="flex-1 relative">
                <Link size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-ash-gray" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(e as unknown as React.MouseEvent) }}
                  placeholder="YouTube URL 붙여넣기"
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-paper-gray rounded focus:ring-1 focus:ring-paper-ink focus:border-paper-ink nowheel nodrag"
                />
              </div>
              <button
                onClick={handleUrlSubmit}
                className="px-2 py-1.5 bg-paper-ink text-paper-white rounded hover:bg-charcoal transition nowheel nodrag"
              >
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={'글로 만들 주제/브리프 입력\n예: 소형 아파트에서 수납을 늘리는 5가지 방법'}
                rows={3}
                className="w-full px-2 py-1.5 text-xs border border-paper-gray rounded focus:ring-1 focus:ring-paper-ink focus:border-paper-ink resize-none nowheel nodrag"
              />
              <button
                onClick={handleTextSubmit}
                className="w-full mt-1 py-1.5 bg-paper-ink text-paper-white text-xs font-bold rounded hover:bg-charcoal transition nowheel nodrag flex items-center justify-center gap-1"
              >
                주제로 기획 분석 <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Analysis Progress (main node, pending state) */}
      {d.isMain && d.status === 'pending' && d.analysisSteps && (
        <div className="mb-3">
          {/* Progress Bar */}
          <div className="w-full bg-paper-beige rounded-none h-1.5 mb-3">
            <div
              className="bg-paper-ink h-1.5 rounded-none transition-all duration-1000 ease-out"
              style={{ width: `${d.progress || 0}%` }}
            />
          </div>
          {/* Steps */}
          <div className="space-y-1.5">
            {d.analysisSteps.map((step, i) => (
              <div key={i} className={`flex items-center gap-2 text-xs ${step.active ? 'text-ink font-semibold' : step.done ? 'text-success' : 'text-ash-gray'}`}>
                {step.done ? (
                  <CheckCircle size={12} className="text-success flex-shrink-0" />
                ) : step.active ? (
                  <Loader2 size={12} className="animate-spin text-ink flex-shrink-0" />
                ) : (
                  <Clock size={12} className="text-ash-gray flex-shrink-0" />
                )}
                <span>{step.message.replace(/^\d\/\d /, '')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* YouTube Video Preview (after URL submitted) */}
      {d.isMain && d.videoTitle && d.status !== 'idle' && (
        <div className="mb-3 rounded overflow-hidden border border-paper-gray">
          {d.videoThumbnail && (
            <img
              src={d.videoThumbnail}
              alt="thumbnail"
              className="w-full h-[120px] object-cover bg-paper-beige"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className="p-2 bg-paper-ivory">
            <div className="font-semibold text-ink text-xs leading-tight line-clamp-2">{d.videoTitle}</div>
            {d.channelName && (
              <div className="text-[10px] text-muted-gray mt-1">{d.channelName}</div>
            )}
            {d.youtubeUrl && (
              <div className="text-[10px] text-ash-gray truncate mt-0.5">{d.youtubeUrl}</div>
            )}
          </div>
        </div>
      )}

      {/* Generated Content Preview (when waiting approval) */}
      {d.status === 'waiting_approval' && d.generatedContent && (
        <div className="mb-3 p-2 bg-paper-beige rounded text-xs overflow-hidden max-h-[100px]">
          {d.generatedContent.title && (
            <div className="font-medium text-ink line-clamp-1">{d.generatedContent.title}</div>
          )}
          {(d.generatedContent.caption || d.generatedContent.content || d.generatedContent.description) && (
            <div className="text-charcoal line-clamp-2 mt-1">
              {d.generatedContent.caption || d.generatedContent.content || d.generatedContent.description}
            </div>
          )}
          {(d.generatedContent.hashtags || d.generatedContent.tags || []).length > 0 && (
            <div className="text-muted-gray line-clamp-1 mt-1">
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
            className="flex-1 py-1.5 px-2 bg-lemon text-ink text-xs font-medium rounded hover:opacity-80 flex items-center justify-center gap-1"
          >
            <CheckCircle size={12} />
            승인
          </button>
          <button
            onClick={handleEdit}
            className="py-1.5 px-2 bg-paper-ink text-paper-white text-xs font-medium rounded hover:bg-charcoal flex items-center justify-center"
          >
            <Edit3 size={12} />
          </button>
          <button
            onClick={handleReject}
            className="py-1.5 px-2 border border-paper-gray text-muted-gray text-xs font-medium rounded hover:bg-paper-beige flex items-center justify-center"
          >
            <XCircle size={12} />
          </button>
        </div>
      )}

      {/* Progress Bar */}
      {d.status === 'uploading' && d.progress !== undefined && (
        <div className="mb-2">
          <div className="w-full bg-paper-beige rounded-none h-1.5">
            <div
              className={`${config.gradient} h-1.5 rounded-none transition-all duration-500`}
              style={{ width: `${d.progress}%` }}
            />
          </div>
          <div className="text-xs text-muted-gray mt-1 text-right">{d.progress}%</div>
        </div>
      )}

      {/* Message */}
      {d.message && d.status !== 'waiting_approval' && (
        <div className={`text-xs mt-1 ${d.status === 'failed' ? 'text-danger' : 'text-muted-gray'}`}>
          {d.message}
        </div>
      )}

      {/* Link */}
      {d.status === 'success' && d.url && (
        <a
          href={d.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-ink hover:underline mt-1 block"
        >
          게시물 보기
        </a>
      )}

      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-paper-ink !border-2 !border-paper-white" />
    </div>
  )
}
