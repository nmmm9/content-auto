import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Sparkles, Loader2, ChevronDown } from 'lucide-react'

interface TemplateNodeData {
  label: string
  templateName?: string
  status?: 'idle' | 'processing' | 'done'
  model?: string
  analysisModel?: string
}

// 영상 분석 (Gemini — YouTube URL 직접 이해는 Gemini만 가능)
const ANALYSIS_MODEL_OPTIONS = [
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', tag: '무료', tagColor: 'border border-paper-gray text-success' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', tag: '무료·경량', tagColor: 'border border-paper-gray text-charcoal' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: '10월 종료', tagColor: 'border border-paper-gray text-danger' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', tag: '유료', tagColor: 'border border-paper-gray text-muted-gray' },
]

// 플랫폼 변환 (OpenAI GPT)
const TRANSFORM_MODEL_OPTIONS = [
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', tag: '기본', tagColor: 'border border-paper-gray text-success' },
  { id: 'gpt-5', name: 'GPT-5', tag: '고품질', tagColor: 'border border-paper-gray text-charcoal' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', tag: '빠름·저렴', tagColor: 'border border-paper-gray text-muted-gray' },
]

function ModelSelect({
  label,
  value,
  options,
  editable,
  onChange,
}: {
  label: string
  value: string
  options: typeof ANALYSIS_MODEL_OPTIONS
  editable: boolean
  onChange: (v: string) => void
}) {
  const selected = options.find((m) => m.id === value) || options[0]
  return (
    <div className="mb-2.5">
      <div className="text-[11px] font-bold text-ash-gray uppercase tracking-wider mb-1">{label}</div>
      {editable ? (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full appearance-none pl-2.5 pr-8 py-2 text-sm border border-paper-gray rounded bg-paper-white focus:ring-1 focus:ring-paper-ink focus:border-paper-ink cursor-pointer nowheel nodrag"
          >
            {options.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.tag})
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-gray pointer-events-none" />
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-charcoal">{selected.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-none ${selected.tagColor}`}>
            {selected.tag}
          </span>
        </div>
      )}
    </div>
  )
}

export default function TemplateNode({ data }: NodeProps) {
  const d = data as unknown as TemplateNodeData
  const status = d.status || 'idle'
  const transformModel = d.model || 'gpt-5-mini'
  const analysisModel = d.analysisModel || 'gemini-3.5-flash'

  const statusStyles = {
    idle: 'border-paper-gray bg-paper-white',
    processing: 'border-paper-ink bg-paper-beige',
    done: 'border-success bg-paper-white',
  }

  const emit = (event: string, value: string) => {
    if (window.workflowEvents) {
      window.workflowEvents.emit(event, value)
    }
  }

  return (
    <div className={`px-5 py-4 rounded border-2 min-w-[260px] ${statusStyles[status]}`}>
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-paper-ink !border-2 !border-paper-white" />

      <div className="flex items-center gap-2 mb-2">
        <div className="w-9 h-9 bg-paper-beige rounded flex items-center justify-center text-ink">
          {status === 'processing' ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Sparkles size={20} />
          )}
        </div>
        <div className="text-sm font-semibold text-muted-gray uppercase tracking-wider">AI 변환</div>
      </div>

      <div className="font-bold text-ink text-base mb-2.5">
        {status === 'processing' ? 'GPT 변환 중...' : 'AI 콘텐츠 변환'}
      </div>

      <ModelSelect
        label="영상 분석 · Gemini"
        value={analysisModel}
        options={ANALYSIS_MODEL_OPTIONS}
        editable={status === 'idle'}
        onChange={(v) => emit('analysis-model-change', v)}
      />
      <ModelSelect
        label="플랫폼 변환 · GPT"
        value={transformModel}
        options={TRANSFORM_MODEL_OPTIONS}
        editable={status === 'idle'}
        onChange={(v) => emit('model-change', v)}
      />

      <div className="flex flex-wrap gap-1">
        <span className="px-2 py-0.5 border border-paper-gray text-charcoal text-xs rounded-none">
          영상 분석
        </span>
        <span className="px-2 py-0.5 border border-paper-gray text-charcoal text-xs rounded-none">
          플랫폼 변환
        </span>
        <span className="px-2 py-0.5 border border-paper-gray text-charcoal text-xs rounded-none">
          해시태그
        </span>
      </div>

      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-paper-ink !border-2 !border-paper-white" />
    </div>
  )
}
