import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CheckCircle, XCircle, Clock, BarChart3 } from 'lucide-react'

interface ResultNodeData {
  label: string
  totalPlatforms: number
  completed: number
  failed: number
  pending: number
}

export default function ResultNode({ data }: NodeProps) {
  const d = data as unknown as ResultNodeData

  const allDone = d.completed + d.failed === d.totalPlatforms && d.totalPlatforms > 0
  const hasFailures = d.failed > 0

  return (
    <div className={`px-5 py-4 rounded border-2 bg-paper-white min-w-[180px] ${
      allDone
        ? hasFailures
          ? 'border-danger'
          : 'border-success'
        : 'border-paper-gray'
    }`}>
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-paper-ink !border-2 !border-paper-white" />

      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded flex items-center justify-center bg-paper-beige ${
          allDone
            ? hasFailures ? 'text-danger' : 'text-success'
            : 'text-muted-gray'
        }`}>
          <BarChart3 size={18} />
        </div>
        <div className="text-xs font-semibold text-muted-gray uppercase tracking-wider">결과</div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-success">
            <CheckCircle size={12} /> 성공
          </span>
          <span className="font-bold text-success">{d.completed}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-danger">
            <XCircle size={12} /> 실패
          </span>
          <span className="font-bold text-danger">{d.failed}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-ash-gray">
            <Clock size={12} /> 대기
          </span>
          <span className="font-bold text-muted-gray">{d.pending}</span>
        </div>
      </div>
    </div>
  )
}
