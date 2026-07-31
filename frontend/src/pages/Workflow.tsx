import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  SelectionMode,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import PlatformNode, { type PlatformNodeData } from '../components/workflow/PlatformNode'
import ResultNode from '../components/workflow/ResultNode'
import TemplateNode from '../components/workflow/TemplateNode'
import EditModal from '../components/workflow/EditModal'
import PromptReviewModal, { type PromptData, type PromptDefaults } from '../components/workflow/PromptReviewModal'

import { Play, RotateCcw, Zap, CheckCircle, XCircle, Sparkles, Target, Eye, Film, MessageSquare, Lightbulb, TrendingUp, Users, Hash, Volume2, Palette, X, Map } from 'lucide-react'

const nodeTypes = {
  platformNode: PlatformNode,
  resultNode: ResultNode,
  templateNode: TemplateNode,
}

const defaultEdgeOptions = {
  animated: false,
  style: { stroke: '#9e9e9e', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#9e9e9e' },
}

const DERIVED_PLATFORMS = 8

const platformNames: Record<string, string> = {
  'youtube-shorts': 'YouTube Shorts',
  'naver-blog': '네이버 블로그',
  'facebook': 'Facebook',
  'instagram': 'Instagram',
  'instagram-reels': 'Instagram Reels',
  'threads': 'Threads',
  'linkedin': 'LinkedIn',
  'living-sequence-lab': 'Living Sequence Lab',
}

const platformKeys: Record<string, string> = {
  'youtube-shorts': 'youtube_shorts',
  'naver-blog': 'naver_blog',
  'facebook': 'facebook',
  'instagram': 'instagram',
  'instagram-reels': 'instagram_reels',
  'threads': 'threads',
  'linkedin': 'linkedin',
  'living-sequence-lab': 'living_sequence_lab',
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api'

interface VideoInfo {
  video_id: string
  title: string
  channel_name: string
  thumbnail_url: string
}

interface AnalysisResult {
  summary: string
  detailed_summary: string
  topic: string
  keywords: string[]
  mood: string
  target_audience: string
  key_points: string[]
  scenes: string[]
  audio_summary: string
  recommended_style: string
  viral_hook: string
  content_type: string
}

const derivedPlatformIds = [
  'youtube-shorts',
  'naver-blog',
  'facebook',
  'instagram',
  'instagram-reels',
  'threads',
  'linkedin',
  'living-sequence-lab',
]


const createInitialNodes = (): Node[] => [
  {
    id: 'youtube-main',
    type: 'platformNode',
    position: { x: 50, y: 250 },
    style: { width: 300, height: undefined },
    data: {
      label: 'YouTube',
      platform: 'youtube',
      status: 'idle',
      isMain: true,
    },
  },
  {
    id: 'ai-transform',
    type: 'templateNode',
    position: { x: 380, y: 250 },
    data: {
      label: 'AI 변환',
      status: 'idle',
      model: 'gpt-5-mini',
      analysisModel: 'gemini-3.5-flash',
    },
  },
  {
    id: 'youtube-shorts',
    type: 'platformNode',
    position: { x: 720, y: 0 },
    style: { width: 260 },
    data: { label: 'YouTube Shorts', platform: 'youtube_shorts', status: 'idle' },
  },
  {
    id: 'naver-blog',
    type: 'platformNode',
    position: { x: 720, y: 95 },
    style: { width: 260 },
    data: { label: '네이버 블로그', platform: 'naver_blog', status: 'idle' },
  },
  {
    id: 'facebook',
    type: 'platformNode',
    position: { x: 720, y: 190 },
    style: { width: 260 },
    data: { label: 'Facebook', platform: 'facebook', status: 'idle' },
  },
  {
    id: 'instagram',
    type: 'platformNode',
    position: { x: 720, y: 285 },
    style: { width: 260 },
    data: { label: 'Instagram', platform: 'instagram', status: 'idle' },
  },
  {
    id: 'instagram-reels',
    type: 'platformNode',
    position: { x: 720, y: 380 },
    style: { width: 260 },
    data: { label: 'Instagram Reels', platform: 'instagram_reels', status: 'idle' },
  },
  {
    id: 'threads',
    type: 'platformNode',
    position: { x: 720, y: 475 },
    style: { width: 260 },
    data: { label: 'Threads', platform: 'threads', status: 'idle' },
  },
  {
    id: 'linkedin',
    type: 'platformNode',
    position: { x: 720, y: 570 },
    style: { width: 260 },
    data: { label: 'LinkedIn', platform: 'linkedin', status: 'idle' },
  },
  {
    id: 'living-sequence-lab',
    type: 'platformNode',
    position: { x: 720, y: 665 },
    style: { width: 260 },
    data: { label: 'Living Sequence Lab', platform: 'living_sequence_lab', status: 'idle' },
  },
  {
    id: 'result',
    type: 'resultNode',
    position: { x: 1050, y: 260 },
    data: {
      label: '결과',
      totalPlatforms: DERIVED_PLATFORMS,
      completed: 0,
      failed: 0,
      pending: DERIVED_PLATFORMS,
    },
  },
]

const initialEdges: Edge[] = [
  {
    id: 'e-youtube-ai',
    source: 'youtube-main',
    target: 'ai-transform',
    ...defaultEdgeOptions,
  },
  ...derivedPlatformIds.map((id) => ({
    id: `e-ai-${id}`,
    source: 'ai-transform',
    target: id,
    ...defaultEdgeOptions,
  })),
  ...derivedPlatformIds.map((id) => ({
    id: `e-${id}-result`,
    source: id,
    target: 'result',
    ...defaultEdgeOptions,
  })),
]

// 전역 이벤트 버스
const eventBus = {
  listeners: {} as Record<string, ((data: unknown) => void)[]>,
  on(event: string, callback: (data: unknown) => void) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(callback)
  },
  off(event: string, callback: (data: unknown) => void) {
    if (!this.listeners[event]) return
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback)
  },
  emit(event: string, data: unknown) {
    if (!this.listeners[event]) return
    this.listeners[event].forEach((cb) => cb(data))
  },
}

