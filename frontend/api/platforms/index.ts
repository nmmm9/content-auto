import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabase } from '../_lib/clients.js'

const SUPPORTED_PLATFORMS = [
  'youtube', 'youtube_shorts', 'naver_blog', 'facebook', 'instagram', 'instagram_reels',
  'threads', 'tiktok', 'linkedin', 'living_sequence_lab',
]

const COLUMNS = 'id, platform, is_connected, account_name, account_id'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ detail: 'Method not allowed' })

  const sb = getSupabase()
  // meta_ads는 광고 계정(인프라 연동)이라 콘텐츠 플랫폼 목록에서 제외
  let { data, error } = await sb.from('platform_connections').select(COLUMNS).neq('platform', 'meta_ads')
  if (error) return res.status(500).json({ detail: error.message })

  const existing = new Set((data ?? []).map((row) => row.platform))
  const missing = SUPPORTED_PLATFORMS.filter((p) => !existing.has(p))
  if (missing.length > 0) {
    await sb
      .from('platform_connections')
      .insert(missing.map((p) => ({ platform: p, is_connected: false })))
    const refetch = await sb.from('platform_connections').select(COLUMNS)
    data = refetch.data
  }
  return res.status(200).json(data ?? [])
}
