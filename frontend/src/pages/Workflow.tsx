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

import { Play, RotateCcw, Zap, CheckCircle, XCircle } from 'lucide-react'

const nodeTypes = {
  platformNode: PlatformNode,
  resultNode: ResultNode,
  templateNode: TemplateNode,
}

const defaultEdgeOptions = {
  animated: false,
  style: { stroke: '#94a3b8', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
}

const DERIVED_PLATFORMS = 6

const platformNames: Record<string, string> = {
  'youtube-shorts': 'YouTube Shorts',
  'naver-blog': '네이버 블로그',
  'facebook': 'Facebook',
  'instagram': 'Instagram',
  'instagram-reels': 'Instagram Reels',
  'threads': 'Threads',
}

const platformKeys: Record<string, string> = {
  'youtube-shorts': 'youtube_shorts',
  'naver-blog': 'naver_blog',
  'facebook': 'facebook',
  'instagram': 'instagram',
  'instagram-reels': 'instagram_reels',
  'threads': 'threads',
}

const API_BASE = 'http://localhost:8000/api'

interface VideoInfo {
  video_id: string
  title: string
  channel_name: string
  thumbnail_url: string
}

interface AnalysisResult {
  summary: string
  topic: string
  keywords: string[]
  mood: string
  target_audience: string
  key_points: string[]
  scenes: string[]
  audio_summary: string
  recommended_style: string
}

const derivedPlatformIds = [
  'youtube-shorts',
  'naver-blog',
  'facebook',
  'instagram',
  'instagram-reels',
  'threads',
]


const createInitialNodes = (): Node[] => [
  {
    id: 'youtube-main',
    type: 'platformNode',
    position: { x: 50, y: 250 },
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
      model: 'gemini-2.5-flash',
    },
  },
  {
    id: 'youtube-shorts',
    type: 'platformNode',
    position: { x: 720, y: 20 },
    data: { label: 'YouTube Shorts', platform: 'youtube_shorts', status: 'idle' },
  },
  {
    id: 'naver-blog',
    type: 'platformNode',
    position: { x: 720, y: 120 },
    data: { label: '네이버 블로그', platform: 'naver_blog', status: 'idle' },
  },
  {
    id: 'facebook',
    type: 'platformNode',
    position: { x: 720, y: 220 },
    data: { label: 'Facebook', platform: 'facebook', status: 'idle' },
  },
  {
    id: 'instagram',
    type: 'platformNode',
    position: { x: 720, y: 320 },
    data: { label: 'Instagram', platform: 'instagram', status: 'idle' },
  },
  {
    id: 'instagram-reels',
    type: 'platformNode',
    position: { x: 720, y: 420 },
    data: { label: 'Instagram Reels', platform: 'instagram_reels', status: 'idle' },
  },
  {
    id: 'threads',
    type: 'platformNode',
    position: { x: 720, y: 520 },
    data: { label: 'Threads', platform: 'threads', status: 'idle' },
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
  const [, setYoutubeUrl] = useState<string | null>(null)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash')

  // 모달 상태
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState<{
    title?: string
    description?: string
    caption?: string
    hashtags?: string[]
  }>({})

  // 분석 결과 모달
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false)

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
        if (e.source === nodeId) return { ...e, style: { ...e.style, stroke: '#22c55e' } }
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
        if (e.source === nodeId) return { ...e, style: { ...e.style, stroke: '#ef4444' } }
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
        body: JSON.stringify({ youtube_url: url, model: selectedModel }),
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
  }, [setNodes, selectedModel, updateMainNode])

  // 모델 변경 처리
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

  // 이벤트 리스너 등록
  useEffect(() => {
    const onApprove = (data: unknown) => handleApprove(data as string)
    const onReject = (data: unknown) => handleReject(data as string)
    const onEdit = (data: unknown) => handleEdit(data as string)
    const onYoutubeUrl = (data: unknown) => handleYoutubeUrl(data as string)
    const onModelChange = (data: unknown) => handleModelChange(data as string)
    const onShowAnalysis = () => setAnalysisModalOpen(true)

    eventBus.on('approve', onApprove)
    eventBus.on('reject', onReject)
    eventBus.on('edit', onEdit)
    eventBus.on('youtube-url', onYoutubeUrl)
    eventBus.on('model-change', onModelChange)
    eventBus.on('show-analysis', onShowAnalysis)

    return () => {
      eventBus.off('approve', onApprove)
      eventBus.off('reject', onReject)
      eventBus.off('edit', onEdit)
      eventBus.off('youtube-url', onYoutubeUrl)
      eventBus.off('model-change', onModelChange)
      eventBus.off('show-analysis', onShowAnalysis)
    }
  }, [handleApprove, handleReject, handleEdit, handleYoutubeUrl, handleModelChange])

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
  const runWorkflow = useCallback(async () => {
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
        if (e.source === 'youtube-main') return { ...e, animated: true, style: { ...e.style, stroke: '#ef4444' } }
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
      const res = await fetch(`${API_BASE}/workflow/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: analysisResult,
          video_info: videoInfo,
          platforms: derivedPlatformIds.map((id) => platformKeys[id]),
          model: selectedModel,
        }),
      })

      if (!res.ok) {
        throw new Error(`Transform API failed: ${res.status}`)
      }

      const data = await res.json()
      transformResults = data.results
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
        if (e.source === 'ai-transform') return { ...e, animated: true, style: { ...e.style, stroke: '#6366f1' } }
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
  }, [isRunning, analysisResult, videoInfo, setNodes, setEdges, updateResultNode])

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
    setSelectedModel('gemini-2.5-flash')
  }, [setNodes, setEdges])

  const miniMapNodeColor = useCallback((node: Node) => {
    switch (node.type) {
      case 'templateNode': return '#6366f1'
      case 'platformNode': return '#3b82f6'
      case 'resultNode': return '#22c55e'
      default: return '#94a3b8'
    }
  }, [])

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Zap size={20} className="text-yellow-500" />
          <h2 className="text-lg font-bold text-gray-900">워크플로우</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            currentPhase === 'approval'
              ? 'bg-amber-100 text-amber-700'
              : currentPhase === 'pending'
                ? 'bg-red-100 text-red-700'
                : isRunning
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
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
        <div className="flex items-center gap-2">
          {currentPhase === 'approval' && pendingApprovals.length > 0 && (
            <>
              <button
                onClick={approveAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition"
              >
                <CheckCircle size={14} />
                전체 승인
              </button>
              <button
                onClick={rejectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 transition"
              >
                <XCircle size={14} />
                전체 거절
              </button>
              <div className="w-px h-6 bg-gray-300 mx-1" />
            </>
          )}
          <button
            onClick={resetWorkflow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            <RotateCcw size={14} />
            초기화
          </button>
          <button
            onClick={runWorkflow}
            disabled={isRunning || currentPhase === 'approval' || !analysisResult}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm text-white rounded-lg transition ${
              isRunning || currentPhase === 'approval' || !analysisResult
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            <Play size={14} />
            {isRunning ? '변환 중...' : !analysisResult ? 'URL 입력 필요' : '실행'}
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
          <Background color="#e2e8f0" gap={20} size={1} />
          <Controls position="bottom-left" />
          <MiniMap
            nodeColor={miniMapNodeColor}
            maskColor="rgba(0, 0, 0, 0.1)"
            position="bottom-right"
            style={{ borderRadius: 8 }}
          />
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
      />

      {/* Analysis Result Modal */}
      {analysisModalOpen && analysisResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAnalysisModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-red-500 to-red-600">
              <div className="text-white">
                <h3 className="font-bold text-lg">Gemini 영상 분석 결과</h3>
                {videoInfo && <p className="text-red-100 text-sm truncate max-w-[400px]">{videoInfo.title}</p>}
              </div>
              <button onClick={() => setAnalysisModalOpen(false)} className="text-white/80 hover:text-white text-xl font-bold px-2">
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)] space-y-4">
              {/* 주제 + 요약 */}
              <div className="bg-red-50 rounded-xl p-4">
                <div className="text-xs font-semibold text-red-600 uppercase mb-1">주제</div>
                <div className="font-bold text-gray-900">{analysisResult.topic}</div>
                <div className="text-sm text-gray-700 mt-2">{analysisResult.summary}</div>
              </div>

              {/* 키워드 */}
              {analysisResult.keywords?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">키워드</div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.keywords.map((kw: string, i: number) => (
                      <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 분위기 + 타겟 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-50 rounded-xl p-3">
                  <div className="text-xs font-semibold text-purple-600 uppercase mb-1">분위기</div>
                  <div className="text-sm text-gray-800">{analysisResult.mood}</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3">
                  <div className="text-xs font-semibold text-green-600 uppercase mb-1">타겟층</div>
                  <div className="text-sm text-gray-800">{analysisResult.target_audience}</div>
                </div>
              </div>

              {/* 핵심 포인트 */}
              {analysisResult.key_points?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">핵심 포인트</div>
                  <ul className="space-y-1.5">
                    {analysisResult.key_points.map((point: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="w-5 h-5 flex-shrink-0 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                          {i + 1}
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 주요 장면 */}
              {analysisResult.scenes?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">주요 장면</div>
                  <ul className="space-y-1.5">
                    {analysisResult.scenes.map((scene: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-indigo-400 mt-0.5">&#9654;</span>
                        {scene}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 오디오 요약 */}
              {analysisResult.audio_summary && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">오디오/나레이션</div>
                  <div className="text-sm text-gray-700">{analysisResult.audio_summary}</div>
                </div>
              )}

              {/* 추천 스타일 */}
              {analysisResult.recommended_style && (
                <div className="bg-indigo-50 rounded-xl p-3">
                  <div className="text-xs font-semibold text-indigo-600 uppercase mb-1">추천 글 스타일</div>
                  <div className="text-sm text-gray-800">{analysisResult.recommended_style}</div>
                </div>
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
