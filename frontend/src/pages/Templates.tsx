import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Youtube, FileText, Facebook, Instagram } from 'lucide-react'

interface Template {
  id: number
  name: string
  platform: string
  title_template: string
  description_template: string
  tags_template: string
  is_default: boolean
}

const platformInfo: Record<string, { name: string; icon: typeof Youtube; color: string }> = {
  youtube: { name: 'YouTube', icon: Youtube, color: 'text-red-500' },
  naver_blog: { name: '네이버 블로그', icon: FileText, color: 'text-green-500' },
  facebook: { name: 'Facebook', icon: Facebook, color: 'text-blue-500' },
  instagram: { name: 'Instagram', icon: Instagram, color: 'text-pink-500' },
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    platform: 'youtube',
    title_template: '{{title}}',
    description_template: '{{description}}\n\n#{{tags}}',
    tags_template: '{{tags}}',
    is_default: false,
  })

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/templates/')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data)
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    }
  }

  const openModal = (template?: Template) => {
    if (template) {
      setEditingTemplate(template)
      setFormData({
        name: template.name,
        platform: template.platform,
        title_template: template.title_template || '',
        description_template: template.description_template || '',
        tags_template: template.tags_template || '',
        is_default: template.is_default,
      })
    } else {
      setEditingTemplate(null)
      setFormData({
        name: '',
        platform: 'youtube',
        title_template: '{{title}}',
        description_template: '{{description}}\n\n#{{tags}}',
        tags_template: '{{tags}}',
        is_default: false,
      })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingTemplate(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingTemplate
        ? `http://localhost:8000/api/templates/${editingTemplate.id}`
        : 'http://localhost:8000/api/templates/'

      const method = editingTemplate ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        fetchTemplates()
        closeModal()
      }
    } catch (error) {
      console.error('Failed to save template:', error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('템플릿을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`http://localhost:8000/api/templates/${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        fetchTemplates()
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">템플릿 관리</h2>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} />
          새 템플릿
        </button>
      </div>

      {/* Variable Info */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">사용 가능한 변수</h3>
        <div className="text-sm text-blue-700 space-x-4">
          <code className="bg-blue-100 px-2 py-1 rounded">{'{{title}}'}</code>
          <code className="bg-blue-100 px-2 py-1 rounded">{'{{description}}'}</code>
          <code className="bg-blue-100 px-2 py-1 rounded">{'{{tags}}'}</code>
          <code className="bg-blue-100 px-2 py-1 rounded">{'{{youtube_url}}'}</code>
        </div>
      </div>

      {/* Templates List */}
      <div className="grid grid-cols-2 gap-4">
        {templates.map((template) => {
          const platform = platformInfo[template.platform]
          const Icon = platform?.icon || FileText

          return (
            <div
              key={template.id}
              className="bg-white p-6 rounded-lg border border-gray-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Icon size={24} className={platform?.color || 'text-gray-500'} />
                  <div>
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    <p className="text-sm text-gray-500">{platform?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {template.is_default && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                      기본
                    </span>
                  )}
                  <button
                    onClick={() => openModal(template)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">제목: </span>
                  <code className="text-gray-700">{template.title_template}</code>
                </div>
                <div>
                  <span className="text-gray-500">설명: </span>
                  <code className="text-gray-700 line-clamp-2">{template.description_template}</code>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          템플릿이 없습니다. 새 템플릿을 추가해주세요.
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingTemplate ? '템플릿 수정' : '새 템플릿'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  템플릿 이름
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  플랫폼
                </label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  disabled={!!editingTemplate}
                >
                  {Object.entries(platformInfo).map(([key, info]) => (
                    <option key={key} value={key}>{info.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제목 템플릿
                </label>
                <input
                  type="text"
                  value={formData.title_template}
                  onChange={(e) => setFormData({ ...formData, title_template: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명 템플릿
                </label>
                <textarea
                  value={formData.description_template}
                  onChange={(e) => setFormData({ ...formData, description_template: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  태그 템플릿
                </label>
                <input
                  type="text"
                  value={formData.tags_template}
                  onChange={(e) => setFormData({ ...formData, tags_template: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="is_default" className="text-sm text-gray-700">
                  기본 템플릿으로 설정
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
