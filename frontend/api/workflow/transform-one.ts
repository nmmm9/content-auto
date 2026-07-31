import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PLATFORM_PROMPTS, buildFormatData, render } from '../_lib/prompts.js'
import { generateContent, OPENAI_DEFAULT_MODEL } from '../_lib/clients.js'

interface TransformOneBody {
  analysis?: Record<string, unknown>
  video_info?: { video_id?: string; title?: string }
  platform?: string
  model?: string
  youtube_url?: string
  brand_voice?: string
  custom_prompt?: { system?: string; user?: string } | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  const body = (req.body ?? {}) as TransformOneBody
  const platform = body.platform ?? ''
  const promptConfig = PLATFORM_PROMPTS[platform]
  if (!promptConfig) {
    return res.status(400).json({ detail: `지원하지 않는 플랫폼: ${platform}` })
  }

  // 구버전 프론트가 Gemini 모델명을 보내는 경우 기본 GPT 모델로 대체
  let model = body.model || OPENAI_DEFAULT_MODEL
  if (model.startsWith('gemini')) model = OPENAI_DEFAULT_MODEL

  const videoId = body.video_info?.video_id ?? ''
  const videoUrl = body.youtube_url || (videoId ? `https://youtu.be/${videoId}` : '')

  const systemTemplate = body.custom_prompt?.system || promptConfig.system
  const userTemplate = body.custom_prompt?.user || promptConfig.user

  const formatData = buildFormatData(
    body.analysis ?? {},
    body.video_info?.title ?? '',
    videoUrl,
    body.brand_voice ?? ''
  )

  try {
    const data = await generateContent(
      render(userTemplate, formatData),
      render(systemTemplate, formatData),
      model
    )
    return res.status(200).json({ platform, status: 'success', data })
  } catch (err) {
    console.error(`transform failed for ${platform}:`, err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(200).json({ platform, status: 'error', error: message.slice(0, 300) })
  }
}
