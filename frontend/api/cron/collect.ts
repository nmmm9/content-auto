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

/** Facebook 페이지 게시물.
 * 주의: impressions 계열 메트릭은 2025-11~2026-06에 걸쳐 폐기 — 신형 `views` 메트릭 사용. */
async function collectFacebook(externalId: string, token: string): Promise<Collected> {
  const json = await fetchJson(
    `https://graph.facebook.com/v23.0/${externalId}?fields=shares,likes.summary(true),comments.summary(true)&access_token=${token}`
  )
  const likes = (json.likes as { summary?: { total_count?: number } })?.summary?.total_count
  const comments = (json.comments as { summary?: { total_count?: number } })?.summary?.total_count
  const shares = (json.shares as { count?: number })?.count

  // 조회수는 별도 인사이트 호출 — 신형 post_media_view 메트릭 (실패해도 나머지 수치는 유지)
  let views: number | undefined
  try {
    const insights = await fetchJson(
      `https://graph.facebook.com/v23.0/${externalId}/insights?metric=post_media_view&access_token=${token}`
    )
    const item = (insights.data as Array<{ name?: string; values?: Array<{ value?: number }> }>)?.[0]
    views = Number(item?.values?.[0]?.value ?? NaN) || undefined
  } catch {
    // 미지원 게시물이면 조회수 없이 진행
  }
  return { views, likes, comments, shares, raw: json }
}

// ── 네이버 블로그 (로그인 불필요 — RSS·공개 공감 API·페이지 HTML) ──

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .trim()
}

