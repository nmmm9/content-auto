import { randomBytes } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabase } from '../_lib/clients'

const DESTINATION_URL = process.env.TRACKING_DESTINATION_URL || 'https://your-site.com'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  const contentId = Number(req.query.contentId)
  const { platforms } = (req.body ?? {}) as { platforms?: string[] }
  if (!contentId || !Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ detail: 'content id and platforms are required' })
  }

  const sb = getSupabase()
  const content = await sb.from('contents').select('id').eq('id', contentId).limit(1)
  if (!content.data?.length) {
    return res.status(404).json({ detail: 'Content not found' })
  }

  const results = []
  for (const platform of platforms) {
    const hist = await sb
      .from('upload_history')
      .insert({ content_id: contentId, platform, status: 'pending' })
      .select()
    if (hist.error || !hist.data?.length) {
      return res.status(500).json({ detail: hist.error?.message ?? 'Failed to create history' })
    }
    const historyId = hist.data[0].id

    const shortCode = randomBytes(6).toString('base64url')
    await sb.from('tracking_links').insert({
      upload_history_id: historyId,
      content_id: contentId,
      platform,
      short_code: shortCode,
      destination_url: DESTINATION_URL,
      utm_source: platform,
      utm_medium: 'social',
      utm_campaign: `content_${contentId}`,
    })

    results.push({
      platform,
      history_id: historyId,
      status: 'pending',
      tracking_url: `/t/${shortCode}`,
    })
  }

  await sb.from('contents').update({ status: 'uploading' }).eq('id', contentId)
  return res.status(200).json({ message: 'Upload started', results })
}
