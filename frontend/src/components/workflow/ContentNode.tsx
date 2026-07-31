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
    idle: 'border-paper-gray bg-paper-white',
    ready: 'border-paper-ink bg-paper-white',
    processing: 'border-paper-gray bg-paper-beige',
  }

  const status = d.status || 'idle'

  return (
    <div className={`px-5 py-4 rounded border-2 min-w-[200px] ${statusColors[status]}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-paper-beige rounded flex items-center justify-center text-ink">
          {icons[d.fileType || 'video']}
        </div>
        <div className="text-xs font-semibold text-muted-gray uppercase tracking-wider">콘텐츠 입력</div>
      </div>
      <div className="font-bold text-ink text-sm">{d.title || '새 콘텐츠'}</div>
      {d.fileName && (
        <div className="text-xs text-muted-gray mt-1 truncate max-w-[180px]">{d.fileName}</div>
      )}
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-paper-ink !border-2 !border-paper-white" />
    </div>
  )
}