const naverLogNo = (url: string) =>
  (String(url).match(/blog\.naver\.com\/[^/?#]+\/(\d+)/) ?? [])[1]

/** 새 네이버 글 자동 등록 (RSS) */
async function syncNaverPosts(sb: Supabase, blogId: string): Promise<number> {
  const res = await fetch(`https://rss.blog.naver.com/${blogId}.xml`)
  if (!res.ok) throw new Error(`naver RSS HTTP ${res.status}`)
  const xml = await res.text()
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1])
  const rssPosts = items
    .map((item) => ({
      title: decodeXml((item.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? ''),
      link: decodeXml((item.match(/<link>([\s\S]*?)<\/link>/) ?? [])[1] ?? ''),
      pubDate: ((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) ?? [])[1] ?? '').trim(),
    }))
    .filter((p) => naverLogNo(p.link))

  const { data: existing } = await sb.from('posts').select('external_id').eq('platform', 'naver_blog')
  const known = new Set((existing ?? []).map((e) => e.external_id))
  const fresh = rssPosts.filter((p) => !known.has(naverLogNo(p.link)))
  if (fresh.length === 0) return 0

  const { error } = await sb.from('posts').insert(
    fresh.map((p) => ({
      platform: 'naver_blog',
      external_id: naverLogNo(p.link),
      post_url: p.link,
      title: p.title.slice(0, 60),
      posted_at: p.pubDate ? new Date(p.pubDate).toISOString() : new Date().toISOString(),
    }))
  )
  if (error) throw new Error(error.message)
  return fresh.length
}

/** 네이버 글 수치: 공감(공개 like API) + 댓글(페이지 HTML의 commentCount) */
async function collectNaver(blogId: string, logNo: string): Promise<Collected> {
  let likes: number | undefined
  try {
    const likeJson = await fetchJson(
      `https://apis.naver.com/blogserver/like/v1/search/contents?suppress_response_codes=true&pool=blogid&q=BLOG%5B${blogId}_${logNo}%5D&displayId=BLOG`
    )
    const reactions = (likeJson.contents as Array<{ reactions?: Array<{ count?: number }> }>)?.[0]?.reactions ?? []
    likes = reactions.reduce((s, r) => s + (r.count ?? 0), 0)
  } catch {
    // 공감 API 실패 시 댓글만 수집
  }

  let comments: number | undefined
  const pageRes = await fetch(`https://m.blog.naver.com/${blogId}/${logNo}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' },
    redirect: 'follow',
  })
  if (pageRes.ok) {
    const html = await pageRes.text()
    const m = html.match(/commentCount\D{0,5}(\d+)/)
    if (m) comments = Number(m[1])
  }

  if (likes == null && comments == null) throw new Error('네이버 수치 미검출')
  return { likes, comments }
}

/** 새 Facebook 페이지 게시물 자동 등록 */
async function syncFacebookPosts(sb: Supabase, token: string, pageId: string): Promise<number> {
  const json = await fetchJson(
    `https://graph.facebook.com/v23.0/${pageId}/posts?fields=id,message,permalink_url,created_time&limit=50&access_token=${token}`
  )
  const items = (json.data as Array<{
    id: string
    message?: string
    permalink_url?: string
    created_time?: string
  }>) ?? []
  if (items.length === 0) return 0

  const { data: existing } = await sb.from('posts').select('external_id').eq('platform', 'facebook')
  const known = new Set((existing ?? []).map((e) => e.external_id))
  const fresh = items.filter((i) => !known.has(i.id))
  if (fresh.length === 0) return 0

  const { error } = await sb.from('posts').insert(
    fresh.map((i) => ({
      platform: 'facebook',
      external_id: i.id,
      post_url: i.permalink_url ?? '',
      title: String(i.message ?? '').split('\n')[0].trim().slice(0, 60) || '게시물',
      posted_at: i.created_time ?? new Date().toISOString(),
    }))
  )
  if (error) throw new Error(error.message)
  return fresh.length
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

// ── 계정 단위 일별 시계열 (Meta insights: end_time은 PT 기준 하루 버킷의 끝) ──

interface DailyPoint { date: string; value: number }

function parseDailyValues(json: Record<string, unknown>): DailyPoint[] {
  const item = (json.data as Array<{ values?: Array<{ value?: number; end_time?: string }> }>)?.[0]
  return (item?.values ?? [])
    .filter((v) => v.end_time != null)
    .map((v) => ({
      // end_time에서 8시간을 빼면 해당 버킷의 실제 날짜(PT 기준)가 나온다
      date: new Date(new Date(v.end_time as string).getTime() - 8 * 3600 * 1000).toISOString().slice(0, 10),
      value: Number(v.value ?? 0),
    }))
}

/** 최근 14일 계정 일별 지표 수집 → account_metrics 업서트 */
async function collectAccountDaily(
  sb: Supabase,
  tokens: Record<string, string>,
  accountIds: Record<string, string>
): Promise<{ points: number; failed: string[] }> {
  const now = Math.floor(Date.now() / 1000)
  const since = now - 14 * 86400
  const failed: string[] = []
  const rows: Array<{ platform: string; metric: string; date: string; value: number }> = []

  const sources: Array<{ platform: string; metric: string; url: string | null }> = [
    {
      platform: 'threads',
      metric: 'views',
      url: tokens.threads
        ? `https://graph.threads.net/v1.0/me/threads_insights?metric=views&since=${since}&until=${now}&access_token=${tokens.threads}`
        : null,
    },
    {
      platform: 'instagram',
      metric: 'reach',
      url: tokens.instagram
        ? `https://graph.instagram.com/v23.0/me/insights?metric=reach&period=day&since=${since}&until=${now}&access_token=${tokens.instagram}`
        : null,
    },
    {
      platform: 'facebook',
      metric: 'views',
      url:
        tokens.facebook && accountIds.facebook
          ? `https://graph.facebook.com/v23.0/${accountIds.facebook}/insights?metric=page_media_view&period=day&since=${since}&until=${now}&access_token=${tokens.facebook}`
          : null,
    },
  ]

  for (const s of sources) {
    if (!s.url) continue
    try {
      const json = await fetchJson(s.url)
      for (const p of parseDailyValues(json)) {
        rows.push({ platform: s.platform, metric: s.metric, date: p.date, value: p.value })
      }
    } catch (err) {
      failed.push(`daily ${s.platform}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (rows.length > 0) {
    const { error } = await sb.from('account_metrics').upsert(rows, { onConflict: 'platform,metric,date' })
    if (error) failed.push(`daily upsert: ${error.message}`)
  }
  return { points: rows.length, failed }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron 인증 (CRON_SECRET 설정 시)
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ detail: 'Unauthorized' })
  }

  const sb = getSupabase()

  // 남용 방지: 최근 10분 내 수집 이력이 있으면 스킵 (실수 연타·외부 호출로 인한 API 버스트 차단)
  const { data: recentRun } = await sb
    .from('post_metrics')
    .select('captured_at')
    .eq('source', 'api')
    .order('captured_at', { ascending: false })
    .limit(1)
  const lastRunAt = recentRun?.[0]?.captured_at
  if (lastRunAt && Date.now() - new Date(lastRunAt).getTime() < 10 * 60 * 1000) {
    return res.status(200).json({
      skipped: 'cooldown',
      detail: '최근 10분 내에 이미 수집했습니다',
      last_collected_at: lastRunAt,
    })
  }

  const { data: connections } = await sb
    .from('platform_connections')
    .select('platform, access_token, account_id, account_name')
  const tokens: Record<string, string> = {}
  const accountIds: Record<string, string> = {}
  const accountNames: Record<string, string> = {}
  for (const c of connections ?? []) {
    if (c.access_token) tokens[c.platform] = c.access_token
    if (c.account_id) accountIds[c.platform] = c.account_id
    if (c.account_name) accountNames[c.platform] = c.account_name
  }
  const naverBlogId = accountNames.naver_blog

  const report = {
    collected: 0,
    skipped_no_token: 0,
    synced: { threads: 0, instagram: 0, facebook: 0, naver_blog: 0 },
    token_refreshed: { threads: false, instagram: false },
    account_daily_points: 0,
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

  // 네이버 블로그: RSS로 새 글 자동 등록 (로그인·토큰 불필요)
  if (naverBlogId) {
    try {
      report.synced.naver_blog = await syncNaverPosts(sb, naverBlogId)
    } catch (err) {
      report.failed.push(`naver sync: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Facebook: 새 게시물 자동 등록 (페이지 토큰은 무기한 — 리프레시 불필요)
  if (tokens.facebook && accountIds.facebook) {
    try {
      report.synced.facebook = await syncFacebookPosts(sb, tokens.facebook, accountIds.facebook)
    } catch (err) {
      report.failed.push(`facebook sync: ${err instanceof Error ? err.message : String(err)}`)
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

  // 계정 단위 일별 시계열 (최근 14일 업서트)
  const daily = await collectAccountDaily(sb, tokens, accountIds)
  report.account_daily_points = daily.points
  report.failed.push(...daily.failed)

  const { data: posts, error } = await sb
    .from('posts')
    .select('id, platform, external_id')
    .not('external_id', 'is', null)
  if (error) return res.status(500).json({ detail: error.message })

  for (const post of posts ?? []) {
    // 네이버는 토큰 없이 공개 엔드포인트로 수집
    if (post.platform === 'naver_blog') {
      if (!naverBlogId) {
        report.skipped_no_token += 1
        continue
      }
      try {
        const m = await collectNaver(naverBlogId, post.external_id)
        await sb.from('post_metrics').insert({
          post_id: post.id,
          views: null,
          likes: m.likes ?? null,
          comments: m.comments ?? null,
          shares: null,
          saves: null,
          source: 'api',
          raw: null,
        })
        report.collected += 1
      } catch (err) {
        report.failed.push(`post ${post.id} (naver_blog): ${err instanceof Error ? err.message : String(err)}`)
      }
      continue
    }

    const collector = COLLECTORS[post.platform]
    const token = tokens[TOKEN_PLATFORM[post.platform] ?? '']
    if (!collector || !token) {
      report.skipped_no_token += 1
      continue
    }
    try {
      // Meta API 버스트 완화 (게시물 간 짧은 간격)
      await new Promise((r) => setTimeout(r, 300))
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
