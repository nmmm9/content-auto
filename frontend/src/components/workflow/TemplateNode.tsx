import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Sparkles, Loader2, ChevronDown } from 'lucide-react'

interface TemplateNodeData {
  label: string
  templateName?: string
  status?: 'idle' | 'processing' | 'done'
  model?: string
}

const MODEL_OPTIONS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: '무료', tagColor: 'border border-paper-gray text-success' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tag: '무료(제한)', tagColor: 'border border-paper-gray text-charcoal' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', tag: '유료', tagColor: 'border border-paper-gray text-muted-gray' },
]

export default function TemplateNode({ data }: NodeProps) {
  const d = data as unknown as TemplateNodeData
  const status = d.status || 'idle'
  const currentModel = d.model || 'gemini-2.5-flash'

  const selectedOption = MODEL_OPTIONS.find((m) => m.id === currentModel) || MODEL_OPTIONS[0]

  const statusStyles = {
    idle: 'border-paper-gray bg-paper-white',
    processing: 'border-paper-ink bg-paper-beige',
    done: 'border-success bg-paper-white',
  }

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value
    if (window.workflowEvents) {
      window.workflowEvents.emit('model-change', newModel)
    }
  }

  return (
    <div className={`px-5 py-4 rounded border-2 min-w-[220px] ${statusStyles[status]}`}>
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-paper-ink !border-2 !border-paper-white" />

      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-paper-beige rounded flex items-center justify-center text-ink">
          {status === 'processing' ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Sparkles size={18} />
          )}
        </div>
        <div className="text-xs font-semibold text-muted-gray uppercase tracking-wider">AI 변환</div>
      </div>

      <div className="font-bold text-ink text-sm mb-2">
        {status === 'processing' ? 'Gemini 변환 중...' : 'Gemini 콘텐츠 변환'}
      </div>

      {/* 모델 선택기 */}
      {status === 'idle' ? (
        <div className="relative mb-2">
          <select
            value={currentModel}
            onChange={handleModelChange}
            className="w-full appearance-none pl-2 pr-7 py-1.5 text-xs border border-paper-gray rounded bg-paper-white focus:ring-1 focus:ring-paper-ink focus:border-paper-ink cursor-pointer nowheel nodrag"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.tag})
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-gray pointer-events-none" />
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs text-charcoal">{selectedOption.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-none ${selectedOption.tagColor}`}>
            {selectedOption.tag}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        <span className="px-1.5 py-0.5 border border-paper-gray text-charcoal text-[10px] rounded-none">
          영상 분석
        </span>
        <span className="px-1.5 py-0.5 border border-paper-gray text-charcoal text-[10px] rounded-none">
          플랫폼 변환
        </span>
        <span className="px-1.5 py-0.5 border border-paper-gray text-charcoal text-[10px] rounded-none">
          해시태그
        </span>
      </div>

      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-paper-ink !border-2 !border-paper-white" />
    </div>
  )
}
