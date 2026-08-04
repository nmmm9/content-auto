import type { VercelRequest, VercelResponse } from '@vercel/node'
import { TEXT_ANALYSIS_PROMPT } from '../_lib/prompts.js'
import { generateContent, OPENAI_DEFAULT_MODEL } from '../_lib/clients.js'

// 영상 없이 주제/브리프 텍스트만으로 기획 분석 생성 → 이후 변환 파이프라인은 동일하게 사용

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  const { prompt, model } = (req.body ?? {}) as { prompt?: string; model?: string }
  const brief = String(prompt ?? '').trim()
  if (brief.length < 2) return res.status(400).json({ detail: '주제/브리프를 입력하세요' })

  let gptModel = model || OPENAI_DEFAULT_MODEL
  if (gptModel.startsWith('gemini')) gptModel = OPENAI_DEFAULT_MODEL

  try {
    const analysis = await generateContent(
      `## 주제/브리프\n${brief}`,
      TEXT_ANALYSIS_PROMPT,
      gptModel
    )
    return res.status(200).json({ analysis })
  } catch (err) {
    console.error('analyze-text failed:', err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ detail: `기획 분석 오류: ${message.slice(0, 200)}` })
  }
}
