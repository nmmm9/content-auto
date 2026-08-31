import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabase } from '../_lib/clients.js'

const SUPPORTED_PLATFORMS = [
  'youtube', 'youtube_shorts', 'naver_blog', 'facebook', 'instagram', 'instagram_reels',
  'threads', 'tiktok', 'linkedin', 'living_sequence_lab',
]

const COLUMNS = 'id, platform, is_connected, account_name, account_id'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sb = getSupabase()

  // 연동 해제 — 별도 함수였으나 Hobby 플랜 함수 개수 제한으로 통합
  // (rewrite: /api/platforms/:platform/disconnect → /api/platforms?platform=…&action=disconnect)
  if (req.method === 'POST' && String(req.query.action ?? '') === 'disconnect') {
    const platform = String(req.query.platform ?? '')
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      return res.status(400).json({ detail: `Unsupported platform: ${platform}` })
    }
    const { data, error } = await sb
      .from('platform_connections')
      .update({
        is_connected: false,
        access_token: null,
        refresh_token: null,
        account_name: null,
        account_id: null,
      })
      .eq('platform', platform)
      .select()
    if (error) return res.status(500).json({ detail: error.message })
    if (!data?.length) return res.status(404).json({ detail: 'Platform connection not found' })
    return res.status(200).json(data[0])
  }

  if (req.method !== 'GET') return res.status(405).json({ detail: 'Method not allowed' })
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
