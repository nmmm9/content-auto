import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabase } from '../_lib/clients.js'

const METRIC_FIELDS = ['views', 'likes', 'comments', 'shares', 'saves'] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sb = getSupabase()

  if (req.method === 'GET') {
    const postId = Number(req.query.post_id)
    if (!postId) return res.status(400).json({ detail: 'post_id is required' })
    const { data, error } = await sb
      .from('post_metrics')
      .select('*')
      .eq('post_id', postId)
      .order('captured_at', { ascending: true })
    if (error) return res.status(500).json({ detail: error.message })
    return res.status(200).json({ metrics: data ?? [] })
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as Record<string, unknown>
    const postId = Number(body.post_id)
    if (!postId) return res.status(400).json({ detail: 'post_id is required' })

    const row: Record<string, unknown> = { post_id: postId, source: 'manual' }
    let hasValue = false
    for (const f of METRIC_FIELDS) {
      if (body[f] != null && body[f] !== '') {
        const n = Number(body[f])
        if (!Number.isNaN(n)) {
          row[f] = n
          hasValue = true
        }
      }
    }
    if (!hasValue) return res.status(400).json({ detail: '최소 한 개 이상의 수치를 입력하세요' })

    const { data, error } = await sb.from('post_metrics').insert(row).select()
    if (error || !data?.length) return res.status(500).json({ detail: error?.message ?? 'insert failed' })
    return res.status(200).json(data[0])
  }

  return res.status(405).json({ detail: 'Method not allowed' })
}
