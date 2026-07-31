import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabase } from '../../_lib/clients'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return res.status(405).json({ detail: 'Method not allowed' })

  const contentId = Number(req.query.id)
  const { scheduled_at: scheduledAt } = (req.body ?? {}) as { scheduled_at?: string }
  if (!contentId || !scheduledAt) {
    return res.status(400).json({ detail: 'content id and scheduled_at are required' })
  }

  const { data, error } = await getSupabase()
    .from('contents')
    .update({ scheduled_at: scheduledAt, status: 'scheduled' })
    .eq('id', contentId)
    .select()

  if (error) return res.status(500).json({ detail: error.message })
  if (!data?.length) return res.status(404).json({ detail: 'Content not found' })
  return res.status(200).json(data[0])
}
