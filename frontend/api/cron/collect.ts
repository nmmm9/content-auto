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

/** TikTok Display API: video/list (계정 전체를 한 번에 받아 캐시) */
interface TiktokVideo {
  id: string
  title?: string
  view_count?: number
  like_count?: number
  comment_count?: number
  share_count?: number
  create_time?: number
  share_url?: string
}

let tiktokCache: Map<string, TiktokVideo> | null = null

async function fetchTiktokVideos(token: string): Promise<TiktokVideo[]> {
  const all: TiktokVideo[] = []
  let cursor: number | undefined
  for (let page = 0; page < 5; page++) {
    const json = await fetchJson(
      'https://open.tiktokapis.com/v2/video/list/?fields=id,title,view_count,like_count,comment_count,share_count,create_time,share_url',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cursor ? { max_count: 20, cursor } : { max_count: 20 }),
      }
    )
    const data = json.data as { videos?: TiktokVideo[]; has_more?: boolean; cursor?: number }
    all.push(...(data?.videos ?? []))
    if (!data?.has_more || !data.cursor) break
    cursor = data.cursor
  }
  return all
}

async function collectTiktok(externalId: string, token: string): Promise<Collected> {
  if (!tiktokCache) {
    tiktokCache = new Map((await fetchTiktokVideos(token)).map((v) => [v.id, v]))
  }
  const video = tiktokCache.get(externalId)
  if (!video) throw new Error('video not found in list')
  return {
    views: video.view_count,
    likes: video.like_count,
    comments: video.comment_count,
    shares: video.share_count,
    raw: video,
  }
}

/** TikTok 액세스 토큰 리프레시 (24시간 만료 — 매 실행마다 갱신) */
async function refreshTiktokToken(
  sb: Supabase,
  refreshToken: string
): Promise<{ token: string | null; refreshed: boolean }> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  if (!clientKey || !clientSecret) return { token: null, refreshed: false }
  try {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })
    const json = (await res.json()) as { access_token?: string; refresh_token?: string }
    if (!json.access_token) return { token: null, refreshed: false }
    await sb
      .from('platform_connections')
      .update({ access_token: json.access_token, refresh_token: json.refresh_token ?? refreshToken })
      .eq('platform', 'tiktok')
    return { token: json.access_token, refreshed: true }
  } catch (err) {
    console.warn('tiktok token refresh failed:', err instanceof Error ? err.message : err)
    return { token: null, refreshed: false }
  }
}

