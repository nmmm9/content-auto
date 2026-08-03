import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabase } from '../_lib/clients.js'

// 일일 수치 자동 수집 (Vercel Cron)
// - external_id가 등록된 게시글만 대상
// - platform_connections에 access_token이 연결된 플랫폼만 수집
// - 토큰이 없으면 조용히 skip (수동 입력으로 운영)

interface Collected {
  views?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  raw?: unknown
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, init)
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) throw new Error(JSON.stringify(json).slice(0, 300))
  return json
}

/** Threads: https://developers.facebook.com/docs/threads/insights */
async function collectThreads(externalId: string, token: string): Promise<Collected> {
  const json = await fetchJson(
    `https://graph.threads.net/v1.0/${externalId}/insights?metric=views,likes,replies,reposts&access_token=${token}`
  )
  const out: Collected = { raw: json }
  for (const item of (json.data as Array<Record<string, unknown>>) ?? []) {
    const value = Number(
      (item.values as Array<{ value?: number }>)?.[0]?.value ??
        (item as { total_value?: { value?: number } }).total_value?.value ?? 0
    )
    if (item.name === 'views') out.views = value
    if (item.name === 'likes') out.likes = value
    if (item.name === 'replies') out.comments = value
    if (item.name === 'reposts') out.shares = value
  }
  return out
}

/** Instagram 미디어 인사이트 (Instagram 로그인 토큰 — graph.instagram.com) */
async function collectInstagram(externalId: string, token: string): Promise<Collected> {
  const json = await fetchJson(
    `https://graph.instagram.com/v23.0/${externalId}/insights?metric=views,likes,comments,shares,saved&access_token=${token}`
  )
  const out: Collected = { raw: json }
  for (const item of (json.data as Array<Record<string, unknown>>) ?? []) {
    const value = Number((item.values as Array<{ value?: number }>)?.[0]?.value ?? 0)
    if (item.name === 'views') out.views = value
    if (item.name === 'likes') out.likes = value
    if (item.name === 'comments') out.comments = value
    if (item.name === 'shares') out.shares = value
    if (item.name === 'saved') out.saves = value
  }
  return out
}

/** Facebook 페이지 게시물 */
async function collectFacebook(externalId: string, token: string): Promise<Collected> {
  const json = await fetchJson(
    `https://graph.facebook.com/v23.0/${externalId}?fields=shares,likes.summary(true),comments.summary(true)&access_token=${token}`
  )
  const likes = (json.likes as { summary?: { total_count?: number } })?.summary?.total_count
  const comments = (json.comments as { summary?: { total_count?: number } })?.summary?.total_count
  const shares = (json.shares as { count?: number })?.count
  return { likes, comments, shares, raw: json }
}

/** TikTok Display API: video/query */
async function collectTiktok(externalId: string, token: string): Promise<Collected> {
  const json = await fetchJson(
    'https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters: { video_ids: [externalId] } }),
    }
  )
  const video = (json.data as { videos?: Array<Record<string, number>> })?.videos?.[0]
  if (!video) throw new Error('video not found')
  return {
    views: video.view_count,
    likes: video.like_count,
    comments: video.comment_count,
    shares: video.share_count,
    raw: json,
  }
}

const COLLECTORS: Record<string, (id: string, token: string) => Promise<Collected>> = {
  threads: collectThreads,
  instagram: collectInstagram,
  instagram_reels: collectInstagram,
  facebook: collectFacebook,
  tiktok: collectTiktok,
}

// platform_connections의 platform 키 매핑 (reels → instagram 토큰 공유)
const TOKEN_PLATFORM: Record<string, string> = {
  threads: 'threads',
  instagram: 'instagram',
  instagram_reels: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
}

type Supabase = ReturnType<typeof getSupabase>

/** Threads 장기 토큰 리프레시 (60일 만료 방지 — 매일 갱신).
 * 발급 후 24시간 미만인 토큰은 리프레시가 거부되므로 실패해도 기존 토큰으로 계속 진행. */
async function refreshThreadsToken(sb: Supabase, token: string): Promise<{ token: string; refreshed: boolean }> {
  try {
    const json = await fetchJson(
      `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${token}`
    )
    const newToken = json.access_token as string | undefined
    if (newToken && newToken !== token) {
      await sb.from('platform_connections').update({ access_token: newToken }).eq('platform', 'threads')
      return { token: newToken, refreshed: true }
    }
  } catch (err) {
    console.warn('threads token refresh skipped:', err instanceof Error ? err.message : err)
  }
  return { token, refreshed: false }
}

/** 새 Threads 게시물 자동 등록 — 계정 게시물 목록과 posts 테이블 대조 후 없는 것만 삽입 */
async function syncThreadsPosts(sb: Supabase, token: string): Promise<number> {
  const json = await fetchJson(
    `https://graph.threads.net/v1.0/me/threads?fields=id,text,permalink,timestamp&limit=50&access_token=${token}`
  )
  const items = (json.data as Array<{ id: string; text?: string; permalink?: string; timestamp?: string }>) ?? []
  if (items.length === 0) return 0

  const { data: existing } = await sb.from('posts').select('external_id').eq('platform', 'threads')
  const known = new Set((existing ?? []).map((e) => e.external_id))
  const fresh = items.filter((i) => !known.has(i.id))
  if (fresh.length === 0) return 0

  const { error } = await sb.from('posts').insert(
    fresh.map((i) => ({
      platform: 'threads',
      external_id: i.id,
      post_url: i.permalink ?? '',
      title: String(i.text ?? '').split('\n')[0].trim().slice(0, 60),
      posted_at: i.timestamp ?? new Date().toISOString(),
    }))
  )
  if (error) throw new Error(error.message)
  return fresh.length
}

