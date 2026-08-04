import { useState, useEffect, useCallback, useMemo } from 'react'
import { BarChart3, Plus, Trash2, Pencil, RefreshCw, X, ExternalLink, Megaphone, MousePointerClick, CloudDownload, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import CollectResultModal, { type CollectResult } from '../components/CollectResultModal'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const PLATFORM_LABELS: Record<string, string> = {
  naver_blog: '네이버 블로그',
  linkedin: 'LinkedIn',
  threads: 'Threads',
  instagram: 'Instagram',
  instagram_reels: 'IG Reels',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube_shorts: 'YT Shorts',
  youtube: 'YouTube',
  living_sequence_lab: 'LS Lab',
}

interface MetricSnapshot {
  id: number
  captured_at: string
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  source: string
}

interface Post {
  id: number
  platform: string
  post_url: string
  title: string
  posted_at: string
  boosted: boolean
  boost_spend: number
  boost_budget: number
  paid_views: number
  paid_reach: number
  external_id: string | null
  notes: string
  latest: MetricSnapshot | null
  clicks: number | null
}

type SortKey =
  | 'title' | 'platform' | 'posted_at' | 'views' | 'likes' | 'comments'
  | 'shares' | 'saves' | 'clicks' | 'paid' | 'total' | 'budget' | 'boost' | 'updated'

const COLUMNS: Array<{ key: SortKey; label: string; align: 'left' | 'right' }> = [
  { key: 'title', label: '게시글', align: 'left' },
  { key: 'platform', label: '플랫폼', align: 'left' },
  { key: 'posted_at', label: '게시일', align: 'right' },
  { key: 'views', label: '오가닉', align: 'right' },
  { key: 'paid', label: '광고', align: 'right' },
  { key: 'total', label: '총 도달', align: 'right' },
  { key: 'likes', label: '좋아요', align: 'right' },
  { key: 'comments', label: '댓글', align: 'right' },
  { key: 'shares', label: '공유', align: 'right' },
  { key: 'saves', label: '저장', align: 'right' },
  { key: 'clicks', label: '클릭', align: 'right' },
  { key: 'budget', label: '예산', align: 'right' },
  { key: 'boost', label: '사용', align: 'right' },
  { key: 'updated', label: '업데이트', align: 'right' },
]

const fmt = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString())
const fmtWon = (n: number) => (n > 0 ? `₩${Math.round(n).toLocaleString()}` : '–')
const fmtDate = (s: string) => new Date(s).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })

// ── 게시글 등록/수정 모달 ──

interface PostForm {
  platform: string
  title: string
  post_url: string
  posted_at: string
  boosted: boolean
  boost_spend: string
  external_id: string
}

const emptyForm = (): PostForm => ({
  platform: 'instagram',
  title: '',
  post_url: '',
  posted_at: new Date().toISOString().slice(0, 10),
  boosted: false,
  boost_spend: '',
  external_id: '',
})

