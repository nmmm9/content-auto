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
    <div className={`px-5 py-4 rounded border-2 bg-paper-white min-w-[210px] ${
      allDone
        ? hasFailures
          ? 'border-danger'
          : 'border-success'
        : 'border-paper-gray'
    }`}>
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-paper-ink !border-2 !border-paper-white" />

      <div className="flex items-center gap-2 mb-3">
        <div className={`w-9 h-9 rounded flex items-center justify-center bg-paper-beige ${
          allDone
            ? hasFailures ? 'text-danger' : 'text-success'
            : 'text-muted-gray'
        }`}>
          <BarChart3 size={20} />
        </div>
        <div className="text-sm font-semibold text-muted-gray uppercase tracking-wider">결과</div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-success">
            <CheckCircle size={15} /> 성공
          </span>
          <span className="font-bold text-success text-base">{d.completed}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-danger">
            <XCircle size={15} /> 실패
          </span>
          <span className="font-bold text-danger text-base">{d.failed}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-ash-gray">
            <Clock size={15} /> 대기
          </span>
          <span className="font-bold text-muted-gray text-base">{d.pending}</span>
        </div>
      </div>
    </div>
  )
}
