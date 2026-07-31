import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ANALYSIS_PROMPT } from '../_lib/prompts.js'
import { analyzeYoutubeUrl, GEMINI_DEFAULT_MODEL } from '../_lib/clients.js'

const VIDEO_ID_PATTERN = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  const { youtube_url: rawUrl, model } = (req.body ?? {}) as { youtube_url?: string; model?: string }
  const url = (rawUrl ?? '').trim()

  const match = url.match(VIDEO_ID_PATTERN)
  if (!match) return res.status(400).json({ detail: `Invalid YouTube URL: ${url}` })
  const videoId = match[1]

  try {
    // 1. oEmbed 메타데이터
    const oembed = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    )
    if (!oembed.ok) {
      return res.status(404).json({ detail: '영상을 찾을 수 없습니다' })
    }
    const meta = (await oembed.json()) as { title?: string; author_name?: string }
    const videoInfo = {
      video_id: videoId,
      title: meta.title ?? '',
      channel_name: meta.author_name ?? '',
      thumbnail_url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    }

    // 2. Gemini에 YouTube URL 직접 전달하여 분석
    let analysisModel = model || GEMINI_DEFAULT_MODEL
    if (!analysisModel.startsWith('gemini')) analysisModel = GEMINI_DEFAULT_MODEL
    const analysis = await analyzeYoutubeUrl(url, ANALYSIS_PROMPT, analysisModel)

    return res.status(200).json({ video_info: videoInfo, analysis })
  } catch (err) {
    console.error('analyze failed:', err)
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ detail: `AI 분석 오류: ${message.slice(0, 200)}` })
  }
}
