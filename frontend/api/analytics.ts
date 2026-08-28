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
    // meta_ads는 광고 계정(인프라 연동)이라 콘텐츠 플랫폼 목록에서 제외
    sb.from('platform_connections').select('platform, is_connected, account_name, account_id')
      .neq('platform', 'meta_ads'),
    sb.from('posts').select('*').order('posted_at', { ascending: false }),
    sb.from('post_metrics').select('*').order('captured_at', { ascending: false }).limit(2000),
    sb.from('account_metrics').select('platform, metric, date, value')
      .gte('date', accountSince.toISOString().slice(0, 10))
      .order('date', { ascending: true }),
  ])

  // ── 계정 일별 API가 없는 플랫폼(틱톡·네이버): 게시물 스냅샷 합계의 전일 대비 증감으로 일별 추이 생성 ──
  const SNAPSHOT_DAILY_PLATFORMS = new Set(['tiktok', 'naver_blog'])
  const snapshotDaily: Array<{ platform: string; metric: string; date: string; value: number }> = []
  {
    const postPlatform = new Map<number, string>(
      (postsQ.data ?? []).map((p) => [p.id as number, p.platform as string])
    )
    // platform → date → postId → 그날의 마지막 누적 조회수
    const byPlatformDate = new Map<string, Map<string, Map<number, number>>>()
    for (const m of [...(metricsQ.data ?? [])].reverse()) {
      const platform = postPlatform.get(m.post_id)
      if (!platform || !SNAPSHOT_DAILY_PLATFORMS.has(platform)) continue
      const views = Number(m.views ?? 0)
      if (!m.captured_at) continue
      const date = String(m.captured_at).slice(0, 10)
      if (!byPlatformDate.has(platform)) byPlatformDate.set(platform, new Map())
      const dates = byPlatformDate.get(platform)!
      if (!dates.has(date)) dates.set(date, new Map())
      dates.get(date)!.set(m.post_id, views)
    }
    for (const [platform, dates] of byPlatformDate) {
      const sorted = [...dates.keys()].sort()
      let prevTotal: number | null = null
      for (const date of sorted) {
        const total = [...dates.get(date)!.values()].reduce((s, v) => s + v, 0)
        // 첫날은 증감을 알 수 없으므로 건너뛴다
        if (prevTotal != null) {
          snapshotDaily.push({ platform, metric: 'views', date, value: Math.max(0, total - prevTotal) })
        }
        prevTotal = total
      }
    }
  }

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
  interface PostAgg { count: number; views: number; paid: number; engage: number; clicks: number; spend: number }
  const emptyAgg = (): PostAgg => ({ count: 0, views: 0, paid: 0, engage: 0, clicks: 0, spend: 0 })

  const byPlatform: Record<string, PostAgg> = {}
  const boosted = emptyAgg()
  const organic = emptyAgg()

  const postRows = posts.map((p) => {
    const latest = latestByPost[p.id] ?? null
    const views = num(latest?.views)
    const paid = num(p.paid_views)
    const engage = num(latest?.likes) + num(latest?.comments) + num(latest?.shares) + num(latest?.saves)
    const postClicks = p.content_id != null ? (clicksByKey[`${p.content_id}|${p.platform}`] ?? 0) : 0
    return { post: p, views, paid, engage, clicks: postClicks }
  })

  for (const { post, views, paid, engage, clicks: pc } of postRows) {
    const agg = (byPlatform[post.platform] ??= emptyAgg())
    const target = post.boosted ? boosted : organic
    for (const a of [agg, target]) {
      a.count += 1
      a.views += views
      a.paid += paid
      a.engage += engage
      a.clicks += pc
      a.spend += num(post.boost_spend)
    }
  }

  // 상위 게시글은 자연+유료 합산 조회수 기준 (인앱 조회수 카운터와 같은 기준)
  const topPosts = postRows
    .sort((a, b) => (b.views + b.paid) - (a.views + a.paid))
    .slice(0, 5)
    .map(({ post, views, paid, engage, clicks: pc }) => ({
      id: post.id,
      title: post.title || post.post_url,
      platform: post.platform,
      post_url: post.post_url ?? '',
      boosted: post.boosted,
      views,
      paid,
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
    account_daily: [...(accountDailyQ.data ?? [])
      .filter((r) => r.platform !== 'meta_ads'), ...snapshotDaily],
    ad_account: (() => {
      // 광고 계정 잔액/충전/사용 — account_metrics의 최신 값
      const rows = (accountDailyQ.data ?? []).filter((r) => r.platform === 'meta_ads')
      if (rows.length === 0) return null
      const latest: Record<string, number> = {}
      for (const r of rows) latest[r.metric] = Number(r.value) // 날짜 오름차순이라 마지막이 최신
      return {
        charged: latest.charged ?? 0,
        spent: latest.spent ?? 0,
        balance: latest.balance ?? 0,
      }
    })(),
    posts: {
      total: {
        count: posts.length,
        views: postRows.reduce((s, r) => s + r.views, 0),
        paid: postRows.reduce((s, r) => s + r.paid, 0),
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
