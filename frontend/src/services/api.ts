const API_BASE = 'http://localhost:8000/api'

export const api = {
  // Contents
  getContents: async (params?: { status?: string; skip?: number; limit?: number }) => {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.skip) query.set('skip', params.skip.toString())
    if (params?.limit) query.set('limit', params.limit.toString())

    const response = await fetch(`${API_BASE}/contents/?${query}`)
    return response.json()
  },

  getContent: async (id: number) => {
    const response = await fetch(`${API_BASE}/contents/${id}`)
    return response.json()
  },

  createContent: async (formData: FormData) => {
    const response = await fetch(`${API_BASE}/contents/`, {
      method: 'POST',
      body: formData,
    })
    return response.json()
  },

  updateContent: async (id: number, data: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE}/contents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return response.json()
  },

  deleteContent: async (id: number) => {
    const response = await fetch(`${API_BASE}/contents/${id}`, {
      method: 'DELETE',
    })
    return response.json()
  },

  // Templates
  getTemplates: async (platform?: string) => {
    const query = platform ? `?platform=${platform}` : ''
    const response = await fetch(`${API_BASE}/templates/${query}`)
    return response.json()
  },

  createTemplate: async (data: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE}/templates/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return response.json()
  },

  updateTemplate: async (id: number, data: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE}/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return response.json()
  },

  deleteTemplate: async (id: number) => {
    const response = await fetch(`${API_BASE}/templates/${id}`, {
      method: 'DELETE',
    })
    return response.json()
  },

  // Platforms
  getPlatforms: async () => {
    const response = await fetch(`${API_BASE}/platforms/`)
    return response.json()
  },

  disconnectPlatform: async (platform: string) => {
    const response = await fetch(`${API_BASE}/platforms/${platform}/disconnect`, {
      method: 'POST',
    })
    return response.json()
  },

  // Upload
  startUpload: async (contentId: number, platforms: string[]) => {
    const response = await fetch(`${API_BASE}/upload/${contentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platforms }),
    })
    return response.json()
  },

  getUploadHistory: async (contentId: number) => {
    const response = await fetch(`${API_BASE}/upload/history/${contentId}`)
    return response.json()
  },

  retryUpload: async (historyId: number) => {
    const response = await fetch(`${API_BASE}/upload/retry/${historyId}`, {
      method: 'POST',
    })
    return response.json()
  },
}