/** Instagram 장기 토큰 리프레시 (60일 만료 방지 — 매일 갱신) */
async function refreshInstagramToken(sb: Supabase, token: string): Promise<{ token: string; refreshed: boolean }> {
  try {
    const json = await fetchJson(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`
    )
    const newToken = json.access_token as string | undefined
    if (newToken && newToken !== token) {
      await sb.from('platform_connections').update({ access_token: newToken }).eq('platform', 'instagram')
      return { token: newToken, refreshed: true }
    }
  } catch (err) {
    console.warn('instagram token refresh skipped:', err instanceof Error ? err.message : err)
  }
  return { token, refreshed: false }
}

/** 새 Instagram 게시물 자동 등록 — 릴스는 instagram_reels, 나머지는 instagram으로 분류 */
async function syncInstagramPosts(sb: Supabase, token: string): Promise<number> {
  const json = await fetchJson(
    `https://graph.instagram.com/v23.0/me/media?fields=id,caption,permalink,timestamp,media_product_type&limit=50&access_token=${token}`
  )
  const items = (json.data as Array<{
    id: string
    caption?: string
    permalink?: string
    timestamp?: string
    media_product_type?: string
  }>) ?? []
  if (items.length === 0) return 0

  const { data: existing } = await sb
    .from('posts')
    .select('external_id')
    .in('platform', ['instagram', 'instagram_reels'])
  const known = new Set((existing ?? []).map((e) => e.external_id))
  const fresh = items.filter((i) => !known.has(i.id))
  if (fresh.length === 0) return 0

  const { error } = await sb.from('posts').insert(
    fresh.map((i) => ({
      platform: i.media_product_type === 'REELS' ? 'instagram_reels' : 'instagram',
      external_id: i.id,
      post_url: i.permalink ?? '',
      title: String(i.caption ?? '').split('\n')[0].trim().slice(0, 60) || (i.media_product_type === 'REELS' ? '릴스' : '게시물'),
      posted_at: i.timestamp ?? new Date().toISOString(),
    }))
  )
  if (error) throw new Error(error.message)
  return fresh.length
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron 인증 (CRON_SECRET 설정 시)
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ detail: 'Unauthorized' })
  }

  const sb = getSupabase()

  const { data: connections } = await sb
    .from('platform_connections')
    .select('platform, access_token')
  const tokens: Record<string, string> = {}
  for (const c of connections ?? []) {
    if (c.access_token) tokens[c.platform] = c.access_token
  }

  const report = {
    collected: 0,
    skipped_no_token: 0,
    synced: { threads: 0, instagram: 0 },
    token_refreshed: { threads: false, instagram: false },
    failed: [] as string[],
  }

  // Threads: 토큰 리프레시 + 새 게시물 자동 등록
  if (tokens.threads) {
    const { token, refreshed } = await refreshThreadsToken(sb, tokens.threads)
    tokens.threads = token
    report.token_refreshed.threads = refreshed
    try {
      report.synced.threads = await syncThreadsPosts(sb, token)
    } catch (err) {
      report.failed.push(`threads sync: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Instagram: 토큰 리프레시 + 새 게시물 자동 등록 (릴스 포함)
  if (tokens.instagram) {
    const { token, refreshed } = await refreshInstagramToken(sb, tokens.instagram)
    tokens.instagram = token
    report.token_refreshed.instagram = refreshed
    try {
      report.synced.instagram = await syncInstagramPosts(sb, token)
    } catch (err) {
      report.failed.push(`instagram sync: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const { data: posts, error } = await sb
    .from('posts')
    .select('id, platform, external_id')
    .not('external_id', 'is', null)
  if (error) return res.status(500).json({ detail: error.message })

  for (const post of posts ?? []) {
    const collector = COLLECTORS[post.platform]
    const token = tokens[TOKEN_PLATFORM[post.platform] ?? '']
    if (!collector || !token) {
      report.skipped_no_token += 1
      continue
    }
    try {
      const m = await collectClamped(collector, post.external_id, token)
      await sb.from('post_metrics').insert({
        post_id: post.id,
        views: m.views ?? null,
        likes: m.likes ?? null,
        comments: m.comments ?? null,
        shares: m.shares ?? null,
        saves: m.saves ?? null,
        source: 'api',
        raw: m.raw ?? null,
      })
      report.collected += 1
    } catch (err) {
      report.failed.push(`post ${post.id} (${post.platform}): ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return res.status(200).json(report)
}

async function collectClamped(
  collector: (id: string, token: string) => Promise<Collected>,
  externalId: string,
  token: string
): Promise<Collected> {
  return await collector(externalId, token)
}