function PostModal({ editing, onClose, onSaved }: {
  editing: Post | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<PostForm>(
    editing
      ? {
          platform: editing.platform,
          title: editing.title,
          post_url: editing.post_url,
          posted_at: editing.posted_at.slice(0, 10),
          boosted: editing.boosted,
          boost_spend: editing.boost_spend > 0 ? String(editing.boost_spend) : '',
          external_id: editing.external_id ?? '',
        }
      : emptyForm()
  )
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<PostForm>) => setForm((f) => ({ ...f, ...patch }))

  const submit = async () => {
    if (!form.title.trim() && !form.post_url.trim()) return
    setBusy(true)
    try {
      const body: Record<string, unknown> = {
        platform: form.platform,
        title: form.title.trim(),
        post_url: form.post_url.trim(),
        posted_at: new Date(form.posted_at).toISOString(),
        boosted: form.boosted,
        boost_spend: form.boosted && form.boost_spend ? Number(form.boost_spend) : 0,
        external_id: form.external_id.trim() || null,
      }
      const res = await fetch(`${API_BASE}/posts`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: editing.id, ...body } : body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onSaved()
      onClose()
    } catch (err) {
      console.error('post save failed:', err)
      alert('저장에 실패했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-paper-white rounded border border-paper-gray w-full max-w-[440px]">
        <div className="flex items-center justify-between px-5 py-3 bg-paper-ink">
          <h3 className="text-sm font-bold text-paper-white">{editing ? '게시글 수정' : '게시글 등록'}</h3>
          <button onClick={onClose} className="text-paper-white/60 hover:text-paper-white p-1"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">플랫폼</label>
              <select
                value={form.platform}
                onChange={(e) => set({ platform: e.target.value })}
                className="w-full px-2 py-2 text-sm border border-paper-gray rounded bg-paper-white"
              >
                {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">게시일</label>
              <input
                type="date"
                value={form.posted_at}
                onChange={(e) => set({ posted_at: e.target.value })}
                className="w-full px-2 py-2 text-sm border border-paper-gray rounded bg-paper-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">제목/메모</label>
            <input
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="예: 46평 리모델링 전후 릴스"
              className="w-full px-3 py-2 text-sm border border-paper-gray rounded bg-paper-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">게시글 URL</label>
            <input
              value={form.post_url}
              onChange={(e) => set({ post_url: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm border border-paper-gray rounded bg-paper-white font-mono text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">
              플랫폼 게시물 ID <span className="text-ash-gray font-normal">(API 자동수집용 — 선택)</span>
            </label>
            <input
              value={form.external_id}
              onChange={(e) => set({ external_id: e.target.value })}
              placeholder="미디어 ID (연동 후 입력)"
              className="w-full px-3 py-2 text-sm border border-paper-gray rounded bg-paper-white font-mono text-xs"
            />
          </div>
          <div className="border border-paper-beige rounded bg-paper-ivory p-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-charcoal cursor-pointer">
              <input
                type="checkbox"
                checked={form.boosted}
                onChange={(e) => set({ boosted: e.target.checked })}
              />
              <Megaphone size={14} />
              유료 부스트 (광고 집행)
            </label>
            {form.boosted && (
              <div className="mt-2">
                <label className="block text-xs font-semibold text-charcoal mb-1">집행 금액 (원)</label>
                <input
                  type="number"
                  value={form.boost_spend}
                  onChange={(e) => set({ boost_spend: e.target.value })}
                  placeholder="50000"
                  className="w-full px-3 py-2 text-sm border border-paper-gray rounded bg-paper-white"
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-paper-gray bg-paper-ivory">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-charcoal hover:bg-paper-beige rounded">취소</button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-4 py-1.5 text-xs font-bold text-ink rounded bg-lemon hover:opacity-80 disabled:opacity-50"
          >
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 수치 입력 모달 ──

function MetricModal({ post, onClose, onSaved }: {
  post: Post
  onClose: () => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({
    views: post.latest?.views != null ? String(post.latest.views) : '',
    likes: post.latest?.likes != null ? String(post.latest.likes) : '',
    comments: post.latest?.comments != null ? String(post.latest.comments) : '',
    shares: post.latest?.shares != null ? String(post.latest.shares) : '',
    saves: post.latest?.saves != null ? String(post.latest.saves) : '',
  })
  const [busy, setBusy] = useState(false)

  const FIELDS = [
    { key: 'views', label: '조회수' },
    { key: 'likes', label: '좋아요' },
    { key: 'comments', label: '댓글' },
    { key: 'shares', label: '공유' },
    { key: 'saves', label: '저장' },
  ]

  const submit = async () => {
    setBusy(true)
    try {
      const body: Record<string, unknown> = { post_id: post.id }
      for (const f of FIELDS) {
        if (values[f.key] !== '') body[f.key] = Number(values[f.key])
      }
      const res = await fetch(`${API_BASE}/posts/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onSaved()
      onClose()
    } catch (err) {
      console.error('metric save failed:', err)
      alert('수치 저장에 실패했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-paper-white rounded border border-paper-gray w-full max-w-[380px]">
        <div className="flex items-center justify-between px-5 py-3 bg-paper-ink">
          <div>
            <h3 className="text-sm font-bold text-paper-white">수치 입력</h3>
            <p className="text-[10px] text-paper-white/60 truncate max-w-[280px]">
              {PLATFORM_LABELS[post.platform]} · {post.title || post.post_url}
            </p>
          </div>
          <button onClick={onClose} className="text-paper-white/60 hover:text-paper-white p-1"><X size={16} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-charcoal mb-1">{f.label}</label>
              <input
                type="number"
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                placeholder="–"
                className="w-full px-3 py-2 text-sm border border-paper-gray rounded bg-paper-white"
              />
            </div>
          ))}
        </div>
        <p className="px-5 pb-2 text-[10px] text-muted-gray">현재 누적값을 그대로 입력하세요. 이력이 스냅샷으로 쌓여 추이를 볼 수 있습니다.</p>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-paper-gray bg-paper-ivory">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-charcoal hover:bg-paper-beige rounded">취소</button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-4 py-1.5 text-xs font-bold text-ink rounded bg-lemon hover:opacity-80 disabled:opacity-50"
          >
            {busy ? '저장 중…' : '기록'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ──

export default function Posts() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [boostFilter, setBoostFilter] = useState<'all' | 'boosted' | 'organic'>('all')
  const [adAccount, setAdAccount] = useState<{ charged: number; spent: number; balance: number } | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [editing, setEditing] = useState<Post | null>(null)
  const [metricPost, setMetricPost] = useState<Post | null>(null)
  const [collecting, setCollecting] = useState(false)
  const [collectResult, setCollectResult] = useState<CollectResult | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('views')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      // 텍스트 컬럼은 오름차순, 수치 컬럼은 내림차순이 자연스럽다
      setSortDir(key === 'title' || key === 'platform' ? 'asc' : 'desc')
    }
  }

  const load = useCallback(async () => {
    try {
      const [res, analyticsRes] = await Promise.all([
        fetch(`${API_BASE}/posts`),
        fetch(`${API_BASE}/analytics?days=30`).catch(() => null),
      ])
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPosts(data.posts ?? [])
      if (analyticsRes?.ok) {
        const a = await analyticsRes.json()
        setAdAccount(a.ad_account ?? null)
      }
    } catch (err) {
      console.error('load posts failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // 전 플랫폼 즉시 수집 (매일 06:00 크론과 동일한 작업을 수동 실행)
  const collectNow = async () => {
    if (collecting) return
    setCollecting(true)
    try {
      const res = await fetch(`${API_BASE}/cron/collect`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const r = (await res.json()) as CollectResult
      setCollectResult(r)
      if (!r.skipped) load()
    } catch (err) {
      console.error('collect failed:', err)
      setCollectResult({ error: err instanceof Error ? err.message : String(err) })
    } finally {
      setCollecting(false)
    }
  }

  const remove = async (post: Post) => {
    if (!confirm(`"${post.title || post.post_url}" 게시글과 수치 이력을 삭제할까요?`)) return
    await fetch(`${API_BASE}/posts?id=${post.id}`, { method: 'DELETE' })
    load()
  }

  const platformsPresent = useMemo(
    () => [...new Set(posts.map((p) => p.platform))],
    [posts]
  )

  const summary = useMemo(() => {
    const by: Record<string, { count: number; views: number; paid: number; engage: number; spend: number; clicks: number }> = {}
    for (const p of posts) {
      const s = (by[p.platform] ??= { count: 0, views: 0, paid: 0, engage: 0, spend: 0, clicks: 0 })
      s.count += 1
      s.views += p.latest?.views ?? 0
      s.paid += Number(p.paid_views) || 0
      s.engage += (p.latest?.likes ?? 0) + (p.latest?.comments ?? 0) + (p.latest?.shares ?? 0) + (p.latest?.saves ?? 0)
      s.spend += Number(p.boost_spend) || 0
      s.clicks += p.clicks ?? 0
    }
    return by
  }, [posts])

  const boostCount = useMemo(
    () => posts.filter((p) => p.boosted || Number(p.boost_spend) > 0).length,
    [posts]
  )

  const visible = useMemo(() => {
    let rows = filter === 'all' ? posts : posts.filter((p) => p.platform === filter)
    if (boostFilter !== 'all') {
      const isBoosted = (p: Post) => p.boosted || Number(p.boost_spend) > 0
      rows = rows.filter((p) => (boostFilter === 'boosted' ? isBoosted(p) : !isBoosted(p)))
    }
    const num = (v: number | null | undefined) => (v == null ? -1 : v) // 미수집(–)은 항상 뒤로
    const value = (p: Post): number | string => {
      switch (sortKey) {
        case 'title': return p.title || p.post_url || ''
        case 'platform': return PLATFORM_LABELS[p.platform] ?? p.platform
        case 'posted_at': return new Date(p.posted_at).getTime()
        case 'views': return num(p.latest?.views)
        case 'paid': return Number(p.paid_views) || 0
        case 'total': return (p.latest?.views ?? 0) + (Number(p.paid_views) || 0)
        case 'likes': return num(p.latest?.likes)
        case 'comments': return num(p.latest?.comments)
        case 'shares': return num(p.latest?.shares)
        case 'saves': return num(p.latest?.saves)
        case 'clicks': return num(p.clicks)
        case 'budget': return Number(p.boost_budget) || 0
        case 'boost': return Number(p.boost_spend) || 0
        case 'updated': return p.latest ? new Date(p.latest.captured_at).getTime() : -1
      }
    }
    return [...rows].sort((a, b) => {
      const av = value(a)
      const bv = value(b)
      const cmp = typeof av === 'string' || typeof bv === 'string'
        ? String(av).localeCompare(String(bv), 'ko')
        : av - bv
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [posts, filter, boostFilter, sortKey, sortDir])

  // 현재 보이는 목록 기준 합계 (부스트만 볼 때 효율 지표 계산용)
  const visibleTotals = useMemo(() => {
    const t = { count: visible.length, views: 0, paid: 0, engage: 0, clicks: 0, spend: 0 }
    for (const p of visible) {
      t.views += p.latest?.views ?? 0
      t.paid += Number(p.paid_views) || 0
      t.engage += (p.latest?.likes ?? 0) + (p.latest?.comments ?? 0) + (p.latest?.shares ?? 0) + (p.latest?.saves ?? 0)
      t.clicks += p.clicks ?? 0
      t.spend += Number(p.boost_spend) || 0
    }
    return t
  }, [visible])

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 xl:p-2.5 bg-paper-ink rounded">
            <BarChart3 className="text-paper-white w-5 h-5 xl:w-6 xl:h-6" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-lg xl:text-2xl font-extrabold tracking-tight text-ink">게시글 성과</h2>
            <p className="text-xs xl:text-sm text-muted-gray">플랫폼별 게시글 수치 · 부스트 지출 · 트래킹 클릭</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={collectNow}
            disabled={collecting}
            className="flex items-center gap-1.5 px-3 xl:px-4 py-2 xl:py-2.5 text-xs xl:text-sm font-bold text-paper-white bg-paper-ink rounded hover:bg-charcoal disabled:opacity-60"
          >
            <CloudDownload className={`w-3.5 h-3.5 xl:w-4 xl:h-4 ${collecting ? 'animate-bounce' : ''}`} />
            {collecting ? '수집 중… (최대 1~2분)' : '지금 수집'}
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 xl:px-4 py-2 xl:py-2.5 text-xs xl:text-sm font-semibold text-charcoal bg-paper-white border border-paper-gray rounded hover:bg-paper-beige"
          >
            <RefreshCw className="w-3.5 h-3.5 xl:w-4 xl:h-4" /> 새로고침
          </button>
          <button
            onClick={() => { setEditing(null); setRegisterOpen(true) }}
            className="flex items-center gap-1.5 px-4 xl:px-5 py-2 xl:py-2.5 text-xs xl:text-sm font-bold text-ink rounded bg-lemon hover:opacity-80"
          >
            <Plus className="w-3.5 h-3.5 xl:w-4 xl:h-4" /> 게시글 등록
          </button>
        </div>
      </div>

      {/* 플랫폼별 요약 */}
      {Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {Object.entries(summary).map(([platform, s]) => (
            <button
              key={platform}
              onClick={() => setFilter(filter === platform ? 'all' : platform)}
              className={`text-left bg-paper-white border rounded p-3.5 xl:p-4 transition-colors ${
                filter === platform ? 'border-paper-ink' : 'border-paper-gray hover:border-ash-gray'
              }`}
            >
              <div className="text-[10px] xl:text-xs font-bold text-muted-gray uppercase tracking-wider mb-1.5">
                {PLATFORM_LABELS[platform] ?? platform} · {s.count}건
              </div>
              <div className="text-lg xl:text-2xl font-extrabold text-ink">
                {(s.views + s.paid).toLocaleString()}
                <span className="text-[10px] xl:text-xs font-semibold text-ash-gray ml-1">총 도달</span>
              </div>
              {s.paid > 0 && (
                <div className="text-[10px] xl:text-[11px] text-muted-gray mt-0.5">
                  오가닉 {s.views.toLocaleString()} · <span className="text-danger font-semibold">광고 {s.paid.toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1 text-[11px] xl:text-xs text-charcoal">
                <span>참여 {s.engage.toLocaleString()}</span>
                {s.clicks > 0 && <span className="flex items-center gap-0.5"><MousePointerClick className="w-3 h-3" />{s.clicks.toLocaleString()}</span>}
                {s.spend > 0 && <span className="text-danger font-semibold">{fmtWon(s.spend)}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 필터 탭 */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 xl:px-4 py-1.5 xl:py-2 text-xs xl:text-sm font-semibold rounded border ${
            filter === 'all' ? 'bg-paper-ink text-paper-white border-paper-ink' : 'bg-paper-white text-charcoal border-paper-gray hover:bg-paper-beige'
          }`}
        >
          전체 {posts.length}
        </button>
        {platformsPresent.map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`px-3 xl:px-4 py-1.5 xl:py-2 text-xs xl:text-sm font-semibold rounded border ${
              filter === p ? 'bg-paper-ink text-paper-white border-paper-ink' : 'bg-paper-white text-charcoal border-paper-gray hover:bg-paper-beige'
            }`}
          >
            {PLATFORM_LABELS[p] ?? p}
          </button>
        ))}

        <div className="w-px h-6 bg-paper-gray mx-1" />

        {/* 과금(부스트) 필터 */}
        {([
          { key: 'all' as const, label: '전체' },
          { key: 'boosted' as const, label: `부스트 ${boostCount}` },
          { key: 'organic' as const, label: '오가닉' },
        ]).map((b) => (
          <button
            key={b.key}
            onClick={() => setBoostFilter(b.key)}
            className={`flex items-center gap-1 px-3 xl:px-4 py-1.5 xl:py-2 text-xs xl:text-sm font-semibold rounded border ${
              boostFilter === b.key
                ? b.key === 'boosted'
                  ? 'bg-danger text-paper-white border-danger'
                  : 'bg-paper-ink text-paper-white border-paper-ink'
                : 'bg-paper-white text-charcoal border-paper-gray hover:bg-paper-beige'
            }`}
          >
            {b.key === 'boosted' && <Megaphone size={12} />}
            {b.label}
          </button>
        ))}
      </div>

      {/* 부스트만 볼 때: 광고 계정 잔액 + 효율 요약 */}
      {boostFilter === 'boosted' && adAccount && (
        <div className="bg-paper-white border border-paper-gray rounded p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Megaphone size={13} className="text-danger" />
            <span className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">Meta 광고 계정</span>
          </div>
          <div className="flex items-end gap-6 flex-wrap">
            <div>
              <div className="text-[11px] text-muted-gray">총 충전</div>
              <div className="text-lg font-extrabold text-ink">₩{adAccount.charged.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-gray">사용</div>
              <div className="text-lg font-extrabold text-danger">₩{adAccount.spent.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-gray">잔액</div>
              <div className="text-lg font-extrabold text-success">₩{adAccount.balance.toLocaleString()}</div>
            </div>
            <div className="flex-1 min-w-[160px]">
              <div className="bg-paper-beige rounded-none h-2.5 overflow-hidden">
                <div
                  className="h-full bg-danger transition-all duration-700"
                  style={{ width: `${adAccount.charged > 0 ? Math.min(100, (adAccount.spent / adAccount.charged) * 100) : 0}%` }}
                />
              </div>
              <div className="text-[10px] text-ash-gray mt-1 text-right">
                {adAccount.charged > 0 ? `${((adAccount.spent / adAccount.charged) * 100).toFixed(0)}% 소진` : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {boostFilter === 'boosted' && visibleTotals.count > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          {[
            { label: '집행액', value: fmtWon(visibleTotals.spend), accent: 'text-danger' },
            { label: '광고 노출', value: visibleTotals.paid.toLocaleString(), accent: 'text-danger' },
            { label: '총 도달', value: (visibleTotals.views + visibleTotals.paid).toLocaleString(), accent: 'text-ink' },
            {
              label: '광고 노출당 비용',
              value: visibleTotals.paid > 0 ? `₩${(visibleTotals.spend / visibleTotals.paid).toFixed(1)}` : '–',
              accent: 'text-ink',
            },
            {
              label: '참여당 비용',
              value: visibleTotals.engage > 0 ? `₩${Math.round(visibleTotals.spend / visibleTotals.engage).toLocaleString()}` : '–',
              accent: 'text-ink',
            },
          ].map((s) => (
            <div key={s.label} className="bg-paper-white border border-paper-gray rounded p-3">
              <div className="text-[10px] font-bold text-muted-gray uppercase tracking-wider">{s.label}</div>
              <div className={`text-lg font-extrabold mt-0.5 ${s.accent}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 게시글 테이블 */}
      <div className="bg-paper-white border border-paper-gray rounded overflow-x-auto">
        <table className="w-full text-sm xl:text-base">
          <thead>
            <tr className="border-b border-paper-gray bg-paper-ivory text-[10px] xl:text-xs font-bold text-muted-gray uppercase tracking-wider">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`px-3 xl:px-4 py-2.5 xl:py-3 first:pl-4 cursor-pointer select-none hover:text-ink transition-colors ${
                    col.align === 'left' ? 'text-left' : 'text-right'
                  } ${sortKey === col.key ? 'text-ink' : ''}`}
                >
                  <span className={`inline-flex items-center gap-0.5 ${col.align === 'left' ? '' : 'flex-row-reverse'}`}>
                    {col.label}
                    {sortKey === col.key
                      ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                      : <ChevronsUpDown className="w-3 h-3 opacity-30" />}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={15} className="px-4 py-10 text-center text-sm text-ash-gray">불러오는 중…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={15} className="px-4 py-10 text-center text-sm text-ash-gray">
                등록된 게시글이 없습니다. 우측 상단 "게시글 등록"으로 시작하세요.
              </td></tr>
            ) : (
              visible.map((p) => (
                <tr key={p.id} className="border-b border-paper-beige last:border-0 hover:bg-paper-ivory/60">
                  <td className="px-4 xl:px-5 py-2.5 xl:py-3.5 max-w-[260px] xl:max-w-[360px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-ink truncate">{p.title || '(제목 없음)'}</span>
                      {p.post_url && (
                        <a href={p.post_url} target="_blank" rel="noreferrer" className="text-ash-gray hover:text-ink flex-shrink-0">
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 xl:px-4 py-2.5 xl:py-3.5">
                    <span className="px-1.5 xl:px-2 py-0.5 border border-paper-gray text-charcoal text-[10px] xl:text-xs rounded-none whitespace-nowrap">
                      {PLATFORM_LABELS[p.platform] ?? p.platform}
                    </span>
                  </td>
                  <td className="px-3 xl:px-4 py-2.5 xl:py-3.5 text-right text-xs xl:text-sm text-charcoal whitespace-nowrap">{fmtDate(p.posted_at)}</td>
                  <td className="px-3 xl:px-4 py-2.5 xl:py-3.5 text-right font-semibold text-ink">{fmt(p.latest?.views)}</td>
                  <td className="px-3 xl:px-4 py-2.5 xl:py-3.5 text-right text-danger font-semibold">
                    {Number(p.paid_views) > 0 ? fmt(Number(p.paid_views)) : '–'}
                  </td>
                  <td className="px-3 xl:px-4 py-2.5 xl:py-3.5 text-right font-extrabold text-ink">
                    {fmt((p.latest?.views ?? 0) + (Number(p.paid_views) || 0))}
                  </td>
                  <td className="px-3 xl:px-4 py-2.5 xl:py-3.5 text-right text-charcoal">{fmt(p.latest?.likes)}</td>
                  <td className="px-3 xl:px-4 py-2.5 xl:py-3.5 text-right text-charcoal">{fmt(p.latest?.comments)}</td>
                  <td className="px-3 xl:px-4 py-2.5 xl:py-3.5 text-right text-charcoal">{fmt(p.latest?.shares)}</td>
                  <td className="px-3 xl:px-4 py-2.5 xl:py-3.5 text-right text-charcoal">{fmt(p.latest?.saves)}</td>
                  <td className="px-3 xl:px-4 py-2.5 xl:py-3.5 text-right text-charcoal">{p.clicks == null ? '–' : fmt(p.clicks)}</td>
                  <td className="px-3 xl:px-4 py-2.5 xl:py-3.5 text-right text-xs xl:text-sm text-charcoal whitespace-nowrap">
                    {Number(p.boost_budget) > 0 ? fmtWon(Number(p.boost_budget)) : '–'}
                  </td>
                  <td className="px-3 xl:px-4 py-2.5 xl:py-3.5 text-right whitespace-nowrap">
                    {p.boosted ? (
                      <div className="inline-flex flex-col items-end gap-0.5">
                        <span className="inline-flex items-center gap-1 text-[11px] xl:text-sm font-semibold text-danger">
                          <Megaphone size={11} />{fmtWon(Number(p.boost_spend))}
                        </span>
                        {Number(p.boost_budget) > 0 && (
                          <div className="w-16">
                            <div className="bg-paper-beige h-1 overflow-hidden">
                              <div
                                className="h-full bg-danger"
                                style={{ width: `${Math.min(100, (Number(p.boost_spend) / Number(p.boost_budget)) * 100)}%` }}
                              />
                            </div>
                            <div className="text-[9px] text-ash-gray text-right leading-tight">
                              {Math.min(100, (Number(p.boost_spend) / Number(p.boost_budget)) * 100).toFixed(0)}%
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] xl:text-xs text-ash-gray">오가닉</span>
                    )}
                  </td>
                  <td className="px-3 xl:px-4 py-2.5 xl:py-3.5 text-right text-[11px] xl:text-xs text-ash-gray whitespace-nowrap">
                    {p.latest ? `${fmtDate(p.latest.captured_at)} ${p.latest.source === 'api' ? '자동' : '수동'}` : '기록 없음'}
                  </td>
                  <td className="px-3 xl:px-4 py-2.5 xl:py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setMetricPost(p)}
                        className="px-2 xl:px-3 py-1 xl:py-1.5 text-[11px] xl:text-xs font-semibold text-ink bg-lemon rounded hover:opacity-80 whitespace-nowrap"
                      >
                        수치 입력
                      </button>
                      <button
                        onClick={() => { setEditing(p); setRegisterOpen(true) }}
                        className="p-1.5 text-ash-gray hover:text-ink rounded hover:bg-paper-beige"
                        title="수정"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => remove(p)}
                        className="p-1.5 text-ash-gray hover:text-danger rounded hover:bg-paper-beige"
                        title="삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {collectResult && (
        <CollectResultModal result={collectResult} onClose={() => setCollectResult(null)} />
      )}

      {registerOpen && (
        <PostModal
          editing={editing}
          onClose={() => { setRegisterOpen(false); setEditing(null) }}
          onSaved={load}
        />
      )}
      {metricPost && (
        <MetricModal post={metricPost} onClose={() => setMetricPost(null)} onSaved={load} />
      )}
    </div>
  )
}
