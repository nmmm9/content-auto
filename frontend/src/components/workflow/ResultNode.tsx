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
    <div className={`px-5 py-4 rounded-xl border-2 shadow-lg min-w-[180px] ${
      allDone
        ? hasFailures
          ? 'border-yellow-400 bg-yellow-50'
          : 'border-green-400 bg-green-50'
        : 'border-gray-200 bg-white'
    }`}>
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white" />

      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          allDone
            ? hasFailures ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'
            : 'bg-gray-100 text-gray-500'
        }`}>
          <BarChart3 size={18} />
        </div>
        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">결과</div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle size={12} /> 성공
          </span>
          <span className="font-bold text-green-700">{d.completed}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-red-500">
            <XCircle size={12} /> 실패
          </span>
          <span className="font-bold text-red-600">{d.failed}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-gray-400">
            <Clock size={12} /> 대기
          </span>
          <span className="font-bold text-gray-500">{d.pending}</span>
        </div>
      </div>
    </div>
  )
}
