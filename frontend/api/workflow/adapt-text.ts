import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PLATFORM_PROMPTS, buildAdaptMessages } from '../_lib/prompts.js'
import { generateContent, OPENAI_DEFAULT_MODEL } from '../_lib/clients.js'

// 텍스트 경량 변환 — 입력한 원문을 내용 유지한 채 플랫폼 형식만 다듬는다 (기획 분석 없음)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  const body = (req.body ?? {}) as {
    text?: string
    platform?: string
    model?: string
    brand_voice?: string
    custom_prompt?: { system?: string; user?: string } | null
  }
  const text = String(body.text ?? '').trim()
  const platform = body.platform ?? ''

  if (text.length < 2) return res.status(400).json({ detail: '원문을 입력하세요' })
  if (!PLATFORM_PROMPTS[platform]) {
    return res.status(400).json({ detail: `지원하지 않는 플랫폼: ${platform}` })
  }

  let model = body.model || OPENAI_DEFAULT_MODEL
  if (model.startsWith('gemini')) model = OPENAI_DEFAULT_MODEL

  const { system, user } = buildAdaptMessages(platform, text, body.brand_voice ?? '', body.custom_prompt)

  try {
    const data = await generateContent(user, system, model)
    return res.status(200).json({ platform, status: 'success', data })
  } catch (err) {
    console.error(`adapt-text failed for ${platform}:`, err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(200).json({ platform, status: 'error', error: message.slice(0, 300) })
  }
}