// Window에 이벤트 버스 노출
declare global {
  interface Window {
    workflowEvents: typeof eventBus
  }
}
window.workflowEvents = eventBus

function WorkflowInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(createInitialNodes())
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [isRunning, setIsRunning] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'pending' | 'ready' | 'youtube' | 'ai' | 'approval' | 'done'>('idle')
  const [pendingApprovals, setPendingApprovals] = useState<string[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [selectedModel, setSelectedModel] = useState('gpt-5-mini')
  const [selectedAnalysisModel, setSelectedAnalysisModel] = useState('gemini-3.5-flash')
  const [lastResults, setLastResults] = useState<Record<string, { status: string; data?: Record<string, unknown>; error?: string }>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // 모달 상태
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<{
    title?: string
    description?: string
    content?: string
    caption?: string
    hashtags?: string[]
    tags?: string[]
  }>({})

  // 분석 결과 모달
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false)
  const [analysisTab, setAnalysisTab] = useState<'overview' | 'detail' | 'strategy'>('overview')
  const [showMiniMap, setShowMiniMap] = useState(true)

  // 프롬프트 검토 모달
  const [promptModalOpen, setPromptModalOpen] = useState(false)
  const [promptDefaults, setPromptDefaults] = useState<PromptDefaults | null>(null)
  const [customPrompts, setCustomPrompts] = useState<Record<string, PromptData>>({})
  const [brandVoice, setBrandVoice] = useState('')

  // 동적 자동 레이아웃 (노드 크기 측정 기반)
  const { fitView, getNodes } = useReactFlow()
  const prevPhaseRef = useRef(currentPhase)
  const layoutTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const autoLayout = useCallback(() => {
    const allNodes = getNodes()

    // 4개 컬럼: YouTube | AI 변환 | 플랫폼들 | 결과
    const columns: string[][] = [
      ['youtube-main'],
      ['ai-transform'],
      derivedPlatformIds,
      ['result'],
    ]

    const H_GAP = 80
    const V_GAP = 20

    const getDim = (id: string) => {
      const node = allNodes.find((n) => n.id === id)
      return {
        w: node?.measured?.width ?? 250,
        h: node?.measured?.height ?? 100,
      }
    }

    const colData = columns.map((col) => {
      const dims = col.map((id) => getDim(id))
      const maxW = Math.max(...dims.map((d) => d.w))
      const totalH = dims.reduce((sum, d) => sum + d.h, 0) + Math.max(0, col.length - 1) * V_GAP
      return { ids: col, dims, maxW, totalH }
    })

    let cx = 0
    const colX = colData.map((c) => {
      const x = cx
      cx += c.maxW + H_GAP
      return x
    })
    const maxH = Math.max(...colData.map((c) => c.totalH))

    const positions: Record<string, { x: number; y: number }> = {}
    colData.forEach((c, ci) => {
      let y = (maxH - c.totalH) / 2
      c.ids.forEach((id, ni) => {
        positions[id] = { x: colX[ci] + (c.maxW - c.dims[ni].w) / 2, y }
        y += c.dims[ni].h + V_GAP
      })
    })

    setNodes((nds) =>
      nds.map((n) => {
        const pos = positions[n.id]
        if (pos) return { ...n, position: { ...pos } }
        return n
      })
    )

    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50)
  }, [getNodes, setNodes, fitView])

  const scheduleLayout = useCallback(() => {
    if (layoutTimerRef.current) clearTimeout(layoutTimerRef.current)
    layoutTimerRef.current = setTimeout(autoLayout, 200)
  }, [autoLayout])

  // Phase 변경 시 레이아웃 재계산
  useEffect(() => {
    if (prevPhaseRef.current === currentPhase) return
    prevPhaseRef.current = currentPhase
    scheduleLayout()
  }, [currentPhase, scheduleLayout])

  // 노드 크기 변경 감지 → 레이아웃 재계산
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes)
      if (changes.some((c) => c.type === 'dimensions')) {
        scheduleLayout()
      }
    },
    [onNodesChange, scheduleLayout],
  )

  // 타이머 정리
  useEffect(() => {
    return () => {
      if (layoutTimerRef.current) clearTimeout(layoutTimerRef.current)
    }
  }, [])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds)),
    [setEdges]
  )

  // 결과 노드 업데이트
  const updateResultNode = useCallback((completed: number, failed: number) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === 'result') {
          return {
            ...n,
            data: {
              ...n.data,
              completed,
              failed,
              pending: DERIVED_PLATFORMS - completed - failed,
            },
          }
        }
        return n
      })
    )
  }, [setNodes])

  // 승인 처리
  const handleApprove = useCallback(async (nodeId: string) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, status: 'uploading', progress: 0 } }
        }
        return n
      })
    )

    for (let p = 0; p <= 100; p += 20) {
      await new Promise((r) => setTimeout(r, 150))
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) return { ...n, data: { ...n.data, progress: p } }
          return n
        })
      )
    }

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, status: 'success', message: '업로드 완료', progress: undefined } }
        }
        return n
      })
    )
    setEdges((eds) =>
      eds.map((e) => {
        if (e.source === nodeId) return { ...e, style: { ...e.style, stroke: '#3f6b3f' } }
        return e
      })
    )

    setPendingApprovals((prev) => prev.filter((id) => id !== nodeId))
    setCompletedCount((prev) => {
      const newCount = prev + 1
      updateResultNode(newCount, failedCount)
      return newCount
    })
  }, [setNodes, setEdges, failedCount, updateResultNode])

  // 거절 처리
  const handleReject = useCallback((nodeId: string) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, status: 'failed', message: '업로드 거절됨' } }
        }
        return n
      })
    )
    setEdges((eds) =>
      eds.map((e) => {
        if (e.source === nodeId) return { ...e, style: { ...e.style, stroke: '#f44d22' } }
        return e
      })
    )

    setPendingApprovals((prev) => prev.filter((id) => id !== nodeId))
    setFailedCount((prev) => {
      const newCount = prev + 1
      updateResultNode(completedCount, newCount)
      return newCount
    })
  }, [setNodes, setEdges, completedCount, updateResultNode])

  // 수정 모달 열기
  const handleEdit = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId)
    const content = node?.data?.generatedContent || {}
    setEditingNodeId(nodeId)
    setEditingContent(content as typeof editingContent)
    setEditModalOpen(true)
  }, [nodes])

  // YouTube 메인 노드 업데이트 헬퍼
  const updateMainNode = useCallback((updates: Partial<PlatformNodeData>) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === 'youtube-main') {
          return { ...n, data: { ...n.data, ...updates } }
        }
        return n
      })
    )
  }, [setNodes])

  // YouTube URL 처리 (실제 API 호출 + 단계별 프로그레스)
  const handleYoutubeUrl = useCallback(async (url: string) => {
    setYoutubeUrl(url)

    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/)
    const videoId = videoIdMatch ? videoIdMatch[1] : ''
    const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : ''

    // 분석 단계 정의
    const steps = [
      { message: '1/5 YouTube 메타데이터 추출 중...', progress: 10, delay: 0 },
      { message: '2/5 영상 다운로드 중...', progress: 25, delay: 2000 },
      { message: '3/5 Gemini에 영상 업로드 중...', progress: 45, delay: 6000 },
      { message: '4/5 AI 영상 분석 중...', progress: 65, delay: 12000 },
      { message: '5/5 분석 결과 정리 중...', progress: 85, delay: 20000 },
    ]

    // 초기 상태
    setCurrentPhase('pending')
    updateMainNode({
      status: 'pending',
      youtubeUrl: url,
      videoThumbnail: thumbnail,
      message: steps[0].message,
      progress: steps[0].progress,
      analysisSteps: steps.map((s, i) => ({ ...s, active: i === 0, done: false })),
    } as Partial<PlatformNodeData>)

    // 단계별 타이머 설정
    const timers = steps.slice(1).map((step, i) =>
      setTimeout(() => {
        updateMainNode({
          message: step.message,
          progress: step.progress,
          analysisSteps: steps.map((s, j) => ({
            ...s,
            active: j === i + 1,
            done: j <= i,
          })),
        } as Partial<PlatformNodeData>)
      }, step.delay)
    )

    try {
      const res = await fetch(`${API_BASE}/workflow/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtube_url: url, model: selectedAnalysisModel }),
      })

      // 타이머 정리
      timers.forEach(clearTimeout)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: '알 수 없는 오류' }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }

      const data = await res.json()
      setVideoInfo(data.video_info)
      setAnalysisResult(data.analysis)

      updateMainNode({
        status: 'ready',
        videoTitle: data.video_info.title,
        videoThumbnail: data.video_info.thumbnail_url,
        channelName: data.video_info.channel_name,
        analysisResult: data.analysis,
        message: '영상 분석 완료 (클릭하여 상세보기)',
        progress: 100,
        analysisSteps: undefined,
      } as Partial<PlatformNodeData>)
      setCurrentPhase('ready')
    } catch (err) {
      timers.forEach(clearTimeout)
      const message = err instanceof Error ? err.message : '영상 분석 실패'
      updateMainNode({
        status: 'failed',
        message,
        progress: undefined,
        analysisSteps: undefined,
      } as Partial<PlatformNodeData>)
      setYoutubeUrl(null)
    }
  }, [setNodes, selectedAnalysisModel, updateMainNode])

  // 변환(GPT) 모델 변경 처리
  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model)
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === 'ai-transform') {
          return { ...n, data: { ...n.data, model } }
        }
        return n
      })
    )
  }, [setNodes])

  // 분석(Gemini) 모델 변경 처리
  const handleAnalysisModelChange = useCallback((model: string) => {
    setSelectedAnalysisModel(model)
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === 'ai-transform') {
          return { ...n, data: { ...n.data, analysisModel: model } }
        }
        return n
      })
    )
  }, [setNodes])

  // 이벤트 리스너 등록
  useEffect(() => {
    const onApprove = (data: unknown) => handleApprove(data as string)
    const onReject = (data: unknown) => handleReject(data as string)
    const onEdit = (data: unknown) => handleEdit(data as string)
    const onYoutubeUrl = (data: unknown) => handleYoutubeUrl(data as string)
    const onModelChange = (data: unknown) => handleModelChange(data as string)
    const onAnalysisModelChange = (data: unknown) => handleAnalysisModelChange(data as string)
    const onShowAnalysis = () => { setAnalysisTab('overview'); setAnalysisModalOpen(true) }

    eventBus.on('approve', onApprove)
    eventBus.on('reject', onReject)
    eventBus.on('edit', onEdit)
    eventBus.on('youtube-url', onYoutubeUrl)
    eventBus.on('model-change', onModelChange)
    eventBus.on('analysis-model-change', onAnalysisModelChange)
    eventBus.on('show-analysis', onShowAnalysis)

    return () => {
      eventBus.off('approve', onApprove)
      eventBus.off('reject', onReject)
      eventBus.off('edit', onEdit)
      eventBus.off('youtube-url', onYoutubeUrl)
      eventBus.off('model-change', onModelChange)
      eventBus.off('analysis-model-change', onAnalysisModelChange)
      eventBus.off('show-analysis', onShowAnalysis)
    }
  }, [handleApprove, handleReject, handleEdit, handleYoutubeUrl, handleModelChange, handleAnalysisModelChange])

  // 수정 저장
  const handleSaveEdit = useCallback((content: typeof editingContent) => {
    if (!editingNodeId) return

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === editingNodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              generatedContent: content,
            },
          }
        }
        return n
      })
    )
    setEditModalOpen(false)
    setEditingNodeId(null)
  }, [editingNodeId, setNodes])

  // AI 재생성
  const handleRegenerate = useCallback(async () => {
    if (!editingNodeId) return
    const newContent = {
      ...editingContent,
      title: editingContent.title ? `[재생성] ${editingContent.title}` : undefined,
      caption: editingContent.caption ? `${editingContent.caption} ✨` : undefined,
    }
    setEditingContent(newContent)
  }, [editingNodeId, editingContent])

  // 워크플로우 실행 (실제 API 호출)
  const runWorkflow = useCallback(async (
    promptOverrides?: Record<string, PromptData>,
    brandVoiceOverride?: string,
  ) => {
    if (isRunning || !analysisResult || !videoInfo) return
    setIsRunning(true)
    setCompletedCount(0)
    setFailedCount(0)

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    // Phase 1: YouTube 분석 완료 표시
    setCurrentPhase('youtube')
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === 'youtube-main') {
          return { ...n, data: { ...n.data, status: 'success', message: '영상 분석 완료' } }
        }
        return n
      })
    )
    setEdges((eds) =>
      eds.map((e) => {
        if (e.source === 'youtube-main') return { ...e, animated: true, style: { ...e.style, stroke: '#0c0c0c' } }
        return e
      })
    )
    await delay(500)

    // Phase 2: AI 변환 - 실제 API 호출
    setCurrentPhase('ai')
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === 'ai-transform') return { ...n, data: { ...n.data, status: 'processing' } }
        return n
      })
    )

    let transformResults: Record<string, { status: string; data?: Record<string, unknown>; error?: string }> = {}

    try {
      const activePrompts = promptOverrides ?? customPrompts
      const activeBrandVoice = brandVoiceOverride ?? brandVoice
      const res = await fetch(`${API_BASE}/workflow/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: analysisResult,
          video_info: videoInfo,
          platforms: derivedPlatformIds.map((id) => platformKeys[id]),
          model: selectedModel,
          youtube_url: youtubeUrl || '',
          brand_voice: activeBrandVoice,
          custom_prompts: Object.keys(activePrompts).length > 0 ? activePrompts : null,
        }),
      })

      if (!res.ok) {
        throw new Error(`Transform API failed: ${res.status}`)
      }

      const data = await res.json()
      transformResults = data.results
      setLastResults(transformResults)
    } catch (err) {
      // API 실패 시 에러 표시
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === 'ai-transform') {
            return { ...n, data: { ...n.data, status: 'idle' } }
          }
          return n
        })
      )
      setIsRunning(false)
      setCurrentPhase('ready')
      console.error('Transform failed:', err)
      return
    }

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === 'ai-transform') return { ...n, data: { ...n.data, status: 'done' } }
        return n
      })
    )
    setEdges((eds) =>
      eds.map((e) => {
        if (e.source === 'ai-transform') return { ...e, animated: true, style: { ...e.style, stroke: '#0c0c0c' } }
        return e
      })
    )
    await delay(500)

    // Phase 3: 승인 대기 - API 결과를 각 노드에 반영
    setNodes((nds) =>
      nds.map((n) => {
        if (derivedPlatformIds.includes(n.id)) {
          const platformKey = platformKeys[n.id]
          const result = transformResults[platformKey]
          const content = result?.status === 'success' ? result.data : undefined

          return {
            ...n,
            data: {
              ...n.data,
              status: result?.status === 'success' ? 'waiting_approval' : 'failed',
              generatedContent: content || undefined,
              message: result?.status === 'error' ? result.error : undefined,
              nodeId: n.id,
            },
          }
        }
        return n
      })
    )
    setCurrentPhase('approval')

    // 성공한 플랫폼만 승인 대기 목록에 추가
    const successPlatforms = derivedPlatformIds.filter((id) => {
      const key = platformKeys[id]
      return transformResults[key]?.status === 'success'
    })
    setPendingApprovals(successPlatforms)

    // 실패한 플랫폼 카운트
    const failCount = derivedPlatformIds.length - successPlatforms.length
    if (failCount > 0) {
      setFailedCount(failCount)
      updateResultNode(0, failCount)
    }

    setIsRunning(false)
  }, [isRunning, analysisResult, videoInfo, selectedModel, youtubeUrl, customPrompts, brandVoice, setNodes, setEdges, updateResultNode])

  // 보내기 → 프롬프트 검토 모달 열기 (기본 프롬프트 lazy fetch)
  const openPromptReview = useCallback(async () => {
    if (isRunning || !analysisResult || !videoInfo) return
    let defaults = promptDefaults
    if (!defaults) {
      try {
        const res = await fetch(`${API_BASE}/workflow/prompts`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        defaults = await res.json()
        setPromptDefaults(defaults)
      } catch (err) {
        console.error('Failed to load prompts, running with defaults:', err)
        // 프롬프트 조회 실패 시 검토 없이 기본 프롬프트로 바로 실행
        runWorkflow({}, '')
        return
      }
    }
    setPromptModalOpen(true)
  }, [isRunning, analysisResult, videoInfo, promptDefaults, runWorkflow])

  // 프롬프트 확정 → 변환 실행
  const handlePromptConfirm = useCallback((prompts: Record<string, PromptData>, voice: string) => {
    setCustomPrompts(prompts)
    setBrandVoice(voice)
    setPromptModalOpen(false)
    runWorkflow(prompts, voice)
  }, [runWorkflow])

  // 전체 승인
  const approveAll = useCallback(async () => {
    for (const nodeId of pendingApprovals) {
      await handleApprove(nodeId)
      await new Promise((r) => setTimeout(r, 300))
    }
    setCurrentPhase('done')
  }, [pendingApprovals, handleApprove])

  // 전체 거절
  const rejectAll = useCallback(() => {
    pendingApprovals.forEach((nodeId) => handleReject(nodeId))
    setCurrentPhase('done')
  }, [pendingApprovals, handleReject])

  // 저장
  const handleSave = async () => {
    if (!videoInfo || !analysisResult) return
    setSaveStatus('saving')
    try {
      const res = await fetch(`${API_BASE}/workflow/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_info: videoInfo,
          analysis: analysisResult,
          results: lastResults,
        }),
      })
      if (!res.ok) throw new Error(`Save failed: ${res.status}`)
      await res.json()
      setSaveStatus('saved')
    } catch (err) {
      console.error('Save failed:', err)
      setSaveStatus('error')
    }
  }

  // 리셋
  const resetWorkflow = useCallback(() => {
    setNodes(createInitialNodes())
    setEdges(initialEdges)
    setIsRunning(false)
    setCurrentPhase('idle')
    setPendingApprovals([])
    setCompletedCount(0)
    setFailedCount(0)
    setYoutubeUrl(null)
    setVideoInfo(null)
    setAnalysisResult(null)
    setSelectedModel('gpt-5-mini')
    setSelectedAnalysisModel('gemini-3.5-flash')
    setSaveStatus('idle')
    setLastResults({})
    setCustomPrompts({})
    setBrandVoice('')
  }, [setNodes, setEdges])

  const miniMapNodeColor = useCallback((node: Node) => {
    switch (node.type) {
      case 'templateNode': return '#0c0c0c'
      case 'platformNode': return '#7d7d7d'
      case 'resultNode': return '#3f6b3f'
      default: return '#9e9e9e'
    }
  }, [])

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-paper-white border-b border-paper-gray z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-paper-ink rounded">
              <Zap size={20} className="text-paper-white" strokeWidth={2.5} />
            </div>
            <h2 className="text-lg font-extrabold tracking-tight text-ink">자동화 워크플로우</h2>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-none border ${currentPhase === 'approval'
            ? 'border-paper-gray text-muted-gray'
            : currentPhase === 'pending'
              ? 'border-paper-ink text-ink'
              : isRunning
                ? 'border-paper-ink text-ink'
                : 'border-paper-gray text-muted-gray'
            }`}>
            {currentPhase === 'approval'
              ? `승인 대기 (${pendingApprovals.length}개)`
              : currentPhase === 'pending'
                ? '영상 분석 중...'
                : isRunning
                  ? '변환 중...'
                  : currentPhase === 'done'
                    ? '완료'
                    : currentPhase === 'ready'
                      ? '분석 완료 - 실행 가능'
                      : 'YouTube URL을 입력하세요'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {currentPhase === 'approval' && pendingApprovals.length > 0 && (
            <>
              <button
                onClick={approveAll}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-success bg-paper-white border border-paper-gray rounded hover:bg-paper-beige transition-colors"
              >
                <CheckCircle size={16} strokeWidth={2.5} />
                전체 승인
              </button>
              <button
                onClick={rejectAll}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-danger bg-paper-white rounded hover:bg-paper-beige transition-colors border border-paper-gray"
              >
                <XCircle size={16} strokeWidth={2.5} />
                전체 거절
              </button>
              <div className="w-px h-8 bg-paper-gray mx-2" />
            </>
          )}
          {currentPhase === 'approval' && (
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving' || saveStatus === 'saved' || !videoInfo || !analysisResult}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-paper-white rounded transition-colors bg-paper-ink hover:bg-charcoal disabled:opacity-50"
            >
              {saveStatus === 'saved' ? '저장됨' : saveStatus === 'saving' ? '저장 중…' : saveStatus === 'error' ? '저장 실패 — 재시도' : '저장'}
            </button>
          )}
          <button
            onClick={resetWorkflow}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-charcoal bg-paper-white border border-paper-gray rounded hover:bg-paper-beige transition-colors"
          >
            <RotateCcw size={16} strokeWidth={2.5} />
            초기화
          </button>
          <button
            onClick={openPromptReview}
            disabled={isRunning || currentPhase === 'approval' || !analysisResult}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-bold rounded transition-colors ${isRunning || currentPhase === 'approval' || !analysisResult
              ? 'bg-paper-beige text-ash-gray cursor-not-allowed'
              : 'bg-lemon text-ink'
              }`}
          >
            <Play size={16} strokeWidth={2.5} />
            {isRunning ? '변환 중...' : !analysisResult ? 'URL 입력 필요' : '보내기'}
          </button>
        </div>
      </div>

      {/* Flow Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={defaultEdgeOptions}
          proOptions={{ hideAttribution: true }}
          selectionMode={SelectionMode.Partial}
          selectionOnDrag
          panOnDrag={[1, 2]}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          preventScrolling={false}
        >
          <Background color="#dbdbdb" gap={20} size={1} />
          <Controls position="bottom-left" />
          {showMiniMap && (
            <MiniMap
              nodeColor={miniMapNodeColor}
              maskColor="rgba(0, 0, 0, 0.1)"
              position="bottom-right"
              style={{ borderRadius: 4, border: '1px solid #dbdbdb' }}
            />
          )}
          {/* 미니맵 토글 버튼 */}
          <button
            onClick={() => setShowMiniMap(!showMiniMap)}
            className={`absolute bottom-3 right-3 z-10 p-2 rounded border transition-colors ${
              showMiniMap
                ? 'bg-paper-white border-paper-gray text-charcoal bottom-[140px]'
                : 'bg-paper-white border-paper-gray text-ash-gray'
            } hover:bg-paper-beige hover:text-ink`}
            title={showMiniMap ? '미니맵 숨기기' : '미니맵 보기'}
          >
            <Map size={16} />
          </button>
        </ReactFlow>
      </div>

      {/* Edit Modal */}
      <EditModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setEditingNodeId(null)
        }}
        onSave={handleSaveEdit}
        onRegenerate={handleRegenerate}
        platform={editingNodeId ? platformKeys[editingNodeId] || '' : ''}
        platformName={editingNodeId ? platformNames[editingNodeId] || '' : ''}
        content={editingContent}
        videoThumbnail={videoInfo?.thumbnail_url}
      />

      {/* Prompt Review Modal */}
      {promptDefaults && (
        <PromptReviewModal
          isOpen={promptModalOpen}
          onClose={() => setPromptModalOpen(false)}
          onConfirm={handlePromptConfirm}
          platforms={derivedPlatformIds.map((id) => ({ key: platformKeys[id], name: platformNames[id] }))}
          defaults={promptDefaults}
          initialPrompts={customPrompts}
          initialBrandVoice={brandVoice}
        />
      )}

      {/* Analysis Result Modal */}
      {analysisModalOpen && analysisResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAnalysisModalOpen(false)}>
          <div className="bg-paper-white rounded border border-paper-gray w-[720px] max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 bg-paper-ink">
              {videoInfo && (
                <div className="w-16 h-10 rounded overflow-hidden flex-shrink-0 border border-white/20">
                  <img src={videoInfo.thumbnail_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={11} className="text-ash-gray flex-shrink-0" />
                  <span className="font-instrument-cond text-[9px] font-bold text-ash-gray uppercase tracking-wider">Gemini AI</span>
                  {analysisResult.content_type && (
                    <span className="px-1.5 py-px border border-ash-gray text-paper-white text-[9px] font-medium rounded-none">
                      {analysisResult.content_type}
                    </span>
                  )}
                </div>
                {videoInfo && (
                  <h3 className="font-semibold text-paper-white text-xs leading-snug truncate mt-0.5">{videoInfo.title}</h3>
                )}
              </div>
              <button onClick={() => setAnalysisModalOpen(false)} className="text-ash-gray hover:text-paper-white transition-colors p-1 flex-shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-paper-gray bg-paper-ivory">
              {([
                { id: 'overview' as const, label: '개요', icon: Eye },
                { id: 'detail' as const, label: '상세 분석', icon: Film },
                { id: 'strategy' as const, label: '콘텐츠 전략', icon: Lightbulb },
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setAnalysisTab(tab.id)}
                  className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                    analysisTab === tab.id
                      ? 'border-paper-ink text-ink bg-paper-white'
                      : 'border-transparent text-ash-gray hover:text-charcoal hover:bg-paper-beige'
                  }`}
                >
                  <tab.icon size={13} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* ── 개요 탭 ── */}
              {analysisTab === 'overview' && (
                <>
                  {/* 주제 + 요약 */}
                  <div className="bg-paper-ivory rounded p-4 border border-paper-beige">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Target size={13} className="text-ink" />
                      <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">주제</span>
                    </div>
                    <p className="font-bold text-ink text-sm">{analysisResult.topic}</p>
                    <p className="text-sm text-charcoal mt-2 leading-relaxed">{analysisResult.summary}</p>
                  </div>

                  {/* 메타 정보 그리드 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-paper-ivory rounded p-3.5 border border-paper-beige">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Palette size={12} className="text-ink" />
                        <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">분위기</span>
                      </div>
                      <p className="text-sm text-charcoal leading-relaxed">{analysisResult.mood}</p>
                    </div>
                    <div className="bg-paper-ivory rounded p-3.5 border border-paper-beige">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Users size={12} className="text-ink" />
                        <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">타겟 시청자</span>
                      </div>
                      <p className="text-sm text-charcoal leading-relaxed">{analysisResult.target_audience}</p>
                    </div>
                  </div>

                  {/* 키워드 */}
                  {analysisResult.keywords?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <Hash size={13} className="text-ink" />
                        <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">키워드</span>
                        <span className="text-[10px] text-ash-gray ml-1">{analysisResult.keywords.length}개</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {analysisResult.keywords.map((kw: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 bg-paper-white text-charcoal text-[11px] font-medium rounded-none border border-paper-gray hover:bg-paper-beige transition-colors cursor-default">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 핵심 포인트 */}
                  {analysisResult.key_points?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <Lightbulb size={13} className="text-ink" />
                        <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">핵심 포인트</span>
                      </div>
                      <div className="space-y-2">
                        {analysisResult.key_points.map((point: string, i: number) => (
                          <div key={i} className="flex items-start gap-2.5 bg-paper-ivory rounded px-3 py-2 border border-paper-beige">
                            <span className="w-5 h-5 flex-shrink-0 bg-paper-ink text-paper-white rounded-none flex items-center justify-center text-[10px] font-bold mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-sm text-charcoal leading-relaxed">{point}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── 상세 분석 탭 ── */}
              {analysisTab === 'detail' && (
                <>
                  {/* 영상 내용 정리 */}
                  {analysisResult.detailed_summary && (
                    <div className="bg-paper-ivory rounded p-4 border border-paper-beige">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Film size={13} className="text-ink" />
                        <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">영상 내용 정리</span>
                      </div>
                      <p className="text-sm text-charcoal leading-relaxed whitespace-pre-line">{analysisResult.detailed_summary}</p>
                    </div>
                  )}

                  {/* 주요 장면 타임라인 */}
                  {analysisResult.scenes?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-3">
                        <Film size={13} className="text-ink" />
                        <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">주요 장면</span>
                      </div>
                      <div className="relative pl-5 space-y-0">
                        {/* 타임라인 선 */}
                        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-paper-gray" />
                        {analysisResult.scenes.map((scene: string, i: number) => (
                          <div key={i} className="relative flex items-start gap-3 py-2">
                            <div className="absolute -left-5 top-3 w-3.5 h-3.5 bg-paper-white border-2 border-paper-ink rounded-full flex items-center justify-center">
                              <div className="w-1.5 h-1.5 bg-paper-ink rounded-full" />
                            </div>
                            <div className="flex-1 bg-paper-ivory rounded px-3 py-2 border border-paper-beige ml-1">
                              <p className="text-sm text-charcoal leading-relaxed">{scene}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 오디오/나레이션 분석 */}
                  {analysisResult.audio_summary && (
                    <div className="bg-paper-ivory rounded p-4 border border-paper-beige">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Volume2 size={13} className="text-ink" />
                        <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">오디오 / 나레이션 분석</span>
                      </div>
                      <p className="text-sm text-charcoal leading-relaxed whitespace-pre-line">{analysisResult.audio_summary}</p>
                    </div>
                  )}

                  {/* 분위기 상세 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-paper-ivory rounded p-3.5 border border-paper-beige">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Palette size={12} className="text-ink" />
                        <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">영상 톤앤매너</span>
                      </div>
                      <p className="text-sm text-charcoal leading-relaxed">{analysisResult.mood}</p>
                    </div>
                    {analysisResult.content_type && (
                      <div className="bg-paper-ivory rounded p-3.5 border border-paper-beige">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Film size={12} className="text-ink" />
                          <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">콘텐츠 유형</span>
                        </div>
                        <p className="text-sm text-charcoal font-semibold capitalize">{analysisResult.content_type}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── 콘텐츠 전략 탭 ── */}
              {analysisTab === 'strategy' && (
                <>
                  {/* 바이럴 포인트 */}
                  {analysisResult.viral_hook && (
                    <div className="bg-paper-ivory rounded p-4 border border-paper-beige">
                      <div className="flex items-center gap-1.5 mb-2">
                        <TrendingUp size={13} className="text-ink" />
                        <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">바이럴 포인트</span>
                      </div>
                      <p className="text-sm text-charcoal leading-relaxed font-medium">{analysisResult.viral_hook}</p>
                      <p className="text-[10px] text-muted-gray mt-2">SNS에서 주목받을 수 있는 핵심 포인트입니다.</p>
                    </div>
                  )}

                  {/* 추천 스타일 */}
                  {analysisResult.recommended_style && (
                    <div className="bg-paper-ivory rounded p-4 border border-paper-beige">
                      <div className="flex items-center gap-1.5 mb-2">
                        <MessageSquare size={13} className="text-ink" />
                        <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">추천 글 스타일</span>
                      </div>
                      <p className="text-sm text-charcoal leading-relaxed">{analysisResult.recommended_style}</p>
                    </div>
                  )}

                  {/* 타겟 + 키워드 전략 */}
                  <div className="bg-paper-ivory rounded p-4 border border-paper-beige">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users size={13} className="text-ink" />
                      <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">타겟 시청자 분석</span>
                    </div>
                    <p className="text-sm text-charcoal leading-relaxed">{analysisResult.target_audience}</p>
                  </div>

                  {/* 핵심 포인트를 콘텐츠 활용 관점으로 */}
                  {analysisResult.key_points?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <Lightbulb size={13} className="text-ink" />
                        <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">콘텐츠 재가공 포인트</span>
                      </div>
                      <div className="space-y-1.5">
                        {analysisResult.key_points.map((point: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-charcoal">
                            <CheckCircle size={14} className="text-success mt-0.5 flex-shrink-0" />
                            <span>{point}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SEO 키워드 추천 */}
                  {analysisResult.keywords?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <Hash size={13} className="text-ink" />
                        <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">SEO / 해시태그 추천</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {analysisResult.keywords.slice(0, 10).map((kw: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 bg-paper-white text-charcoal text-[11px] font-medium rounded-none border border-paper-gray">
                            #{kw}
                          </span>
                        ))}
                        {analysisResult.keywords.length > 10 && (
                          <span className="px-2.5 py-1 text-ash-gray text-[11px]">
                            +{analysisResult.keywords.length - 10}개
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Workflow() {
  return (
    <ReactFlowProvider>
      <WorkflowInner />
    </ReactFlowProvider>
  )
}
