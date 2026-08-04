import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  ADAPT_PROMPTS,
  ADAPT_VARIABLES,
  DEFAULT_BRAND_VOICE,
  PLATFORM_PROMPTS,
  TEMPLATE_VARIABLES,
} from '../_lib/prompts.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ detail: 'Method not allowed' })

  return res.status(200).json({
    brand_voice: DEFAULT_BRAND_VOICE,
    platforms: PLATFORM_PROMPTS,
    variables: TEMPLATE_VARIABLES,
    // 텍스트 모드(원문 유지 변환)용 템플릿
    adapt_platforms: ADAPT_PROMPTS,
    adapt_variables: ADAPT_VARIABLES,
  })
}
