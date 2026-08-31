import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabase } from '../_lib/clients.js'

export const VALID_PLATFORMS = [
  'naver_blog', 'linkedin', 'threads', 'instagram', 'instagram_reels',
  'tiktok', 'facebook', 'youtube_shorts', 'youtube', 'living_sequence_lab',
]

const EDITABLE_FIELDS = [
  'platform', 'post_url', 'title', 'posted_at', 'boosted', 'boost_spend',
  'boost_started_at', 'boost_ended_at', 'external_id', 'content_id', 'notes',
] as const

// 사용자가 부스트 금액을 직접 수정하면 수동 입력으로 표시 (광고 API 자동 수집이 덮어쓰지 않도록)
function markManualBoost(row: Record<string, unknown>) {
  if ('boost_spend' in row || 'boosted' in row) row.boost_source = 'manual'
  return row
}

function pickEditable(body: Record<string, unknown>) {
  const row: Record<string, unknown> = {}
  for (const f of EDITABLE_FIELDS) {
    if (f in body) row[f] = body[f]
  }
  return row
}

// 수치 스냅샷 조회/수동 입력 — 별도 함수였으나 Hobby 플랜 함수 개수 제한으로 통합
// (rewrite: /api/posts/metrics → /api/posts?metrics=1)
const METRIC_FIELDS = ['views', 'likes', 'comments', 'shares', 'saves'] as const

async function handleMetrics(
  sb: ReturnType<typeof getSupabase>,
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === 'GET') {
    const postId = Number(req.query.post_id)
    if (!postId) return res.status(400).json({ detail: 'post_id is required' })
    const { data, error } = await sb
      .from('post_metrics')
      .select('*')
      .eq('post_id', postId)
      .order('captured_at', { ascending: true })
    if (error) return res.status(500).json({ detail: error.message })
    return res.status(200).json({ metrics: data ?? [] })
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as Record<string, unknown>
    const postId = Number(body.post_id)
    if (!postId) return res.status(400).json({ detail: 'post_id is required' })

    const row: Record<string, unknown> = { post_id: postId, source: 'manual' }
    let hasValue = false
    for (const f of METRIC_FIELDS) {
      if (body[f] != null && body[f] !== '') {
        const n = Number(body[f])
        if (!Number.isNaN(n)) {
          row[f] = n
          hasValue = true
        }
      }
    }
    if (!hasValue) return res.status(400).json({ detail: '최소 한 개 이상의 수치를 입력하세요' })

    const { data, error } = await sb.from('post_metrics').insert(row).select()
    if (error || !data?.length) return res.status(500).json({ detail: error?.message ?? 'insert failed' })
    return res.status(200).json(data[0])
  }

  return res.status(405).json({ detail: 'Method not allowed' })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sb = getSupabase()

  if (req.query.metrics != null) return handleMetrics(sb, req, res)

  if (req.method === 'GET') {
    const { data: posts, error } = await sb
      .from('posts')
      .select('*')
      .order('posted_at', { ascending: false })
    if (error) return res.status(500).json({ detail: error.message })

    const ids = (posts ?? []).map((p) => p.id)
    let latestByPost: Record<number, Record<string, unknown>> = {}
    if (ids.length > 0) {
      const { data: metrics } = await sb
        .from('post_metrics')
        .select('*')
        .in('post_id', ids)
        .order('captured_at', { ascending: false })
        .limit(2000)
      latestByPost = {}
      for (const m of metrics ?? []) {
        if (!(m.post_id in latestByPost)) latestByPost[m.post_id] = m
      }
    }

    // 트래킹 링크 클릭수: content_id + platform 매칭
    const { data: links } = await sb
      .from('tracking_links')
      .select('content_id, platform, click_count')
    const clicksByKey: Record<string, number> = {}
    for (const l of links ?? []) {
      const key = `${l.content_id}|${l.platform}`
      clicksByKey[key] = (clicksByKey[key] ?? 0) + (l.click_count ?? 0)
    }

    const result = (posts ?? []).map((p) => ({
      ...p,
      latest: latestByPost[p.id] ?? null,
      clicks: p.content_id != null ? (clicksByKey[`${p.content_id}|${p.platform}`] ?? 0) : null,
    }))
    return res.status(200).json({ posts: result })
  }

  if (req.method === 'POST') {
    const body = (req.body ?? {}) as Record<string, unknown>
    const platform = String(body.platform ?? '')
    if (!VALID_PLATFORMS.includes(platform)) {
      return res.status(400).json({ detail: `지원하지 않는 플랫폼: ${platform}` })
    }
    const row = markManualBoost(pickEditable(body))
    const { data, error } = await sb.from('posts').insert(row).select()
    if (error || !data?.length) return res.status(500).json({ detail: error?.message ?? 'insert failed' })
    return res.status(200).json(data[0])
  }

  if (req.method === 'PATCH') {
    const body = (req.body ?? {}) as Record<string, unknown>
    const id = Number(body.id)
    if (!id) return res.status(400).json({ detail: 'id is required' })
    if ('platform' in body && !VALID_PLATFORMS.includes(String(body.platform))) {
      return res.status(400).json({ detail: `지원하지 않는 플랫폼: ${body.platform}` })
    }
    const { data, error } = await sb
      .from('posts')
      .update(markManualBoost(pickEditable(body)))
      .eq('id', id)
      .select()
    if (error) return res.status(500).json({ detail: error.message })
    if (!data?.length) return res.status(404).json({ detail: 'Post not found' })
    return res.status(200).json(data[0])
  }

  if (req.method === 'DELETE') {
    const id = Number(req.query.id)
    if (!id) return res.status(400).json({ detail: 'id is required' })
    const { error } = await sb.from('posts').delete().eq('id', id)
    if (error) return res.status(500).json({ detail: error.message })
    return res.status(200).json({ deleted: id })
  }

  return res.status(405).json({ detail: 'Method not allowed' })
}
