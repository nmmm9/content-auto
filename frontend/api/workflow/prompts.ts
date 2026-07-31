import type { VercelRequest, VercelResponse } from '@vercel/node'
import { DEFAULT_BRAND_VOICE, PLATFORM_PROMPTS, TEMPLATE_VARIABLES } from '../_lib/prompts.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ detail: 'Method not allowed' })

  return res.status(200).json({
    brand_voice: DEFAULT_BRAND_VOICE,
    platforms: PLATFORM_PROMPTS,
    variables: TEMPLATE_VARIABLES,
  })
}
