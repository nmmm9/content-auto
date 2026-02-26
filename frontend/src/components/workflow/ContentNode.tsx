import { Handle, Position, type NodeProps } from '@xyflow/react'
import { FileVideo, FileImage, FileText } from 'lucide-react'

interface ContentNodeData {
  label: string
  title?: string
  fileType?: 'video' | 'image' | 'text'
  fileName?: string
  status?: 'idle' | 'ready' | 'processing'
}

export default function ContentNode({ data }: NodeProps) {
  const d = data as unknown as ContentNodeData
  const icons = {
    video: <FileVideo size={20} />,
    image: <FileImage size={20} />,
    text: <FileText size={20} />,
  }

  const statusColors = {
    idle: 'border-gray-300 bg-white',
    ready: 'border-blue-400 bg-blue-50',
    processing: 'border-yellow-400 bg-yellow-50',
  }

  const status = d.status || 'idle'

  return (
    <div className={`px-5 py-4 rounded-xl border-2 shadow-lg min-w-[200px] ${statusColors[status]}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
          {icons[d.fileType || 'video']}
        </div>
        <div className="text-xs font-semibold text-purple-600 uppercase tracking-wider">콘텐츠 입력</div>
      </div>
      <div className="font-bold text-gray-900 text-sm">{d.title || '새 콘텐츠'}</div>
      {d.fileName && (
        <div className="text-xs text-gray-500 mt-1 truncate max-w-[180px]">{d.fileName}</div>
      )}
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white" />
    </div>
  )
}
