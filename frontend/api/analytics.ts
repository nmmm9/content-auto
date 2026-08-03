import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabase } from './_lib/clients.js'

// 대시보드 통합 분석 — 콘텐츠 현황 + 링크 클릭 분석 + 게시글 성과를 한 번에.
// (프론트가 anon 키로 직접 읽던 것을 service_role 서버 집계로 이관 — RLS 이슈 해결)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ detail: 'Method not allowed' })

  const days = Math.max(1, Math.min(365, Number(req.query.days) || 30))
  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString()
  const todayStr = new Date().toISOString().slice(0, 10)

  const sb = getSupabase()

  const accountSince = new Date()
  accountSince.setDate(accountSince.getDate() - 30)

  const [contentsQ, clicksQ, linksQ, connectionsQ, postsQ, metricsQ, accountDailyQ] = await Promise.all([
    sb.from('contents').select('id, title, status, created_at').order('created_at', { ascending: false }),
    sb.from('click_events').select('content_id, platform, tracking_link_id, clicked_at').gte('clicked_at', sinceStr),
    sb.from('tracking_links').select('*').order('created_at', { ascending: false }),
    sb.from('platform_connections').select('platform, is_connected, account_name, account_id'),
    sb.from('posts').select('*').order('posted_at', { ascending: false }),
    sb.from('post_metrics').select('*').order('captured_at', { ascending: false }).limit(2000),
    sb.from('account_metrics').select('platform, metric, date, value')
      .gte('date', accountSince.toISOString().slice(0, 10))
      .order('date', { ascending: true }),
  ])

  const contents = contentsQ.data ?? []
  const clicks = clicksQ.data ?? []
  const links = linksQ.data ?? []
  const posts = postsQ.data ?? []
  const metrics = metricsQ.data ?? []

  // ── 콘텐츠 현황 ──
  const stats = {
    total: contents.length,
    completed: contents.filter((c) => c.status === 'completed').length,
    pending: contents.filter((c) => c.status === 'pending' || c.status === 'draft').length,
    failed: contents.filter((c) => c.status === 'failed').length,
  }
  const contentMap = new Map(contents.map((c) => [c.id, c.title]))

  // ── 링크 분석 ──
  const totalClicks = clicks.length
  const todayClicks = clicks.filter((c) => c.clicked_at?.slice(0, 10) === todayStr).length

  const platformCounts: Record<string, number> = {}
  for (const c of clicks) platformCounts[c.platform] = (platformCounts[c.platform] ?? 0) + 1
  const platformBreakdown = Object.entries(platformCounts)
    .map(([platform, count]) => ({
      platform,
      total_clicks: count,
      percentage: totalClicks > 0 ? Math.round((count / totalClicks) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total_clicks - a.total_clicks)

  const contentCounts: Record<number, { clicks: number; platforms: Set<string> }> = {}
  for (const c of clicks) {
    const e = (contentCounts[c.content_id] ??= { clicks: 0, platforms: new Set() })
    e.clicks += 1
    e.platforms.add(c.platform)
  }
  const topContent = Object.entries(contentCounts)
    .map(([id, info]) => ({
      content_id: Number(id),
      content_title: contentMap.get(Number(id)) ?? `콘텐츠 #${id}`,
      total_clicks: info.clicks,
      platforms: [...info.platforms],
    }))
    .sort((a, b) => b.total_clicks - a.total_clicks)
    .slice(0, 5)

  const dailyCounts: Record<string, number> = {}
  for (const c of clicks) {
    const day = c.clicked_at?.slice(0, 10)
    if (day) dailyCounts[day] = (dailyCounts[day] ?? 0) + 1
  }
  const dailyTrend = Object.entries(dailyCounts)
    .map(([date, click_count]) => ({ date, click_count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // 링크별 클릭수 (기간 무관 전체) — tracking_links.click_count는 DB 트리거 누적값 사용
  const trackingLinks = links.map((l) => ({ ...l, click_count: l.click_count ?? 0 }))

  // ── 게시글 성과 ──
  const latestByPost: Record<number, Record<string, unknown>> = {}
  for (const m of metrics) {
    if (!(m.post_id in latestByPost)) latestByPost[m.post_id] = m
  }
  const clicksByKey: Record<string, number> = {}
  for (const l of links) {
    const key = `${l.content_id}|${l.platform}`
    clicksByKey[key] = (clicksByKey[key] ?? 0) + (l.click_count ?? 0)
  }

  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
  interface PostAgg { count: number; views: number; engage: number; clicks: number; spend: number }
  const emptyAgg = (): PostAgg => ({ count: 0, views: 0, engage: 0, clicks: 0, spend: 0 })

  const byPlatform: Record<string, PostAgg> = {}
  const boosted = emptyAgg()
  const organic = emptyAgg()

  const postRows = posts.map((p) => {
    const latest = latestByPost[p.id] ?? null
    const views = num(latest?.views)
    const engage = num(latest?.likes) + num(latest?.comments) + num(latest?.shares) + num(latest?.saves)
    const postClicks = p.content_id != null ? (clicksByKey[`${p.content_id}|${p.platform}`] ?? 0) : 0
    return { post: p, views, engage, clicks: postClicks }
  })

  for (const { post, views, engage, clicks: pc } of postRows) {
    const agg = (byPlatform[post.platform] ??= emptyAgg())
    const target = post.boosted ? boosted : organic
    for (const a of [agg, target]) {
      a.count += 1
      a.views += views
      a.engage += engage
      a.clicks += pc
      a.spend += num(post.boost_spend)
    }
  }

  const topPosts = postRows
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map(({ post, views, engage, clicks: pc }) => ({
      id: post.id,
      title: post.title || post.post_url,
      platform: post.platform,
      post_url: post.post_url ?? '',
      boosted: post.boosted,
      views,
      engage,
      clicks: pc,
    }))

  const contentTitles: Record<number, string> = {}
  for (const c of contents) contentTitles[c.id] = c.title

  return res.status(200).json({
    stats,
    recent: contents.slice(0, 5),
    drafts: contents.filter((c) => c.status === 'draft'),
    content_titles: contentTitles,
    platforms: connectionsQ.data ?? [],
    analytics: {
      total_clicks: totalClicks,
      total_links: links.length,
      today_clicks: todayClicks,
      avg_clicks_per_link: links.length > 0 ? Math.round((totalClicks / links.length) * 10) / 10 : 0,
      platform_breakdown: platformBreakdown,
      top_content: topContent,
      daily_trend: dailyTrend,
    },
    tracking_links: trackingLinks,
    account_daily: accountDailyQ.data ?? [],
    posts: {
      total: {
        count: posts.length,
        views: postRows.reduce((s, r) => s + r.views, 0),
        engage: postRows.reduce((s, r) => s + r.engage, 0),
        spend: posts.reduce((s, p) => s + num(p.boost_spend), 0),
      },
      by_platform: Object.entries(byPlatform).map(([platform, agg]) => ({ platform, ...agg })),
      boosted,
      organic,
      top: topPosts,
    },
  })
}