/** 새 TikTok 영상 자동 등록 */
async function syncTiktokPosts(sb: Supabase, token: string): Promise<number> {
  if (!tiktokCache) {
    tiktokCache = new Map((await fetchTiktokVideos(token)).map((v) => [v.id, v]))
  }
  const videos = [...tiktokCache.values()]
  if (videos.length === 0) return 0

  const { data: existing } = await sb.from('posts').select('external_id').eq('platform', 'tiktok')
  const known = new Set((existing ?? []).map((e) => e.external_id))
  const fresh = videos.filter((v) => !known.has(v.id))
  if (fresh.length === 0) return 0

  const { error } = await sb.from('posts').insert(
    fresh.map((v) => ({
      platform: 'tiktok',
      external_id: v.id,
      post_url: (v.share_url ?? '').split('?')[0],
      title: String(v.title ?? '').split('\n')[0].trim().slice(0, 60) || '영상',
      posted_at: v.create_time ? new Date(v.create_time * 1000).toISOString() : new Date().toISOString(),
    }))
  )
  if (error) throw new Error(error.message)
  return fresh.length
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

// ── Meta 광고 지출 (부스트한 게시물의 실제 집행액 자동 수집) ──

/** 광고 이름/게시물 제목 정규화 — 공백·기호 제거 후 앞부분 비교용 */
function normalizeForMatch(s: string): string {
  return String(s).replace(/\s+/g, '').replace(/[.,!?~·…"'"'()]/g, '').toLowerCase()
}

interface AdRow {
  name?: string
  creative?: { instagram_permalink_url?: string; effective_object_story_id?: string }
  insights?: {
    data?: Array<{
      spend?: string
      impressions?: string
      reach?: string
      clicks?: string
      video_play_actions?: Array<{ value?: string }>
    }>
  }
  campaign?: { lifetime_budget?: string; daily_budget?: string; budget_remaining?: string }
}

/** 광고 계정의 게시물별 집행액을 수집해 posts.boost_spend에 반영 */
async function collectAdSpend(
  sb: Supabase,
  token: string,
  adAccountId: string
): Promise<{ matched: number; totalSpend: number; unmatched: string[] }> {
  const json = await fetchJson(
    `https://graph.facebook.com/v23.0/${adAccountId}/ads?fields=id,name,creative{instagram_permalink_url,effective_object_story_id},campaign{lifetime_budget,daily_budget,budget_remaining},insights.date_preset(maximum){spend,impressions,reach,clicks,video_play_actions}&limit=100&access_token=${token}`
  )
  const ads = (json.data as AdRow[]) ?? []
  if (ads.length === 0) return { matched: 0, totalSpend: 0, unmatched: [] }

  const { data: posts } = await sb.from('posts').select('id, title, post_url, platform, posted_at')
  const rows = posts ?? []

  // 게시물 단위 집행액·예산 합산 (같은 게시물에 광고가 여러 개일 수 있음)
  const spendByPost = new Map<number, number>()
  const budgetByPost = new Map<number, number>()
  const paidViewsByPost = new Map<number, number>()
  const paidReachByPost = new Map<number, number>()
  const unmatched: string[] = []
  let totalSpend = 0

  for (const ad of ads) {
    const ins = ad.insights?.data?.[0]
    const spend = Number(ins?.spend ?? 0)
    if (!spend) continue
    totalSpend += spend
    // 캠페인 총 예산 (일예산만 설정된 경우 소진액 + 잔여로 추정)
    const budget = Number(ad.campaign?.lifetime_budget ?? 0)
    // 광고로 발생한 노출/도달 — 오가닉 조회수와 합쳐지지 않으므로 따로 저장
    const paidViews = Number(ins?.impressions ?? 0)
    const paidReach = Number(ins?.reach ?? 0)

    const permalink = ad.creative?.instagram_permalink_url ?? ''
    const shortcode = (permalink.match(/\/(?:p|reel)\/([^/?]+)/) ?? [])[1]
    const adName = normalizeForMatch(ad.name ?? '')

    // 광고가 어느 플랫폼 게시물인지 판별 — 다른 플랫폼의 동명 게시물에 잘못 붙는 것을 막는다
    const isInstagramAd = Boolean(permalink) || /instagram/i.test(ad.name ?? '')
    const targetPlatforms = isInstagramAd ? ['instagram', 'instagram_reels'] : ['facebook']
    const candidates = rows.filter((p) => targetPlatforms.includes(p.platform))

    // ① permalink 숏코드 일치 ② 광고명이 게시물 제목을 포함 (부스트 시 캡션이 광고명에 들어감)
    let hit = shortcode ? candidates.find((p) => String(p.post_url).includes(shortcode)) : undefined
    if (!hit) {
      const titleHits = candidates.filter((p) => {
        const t = normalizeForMatch(p.title ?? '')
        return t.length >= 6 && adName.includes(t)
      })
      // 제목이 같은 게시물이 여럿이면 가장 최근 것 하나만 (중복 배정 방지)
      hit = titleHits.sort(
        (a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
      )[0]
    }

    if (hit) {
      spendByPost.set(hit.id, (spendByPost.get(hit.id) ?? 0) + spend)
      if (budget > 0) budgetByPost.set(hit.id, (budgetByPost.get(hit.id) ?? 0) + budget)
      paidViewsByPost.set(hit.id, (paidViewsByPost.get(hit.id) ?? 0) + paidViews)
      paidReachByPost.set(hit.id, (paidReachByPost.get(hit.id) ?? 0) + paidReach)
    } else {
      unmatched.push(`${(ad.name ?? '').slice(0, 40)} (₩${spend.toLocaleString()})`)
    }
  }

  // 자동 수집분만 초기화 후 재적용 — 수동 입력값(boost_source='manual')은 보존
  await sb
    .from('posts')
    .update({ boosted: false, boost_spend: 0, boost_budget: 0, paid_views: 0, paid_reach: 0 })
    .eq('boost_source', 'meta_ads')

  for (const [postId, spend] of spendByPost) {
    await sb
      .from('posts')
      .update({
        boosted: true,
        boost_spend: spend,
        boost_budget: budgetByPost.get(postId) ?? 0,
        paid_views: paidViewsByPost.get(postId) ?? 0,
        paid_reach: paidReachByPost.get(postId) ?? 0,
        boost_source: 'meta_ads',
      })
      .eq('id', postId)
  }
  return { matched: spendByPost.size, totalSpend, unmatched }
}

/** 광고 계정 잔액·누적지출 수집 (선불 계정: 충전액 = 잔액 + 사용액) */
async function collectAdAccountStatus(
  sb: Supabase,
  token: string,
  adAccountId: string
): Promise<{ spent: number; balance: number; charged: number } | null> {
  const json = await fetchJson(
    `https://graph.facebook.com/v23.0/${adAccountId}?fields=amount_spent,spend_cap,is_prepay_account,funding_source_details&access_token=${token}`
  )
  const spent = Number(json.amount_spent ?? 0)
  // 선불 계정은 결제수단 표시 문자열에 사용 가능 잔액이 담긴다 (예: "사용 가능한 잔액(₩42,491 KRW)")
  const display = (json.funding_source_details as { display_string?: string })?.display_string ?? ''
  const balanceMatch = display.match(/([\d,]+)/)
  const balance = balanceMatch ? Number(balanceMatch[1].replace(/,/g, '')) : 0
  const charged = spent + balance

  if (!spent && !balance) return null

  const today = new Date().toISOString().slice(0, 10)
  await sb.from('account_metrics').upsert(
    [
      { platform: 'meta_ads', metric: 'spent', date: today, value: Math.round(spent) },
      { platform: 'meta_ads', metric: 'balance', date: today, value: Math.round(balance) },
      { platform: 'meta_ads', metric: 'charged', date: today, value: Math.round(charged) },
    ],
    { onConflict: 'platform,metric,date' }
  )
  return { spent, balance, charged }
}

/** 일별 광고 노출을 플랫폼별로 수집 — 일별 추이에서 자연 도달과 합산해 표시 */
async function collectDailyAdImpressions(
  sb: Supabase,
  token: string,
  adAccountId: string
): Promise<number> {
  const json = await fetchJson(
    `https://graph.facebook.com/v23.0/${adAccountId}/insights?fields=impressions&breakdowns=publisher_platform&time_increment=1&date_preset=last_30d&access_token=${token}`
  )
  const rows = (json.data as Array<{ date_start?: string; publisher_platform?: string; impressions?: string }>) ?? []
  // publisher_platform: facebook | instagram | messenger | audience_network
  const PLATFORM_MAP: Record<string, string> = { facebook: 'facebook', instagram: 'instagram' }
  const out = rows
    .filter((r) => r.date_start && PLATFORM_MAP[r.publisher_platform ?? ''])
    .map((r) => ({
      platform: PLATFORM_MAP[r.publisher_platform as string],
      metric: 'paid_views',
      date: r.date_start as string,
      value: Number(r.impressions ?? 0),
    }))
  if (out.length === 0) return 0
  const { error } = await sb
    .from('account_metrics')
    .upsert(out, { onConflict: 'platform,metric,date' })
  if (error) throw new Error(error.message)
  return out.length
}

/** Meta 사용자 토큰 갱신 (60일 만료 — 매일 연장해 사실상 무기한 유지) */
async function refreshMetaUserToken(sb: Supabase, token: string): Promise<string> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) return token
  try {
    const json = await fetchJson(
      `https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${token}`
    )
    const newToken = json.access_token as string | undefined
    if (newToken && newToken !== token) {
      await sb.from('platform_connections').update({ access_token: newToken }).eq('platform', 'meta_ads')
      return newToken
    }
  } catch (err) {
    console.warn('meta_ads token refresh skipped:', err instanceof Error ? err.message : err)
  }
  return token
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
    .select('platform, access_token, refresh_token, account_id, account_name')
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
    synced: { threads: 0, instagram: 0, facebook: 0, naver_blog: 0, tiktok: 0 },
    token_refreshed: { threads: false, instagram: false, tiktok: false },
    account_daily_points: 0,
    ad_spend: { matched: 0, total: 0, unmatched: [] as string[] },
    ad_account: null as { spent: number; balance: number; charged: number } | null,
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

  // TikTok: 액세스 토큰 리프레시(24시간 만료) + 새 영상 자동 등록
  const tiktokRefreshToken = (connections ?? []).find((c) => c.platform === 'tiktok')?.refresh_token
  if (tiktokRefreshToken) {
    const { token, refreshed } = await refreshTiktokToken(sb, tiktokRefreshToken)
    if (token) tokens.tiktok = token
    report.token_refreshed.tiktok = refreshed
  }
  if (tokens.tiktok) {
    try {
      report.synced.tiktok = await syncTiktokPosts(sb, tokens.tiktok)
    } catch (err) {
      report.failed.push(`tiktok sync: ${err instanceof Error ? err.message : String(err)}`)
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

  // Meta 광고 지출 — 부스트 게시물의 실제 집행액 반영 (수동 입력 불필요)
  const adsConn = (connections ?? []).find((c) => c.platform === 'meta_ads')
  if (adsConn?.access_token && adsConn.account_id) {
    try {
      const adToken = await refreshMetaUserToken(sb, adsConn.access_token)
      const r = await collectAdSpend(sb, adToken, adsConn.account_id)
      report.ad_spend = { matched: r.matched, total: r.totalSpend, unmatched: r.unmatched }
      const status = await collectAdAccountStatus(sb, adToken, adsConn.account_id)
      if (status) report.ad_account = status
      report.account_daily_points += await collectDailyAdImpressions(sb, adToken, adsConn.account_id)
    } catch (err) {
      report.failed.push(`ad spend: ${err instanceof Error ? err.message : String(err)}`)
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
