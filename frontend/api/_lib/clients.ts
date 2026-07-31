// 서버 전용 클라이언트 (Gemini · OpenAI · Supabase service-role)
// 이 파일은 Vercel 함수에서만 import한다 — 브라우저 번들에 절대 포함 금지.
import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash'
export const OPENAI_DEFAULT_MODEL = 'gpt-5-mini'

// temperature 파라미터를 지원하지 않는 추론 모델 프리픽스
const NO_TEMPERATURE = /^(gpt-5|o1|o3|o4)/

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

let gemini: GoogleGenAI | null = null
let openai: OpenAI | null = null
// DB 생성 타입이 없으므로 any 스키마로 느슨하게 사용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabase: SupabaseClient<any, 'content'> | null = null

function getGemini(): GoogleGenAI {
  if (!gemini) gemini = new GoogleGenAI({ apiKey: requireEnv('GEMINI_API_KEY') })
  return gemini
}

function getOpenAI(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY'), maxRetries: 3 })
  return openai
}

export function getSupabase() {
  if (!supabase) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase = createClient<any, 'content'>(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        db: { schema: 'content' },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    )
  }
  return supabase
}

/** YouTube URL을 Gemini에 직접 전달하여 영상 분석 (다운로드 불필요) */
export async function analyzeYoutubeUrl(
  youtubeUrl: string,
  prompt: string,
  model: string = GEMINI_DEFAULT_MODEL
): Promise<Record<string, unknown>> {
  const response = await getGemini().models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { fileData: { fileUri: youtubeUrl, mimeType: 'video/*' } },
          { text: prompt },
        ],
      },
    ],
    config: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  })
  return JSON.parse(response.text ?? '{}')
}

/** 텍스트 기반 콘텐츠 생성 (플랫폼 변환용, OpenAI GPT + JSON 모드) */
export async function generateContent(
  prompt: string,
  systemInstruction: string,
  model: string = OPENAI_DEFAULT_MODEL
): Promise<Record<string, unknown>> {
  const response = await getOpenAI().chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    ...(NO_TEMPERATURE.test(model) ? {} : { temperature: 0.7 }),
  })
  return JSON.parse(response.choices[0]?.message?.content ?? '{}')
}
