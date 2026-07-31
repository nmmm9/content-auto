import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabase } from '../_lib/clients.js'

const SUPPORTED_PLATFORMS = [
  'youtube', 'naver_blog', 'facebook', 'instagram', 'linkedin', 'living_sequence_lab',
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  const platform = String(req.query.platform ?? '')
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    return res.status(400).json({ detail: `Unsupported platform: ${platform}` })
  }

  const { data, error } = await getSupabase()
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
