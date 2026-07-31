import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabase } from '../_lib/clients'

interface SaveBody {
  video_info?: Record<string, unknown>
  analysis?: Record<string, unknown>
  results?: Record<string, { status?: string; data?: unknown }>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  const body = (req.body ?? {}) as SaveBody
  const results = body.results ?? {}

  const generated: Record<string, unknown> = {}
  for (const [platform, payload] of Object.entries(results)) {
    if (payload && typeof payload === 'object' && payload.status === 'success') {
      generated[platform] = payload.data
    }
  }

  const analysis = body.analysis ?? {}
  const videoInfo = body.video_info ?? {}

  const row = {
    title: (videoInfo.title as string) || '제목 없음',
    description: (analysis.summary as string) ?? '',
    tags: Array.isArray(analysis.keywords) ? analysis.keywords : [],
    thumbnail_path: (videoInfo.thumbnail_url as string) ?? null,
    status: 'draft',
    workflow_data: {
      video_info: videoInfo,
      analysis,
      generated,
    },
  }

  const { data, error } = await getSupabase().from('contents').insert(row).select()
  if (error || !data?.length) {
    console.error('save failed:', error)
    return res.status(500).json({ detail: 'Failed to save content' })
  }
  return res.status(200).json({ content_id: data[0].id, status: 'draft' })
}
