import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Youtube, FileText, Facebook, Instagram, CheckCircle, Clock, AlertCircle, Clapperboard, Film, AtSign, LayoutDashboard, CloudLightning, Activity, BarChart3, MousePointerClick, Link2, TrendingUp, Crown, Medal, Award, Linkedin, FlaskConical, Megaphone, ArrowRight, Music2, CloudDownload } from 'lucide-react'
import { api } from '../services/api'
import type { AnalyticsSummary } from '../types'

import CollectResultModal, { type CollectResult } from '../components/CollectResultModal'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

interface AccountDailyRow { platform: string; metric: string; date: string; value: number }

interface PostAgg { count: number; views: number; paid: number; engage: number; clicks: number; spend: number }
interface PostsSummary {
  total: { count: number; views: number; paid: number; engage: number; spend: number }
  by_platform: Array<{ platform: string } & PostAgg>
  boosted: PostAgg
  organic: PostAgg
  top: Array<{ id: number; title: string; platform: string; post_url: string; boosted: boolean; views: number; paid: number; engage: number; clicks: number }>
}

interface Stats {
  total: number
  completed: number
  pending: number
  failed: number
}

interface Content {
  id: number
  title: string
  status: string
  created_at: string
}

interface PlatformConnection {
  platform: string
  is_connected: boolean
  account_name?: string | null
  account_id?: string | null
}

// 플랫폼 연동 카드 클릭 시 이동할 실제 채널 URL (연동 정보 기반)
function platformChannelUrl(conn: PlatformConnection): string | null {
  const name = conn.account_name?.trim()
  switch (conn.platform) {
    case 'threads':
      return name ? `https://www.threads.net/@${name}` : null
    case 'instagram':
    case 'instagram_reels':
      return name ? `https://www.instagram.com/${name}/` : null
    case 'facebook':
      return conn.account_id ? `https://www.facebook.com/${conn.account_id}` : null
    case 'tiktok':
      return name ? `https://www.tiktok.com/@${name}` : null
    case 'naver_blog':
      return name ? `https://blog.naver.com/${name}` : null
    case 'meta_ads':
      return conn.account_id
        ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${conn.account_id.replace('act_', '')}`
        : null
    default:
      return null
  }
}

const trackingPlatformLabel: Record<string, string> = {
  youtube: 'YouTube', youtube_shorts: 'YouTube Shorts', naver_blog: '네이버 블로그',
  facebook: 'Facebook', instagram: 'Instagram', instagram_reels: 'Instagram Reels', threads: 'Threads',
  linkedin: 'LinkedIn', living_sequence_lab: 'Living Sequence Lab', tiktok: 'TikTok',
}
const trackingPlatformColor: Record<string, string> = {
  youtube: '#ef4444', youtube_shorts: '#f97316', naver_blog: '#22c55e',
  facebook: '#3b82f6', instagram: '#ec4899', instagram_reels: '#a855f7', threads: '#71717a',
  linkedin: '#1d4ed8', living_sequence_lab: '#10b981', tiktok: '#0c0c0c',
}

export default function Dashboard() {
  const [, setStats] = useState<Stats>({
    total: 0,
    completed: 0,
    pending: 0,
    failed: 0
  })

  const [recentContents, setRecentContents] = useState<Content[]>([])
  const [drafts, setDrafts] = useState<Content[]>([])
  const [scheduleDates, setScheduleDates] = useState<Record<number, string>>({})
  const [platforms, setPlatforms] = useState<PlatformConnection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [analyticsDays, setAnalyticsDays] = useState(30)
  const [trackingLinks, setTrackingLinks] = useState<Array<{
    id: number; content_id: number; platform: string; short_code: string;
    destination_url: string; click_count: number; utm_campaign: string; created_at: string
  }>>([])
  const [contentNames, setContentNames] = useState<Record<number, string>>({})
  const [linkFilter, setLinkFilter] = useState<'all' | string>('all')
  const [postsSummary, setPostsSummary] = useState<PostsSummary | null>(null)
  const [collecting, setCollecting] = useState(false)
  const [collectResult, setCollectResult] = useState<CollectResult | null>(null)
  const [accountDaily, setAccountDaily] = useState<AccountDailyRow[]>([])
  const [adAccount, setAdAccount] = useState<{ charged: number; spent: number; balance: number } | null>(null)
  const [hoverPoint, setHoverPoint] = useState<{
    platform: string
    date: string
    value: number
    x: number
    y: number
  } | null>(null)

  // 통합 분석 API 한 번으로 대시보드 데이터 전체 로드 (service_role 서버 집계)
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/analytics?days=${analyticsDays}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      setStats(data.stats)
      setRecentContents(data.recent ?? [])
      setDrafts(data.drafts ?? [])
      setPlatforms(data.platforms ?? [])
      setAnalytics(data.analytics ?? null)
      setContentNames(data.content_titles ?? {})
      setTrackingLinks(
        (data.tracking_links ?? []).sort(
          (a: { click_count: number }, b: { click_count: number }) => b.click_count - a.click_count
        )
      )
      setPostsSummary(data.posts ?? null)
      setAccountDaily(data.account_daily ?? [])
      setAdAccount(data.ad_account ?? null)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }, [analyticsDays])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 전 플랫폼 즉시 수집 (매일 06:00 크론을 수동 트리거)
  const collectNow = async () => {
    if (collecting) return
    setCollecting(true)
    try {
      const res = await fetch(`${API_BASE}/cron/collect`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const r = await res.json()
      setCollectResult(r)
      if (!r.skipped) fetchData()
    } catch (err) {
      console.error('collect failed:', err)
      setCollectResult({ error: err instanceof Error ? err.message : String(err) })
    } finally {
      setCollecting(false)
    }
  }

  const handleSchedule = async (id: number) => {
    const date = scheduleDates[id]
    if (!date) return
    try {
      await api.scheduleContent(id, date)
      setScheduleDates((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      await fetchData()
    } catch (err) {
      console.error('Schedule failed:', err)
      alert('예약에 실패했습니다.')
    }
  }

  const platformIcons: Record<string, { icon: React.ReactNode; name: string }> = {
    youtube: { icon: <Youtube size={22} />, name: 'YouTube' },
    youtube_shorts: { icon: <Clapperboard size={22} />, name: 'YouTube Shorts' },
    naver_blog: { icon: <FileText size={22} />, name: '네이버 블로그' },
    facebook: { icon: <Facebook size={22} />, name: 'Facebook' },
    instagram: { icon: <Instagram size={22} />, name: 'Instagram' },
    instagram_reels: { icon: <Film size={22} />, name: 'Instagram Reels' },
    threads: { icon: <AtSign size={22} />, name: 'Threads' },
    tiktok: { icon: <Music2 size={22} />, name: 'TikTok' },
    meta_ads: { icon: <Megaphone size={22} />, name: 'Meta 광고 계정' },
    linkedin: { icon: <Linkedin size={22} />, name: 'LinkedIn' },
    living_sequence_lab: { icon: <FlaskConical size={22} />, name: 'Living Sequence Lab' },
  }

  const statusIcons: Record<string, { icon: React.ReactNode; text: string; bg: string }> = {
    completed: { icon: <CheckCircle size={14} className="text-success" strokeWidth={2.5} />, text: 'text-success', bg: 'bg-paper-white' },
    pending: { icon: <Clock size={14} className="text-muted-gray" strokeWidth={2.5} />, text: 'text-muted-gray', bg: 'bg-paper-white' },
    draft: { icon: <Clock size={14} className="text-ash-gray" strokeWidth={2.5} />, text: 'text-muted-gray', bg: 'bg-paper-white' },
    failed: { icon: <AlertCircle size={14} className="text-danger" strokeWidth={2.5} />, text: 'text-danger', bg: 'bg-paper-white' },
    uploading: { icon: <CloudLightning size={14} className="text-ink" strokeWidth={2.5} />, text: 'text-ink', bg: 'bg-paper-white' },
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-paper-gray border-t-paper-ink animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-ink">대시보드 개요</h2>
      </div>

      {/* Stats Cards — 실제 수집 중인 게시물 성과 기준 */}
      {(() => {
        const ps = postsSummary
        const connectedCount = platforms.filter((p) => p.is_connected).length
        const cards = [
          {
            label: '수집 중 게시물',
            value: (ps?.total.count ?? 0).toLocaleString(),
            sub: `${connectedCount}개 플랫폼 연동`,
            icon: FileText,
            bgIcon: LayoutDashboard,
            color: 'text-ink',
            to: '/posts',
          },
          {
            label: '총 조회',
            value: ((ps?.total.views ?? 0) + (ps?.total.paid ?? 0)).toLocaleString(),
            sub: ps && (ps.total.paid ?? 0) > 0
              ? `자연 ${ps.total.views.toLocaleString()} + 유료 ${ps.total.paid.toLocaleString()}`
              : ps && ps.total.count > 0 ? `게시물 평균 ${Math.round(ps.total.views / ps.total.count).toLocaleString()}` : '—',
            icon: TrendingUp,
            bgIcon: TrendingUp,
            color: 'text-ink',
            to: '/posts',
          },
          {
            label: '총 참여',
            value: (ps?.total.engage ?? 0).toLocaleString(),
            sub: ps && (ps.total.views + (ps.total.paid ?? 0)) > 0 ? `참여율 ${((ps.total.engage / (ps.total.views + (ps.total.paid ?? 0))) * 100).toFixed(1)}%` : '—',
            icon: Activity,
            bgIcon: Activity,
            color: 'text-success',
            to: '/posts',
          },
          {
            label: '광고 지출',
            value: adAccount
              ? `₩${adAccount.spent.toLocaleString()}`
              : (ps?.total.spend ?? 0) > 0 ? `₩${Math.round(ps!.total.spend).toLocaleString()}` : '–',
            sub: adAccount
              ? `잔액 ₩${adAccount.balance.toLocaleString()} · 충전 ₩${adAccount.charged.toLocaleString()}`
              : ps && ps.boosted.count > 0 ? `부스트 ${ps.boosted.count}건` : '부스트 없음',
            icon: Megaphone,
            bgIcon: Megaphone,
            color: 'text-danger',
            to: '/posts',
          },
        ]
        const spentPct = adAccount && adAccount.charged > 0
          ? Math.min(100, (adAccount.spent / adAccount.charged) * 100)
          : 0
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cards.slice(0, 3).map((card) => (
              <Link
                key={card.label}
                to={card.to}
                className="bg-paper-white p-6 rounded border border-paper-gray hover:border-ash-gray transition-colors relative overflow-hidden group"
              >
                <div className="absolute -right-4 -bottom-4 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
                  <card.bgIcon size={100} className={card.color} />
                </div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 rounded bg-paper-beige flex items-center justify-center shrink-0">
                    <card.icon size={24} className={card.color} strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-muted-gray">{card.label}</div>
                    <div className="text-3xl font-extrabold text-ink mt-0.5 truncate">{card.value}</div>
                    <div className="text-[11px] text-ash-gray mt-0.5">{card.sub}</div>
                  </div>
                </div>
              </Link>
            ))}

            {/* 광고 지출 — 잔액/소진률을 함께 보여주는 전용 카드 */}
            <Link
              to="/posts"
              className="bg-paper-white p-6 rounded border border-paper-gray hover:border-ash-gray transition-colors relative overflow-hidden group"
            >
              <div className="absolute -right-4 -bottom-4 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
                <Megaphone size={100} className="text-danger" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Megaphone size={16} className="text-danger" strokeWidth={2.5} />
                  <span className="text-sm font-medium text-muted-gray">광고</span>
                  {adAccount && (
                    <span className="ml-auto text-[11px] font-bold text-muted-gray">{spentPct.toFixed(0)}% 소진</span>
                  )}
                </div>

                {adAccount ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-danger">
                        ₩{adAccount.spent.toLocaleString()}
                      </span>
                      <span className="text-xs font-semibold text-ash-gray">사용</span>
                    </div>

                    <div className="bg-paper-beige rounded-none h-2 overflow-hidden mt-2.5">
                      <div
                        className="h-full bg-danger transition-all duration-700"
                        style={{ width: `${spentPct}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-baseline mt-2.5">
                      <span className="text-charcoal text-sm font-medium">
                        잔액 <b className="text-success font-extrabold text-lg ml-0.5">₩{adAccount.balance.toLocaleString()}</b>
                      </span>
                      <span className="text-muted-gray text-sm font-medium">
                        충전 <b className="text-charcoal font-bold text-base ml-0.5">₩{adAccount.charged.toLocaleString()}</b>
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-3xl font-extrabold text-ink mt-0.5">
                      {(ps?.total.spend ?? 0) > 0 ? `₩${Math.round(ps!.total.spend).toLocaleString()}` : '–'}
                    </div>
                    <div className="text-[11px] text-ash-gray mt-0.5">
                      {ps && ps.boosted.count > 0 ? `부스트 ${ps.boosted.count}건` : '부스트 없음'}
                    </div>
                  </>
                )}
              </div>
            </Link>
          </div>
        )
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Platform Status */}
        <div className="bg-paper-white p-6 rounded border border-paper-gray flex flex-col">
          <h3 className="text-lg font-bold text-ink mb-6 flex items-center gap-2">
            <CloudLightning className="text-ink" size={20} />
            플랫폼 연동 상태
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {platforms.map((platform) => {
              const info = platformIcons[platform.platform]
              const channelUrl = platformChannelUrl(platform)
              const Wrapper = channelUrl ? 'a' : 'div'
              return (
                <Wrapper
                  key={platform.platform}
                  {...(channelUrl ? { href: channelUrl, target: '_blank', rel: 'noreferrer' } : {})}
                  className={`block p-4 rounded border transition-colors ${channelUrl ? 'cursor-pointer' : ''} ${platform.is_connected
                      ? 'border-paper-gray bg-paper-white hover:bg-paper-beige'
                      : 'border-paper-beige bg-paper-ivory hover:bg-paper-beige'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded ${platform.is_connected ? 'bg-paper-beige text-success' : 'bg-paper-beige text-ash-gray'}`}>
                      {info?.icon}
                    </div>
                    <div>
                      <div className="font-semibold text-ink text-sm">{info?.name}</div>
                      <div className={`text-xs mt-0.5 font-medium flex items-center gap-1 ${platform.is_connected ? 'text-success' : 'text-ash-gray'}`}>
                        {platform.is_connected && <div className="w-1.5 h-1.5 rounded-none bg-success"></div>}
                        {!platform.is_connected && <div className="w-1.5 h-1.5 rounded-none bg-ash-gray"></div>}
                        {platform.is_connected ? '연동 활성화됨' : '미연동 상태'}
                      </div>
                    </div>
                  </div>
                </Wrapper>
              )
            })}
          </div>
        </div>

        {/* Recent Uploads */}
        <div className="bg-paper-white p-6 rounded border border-paper-gray flex flex-col">
          <h3 className="text-lg font-bold text-ink mb-6 flex items-center gap-2">
            <Activity className="text-ink" size={20} />
            최근 업로드 내역
          </h3>
          {recentContents.length > 0 ? (
            <div className="space-y-3 flex-1">
              {recentContents.map((content) => {
                const statusInfo = statusIcons[content.status] || statusIcons.draft;
                return (
                  <div
                    key={content.id}
                    className="flex justify-between p-4 bg-paper-ivory rounded hover:bg-paper-beige transition-colors border border-paper-beige group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center justify-center w-8 h-8 rounded border border-paper-gray ${statusInfo.bg} group-hover:scale-110 transition-transform`}>
                        {statusInfo.icon}
                      </div>
                      <div>
                        <div className="font-semibold text-ink">{content.title}</div>
                        <div className="text-sm text-muted-gray mt-0.5 font-medium">
                          {new Date(content.created_at).toLocaleDateString('ko-KR', {
                            year: 'numeric', month: 'long', day: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>
                    <div className={`text-xs font-bold px-3 py-1.5 rounded-none border border-paper-gray self-start ${statusInfo.bg} ${statusInfo.text}`}>
                      {content.status === 'completed' ? '업로드 완료' :
                        content.status === 'failed' ? '실패' :
                          content.status === 'uploading' ? '업로드 중' : '대기중'}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-ash-gray">
              <div className="w-16 h-16 mb-4 rounded bg-paper-beige flex items-center justify-center">
                <FileText size={32} className="text-ash-gray" />
              </div>
              <p className="font-medium text-muted-gray">아직 등록된 콘텐츠가 없습니다</p>
              <p className="text-sm mt-1 text-ash-gray">업로드 메뉴에서 새 콘텐츠를 추가해보세요.</p>
            </div>
          )}
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="bg-paper-white rounded border border-paper-gray p-5">
          <h2 className="text-sm font-bold text-charcoal mb-3">예약 대기 드래프트</h2>
          <div className="space-y-2">
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-2 rounded hover:bg-paper-beige">
                <span className="flex-1 truncate text-sm text-charcoal">{d.title}</span>
                <input
                  type="date"
                  value={scheduleDates[d.id] || ''}
                  onChange={(e) => setScheduleDates((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  className="text-xs border border-paper-gray rounded px-2 py-1"
                />
                <button
                  onClick={() => handleSchedule(d.id)}
                  disabled={!scheduleDates[d.id]}
                  className="text-xs font-bold text-ink bg-lemon hover:bg-lemon/80 disabled:opacity-40 rounded px-3 py-1"
                >
                  예약
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {collectResult && (
        <CollectResultModal result={collectResult} onClose={() => setCollectResult(null)} />
      )}

      {/* 게시글 성과 요약 */}
      {postsSummary && postsSummary.total.count > 0 && (() => {
        const ps = postsSummary
        const maxViews = Math.max(...ps.by_platform.map(p => p.views + p.paid), 1)
        // 조회당 비용은 광고로 발생한 조회(유료) 기준 — 없으면 부스트 게시물 자연 조회로 폴백
        const cpvBase = ps.boosted.paid > 0 ? ps.boosted.paid : ps.boosted.views
        const cpv = cpvBase > 0 ? ps.boosted.spend / cpvBase : null
        const cpc = ps.boosted.clicks > 0 ? ps.boosted.spend / ps.boosted.clicks : null
        return (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                <BarChart3 size={20} className="text-ink" />
                게시글 성과
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={collectNow}
                  disabled={collecting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-paper-white bg-paper-ink rounded hover:bg-charcoal disabled:opacity-60"
                >
                  <CloudDownload size={13} className={collecting ? 'animate-bounce' : ''} />
                  {collecting ? '수집 중…' : '지금 수집'}
                </button>
                <Link to="/posts" className="flex items-center gap-1 text-xs font-semibold text-charcoal hover:text-ink bg-paper-white px-3 py-1.5 rounded border border-paper-gray hover:bg-paper-beige">
                  전체 보기 · 수치 입력 <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* 플랫폼별 조회수 */}
              <div className="bg-paper-white rounded p-5 border border-paper-gray">
                <h4 className="text-sm font-bold text-charcoal mb-3 flex items-center gap-2">
                  <BarChart3 size={14} className="text-ink" />
                  플랫폼별 조회수
                </h4>
                <div className="space-y-3">
                  {[...ps.by_platform].sort((a, b) => (b.views + b.paid) - (a.views + a.paid)).map(p => {
                    const color = trackingPlatformColor[p.platform] || '#0c0c0c'
                    const total = p.views + p.paid
                    return (
                      <div key={p.platform}>
                        <div className="flex items-baseline justify-between mb-1">
                          <div className="text-xs font-bold text-ink">
                            {trackingPlatformLabel[p.platform] || p.platform}
                            <span className="text-[11px] text-muted-gray font-medium ml-1.5">{p.count}건</span>
                            {p.spend > 0 && (
                              <span className="text-[11px] font-bold text-danger ml-2">₩{Math.round(p.spend).toLocaleString()}</span>
                            )}
                          </div>
                          <div className="text-base font-extrabold text-ink">
                            {p.paid > 0 && (
                              <span className="text-[10px] font-semibold text-muted-gray mr-1.5">
                                자연 {p.views.toLocaleString()} + 유료 {p.paid.toLocaleString()}
                              </span>
                            )}
                            {total.toLocaleString()}
                            <span className="text-[10px] font-semibold text-ash-gray ml-1">조회</span>
                          </div>
                        </div>
                        <div className="bg-paper-beige rounded-none h-2 overflow-hidden">
                          <div className="h-full rounded-none transition-all duration-700 ease-out"
                            style={{ width: `${Math.max((total / maxViews) * 100, 3)}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 유료 vs 자연 (Meta 한국어 UI 용어) */}
              <div className="bg-paper-white rounded p-5 border border-paper-gray flex flex-col">
                <h4 className="text-sm font-bold text-charcoal mb-3 flex items-center gap-2">
                  <Megaphone size={14} className="text-ink" />
                  유료 vs 자연
                </h4>
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {[
                    { label: '유료 (광고 집행)', agg: ps.boosted, accent: 'text-danger' },
                    { label: '자연 (광고 없음)', agg: ps.organic, accent: 'text-success' },
                  ].map(({ label, agg, accent }) => (
                    <div key={label} className="border border-paper-beige rounded bg-paper-ivory p-3.5 flex flex-col">
                      <div className={`text-[10px] font-bold tracking-wider mb-2 ${accent}`}>
                        {label} · {agg.count}건
                      </div>
                      <div className="space-y-1.5 text-xs text-charcoal flex-1">
                        <div className="flex justify-between"><span className="text-muted-gray">총 조회</span><span className="font-bold text-ink">{(agg.views + agg.paid).toLocaleString()}</span></div>
                        {agg.paid > 0 && (
                          <div className="flex justify-between"><span className="text-muted-gray">└ 자연 + 유료</span><span className="font-semibold">{agg.views.toLocaleString()} + {agg.paid.toLocaleString()}</span></div>
                        )}
                        <div className="flex justify-between"><span className="text-muted-gray">평균 조회</span><span className="font-semibold">{agg.count > 0 ? Math.round((agg.views + agg.paid) / agg.count).toLocaleString() : '–'}</span></div>
                        <div className="flex justify-between"><span className="text-muted-gray">참여</span><span className="font-semibold">{agg.engage.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-muted-gray">참여율</span><span className="font-semibold">{(agg.views + agg.paid) > 0 ? `${((agg.engage / (agg.views + agg.paid)) * 100).toFixed(1)}%` : '–'}</span></div>
                        <div className="flex justify-between"><span className="text-muted-gray">클릭</span><span className="font-semibold">{agg.clicks.toLocaleString()}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
                {(cpv != null || cpc != null) && (
                  <div className="mt-3 flex items-center gap-4 border-t border-paper-beige pt-3 text-xs">
                    <span className="text-[10px] font-bold text-muted-gray tracking-wider">광고 효율</span>
                    {cpv != null && <span className="text-charcoal">조회당 <b className="text-ink">₩{cpv.toFixed(1)}</b></span>}
                    {cpc != null && <span className="text-charcoal">클릭당 <b className="text-ink">₩{Math.round(cpc).toLocaleString()}</b></span>}
                  </div>
                )}
              </div>
            </div>

            {/* 플랫폼별 일별 추이 (계정 단위 API 시계열) */}
            {(() => {
              const metricLabel: Record<string, string> = { views: '조회', reach: '도달' }
              // 자연 도달 + 유료 노출을 날짜별로 합산해 표시
              const organicRows = accountDaily.filter(r => r.metric !== 'paid_views')
              const paidRows = accountDaily.filter(r => r.metric === 'paid_views')
              const dates = [...new Set(accountDaily.map(r => r.date))].sort()
              if (dates.length < 2) return null

              const byPlatform = new Map<string, Map<string, number>>()
              const paidByPlatform = new Map<string, Map<string, number>>()
              for (const r of organicRows) {
                if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, new Map())
                byPlatform.get(r.platform)!.set(r.date, r.value)
              }
              for (const r of paidRows) {
                if (!paidByPlatform.has(r.platform)) paidByPlatform.set(r.platform, new Map())
                paidByPlatform.get(r.platform)!.set(r.date, r.value)
                // 유료만 있고 자연이 없는 날짜도 선에 포함되도록 합산 맵에 반영
                if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, new Map())
                const m = byPlatform.get(r.platform)!
                if (!m.has(r.date)) m.set(r.date, 0)
              }
              // 합산 값으로 교체
              for (const [platform, series] of byPlatform) {
                const paid = paidByPlatform.get(platform)
                if (!paid) continue
                for (const [date, v] of series) series.set(date, v + (paid.get(date) ?? 0))
              }
              const maxVal = Math.max(
                ...[...byPlatform.values()].flatMap(s => [...s.values()]),
                1
              )
              const W = 1200, H = 170, PL = 44, PR = 14, PT = 14, PB = 24
              const chartW = W - PL - PR, chartH = H - PT - PB
              const getX = (i: number) => PL + (i / (dates.length - 1)) * chartW
              const getY = (v: number) => PT + chartH - (v / maxVal) * chartH
              return (
                <div className="bg-paper-white rounded p-5 border border-paper-gray">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h4 className="text-sm font-bold text-charcoal flex items-center gap-2">
                      <TrendingUp size={14} className="text-ink" />
                      플랫폼별 일별 추이
                      <span className="text-[10px] font-medium text-ash-gray">
                        최근 {dates.length}일 · 자연 + 유료 합산 · 최신일은 집계 중일 수 있음
                      </span>
                    </h4>
                    <div className="flex items-center gap-3">
                      {[...byPlatform.keys()].map(p => {
                        const metric = organicRows.find(r => r.platform === p)?.metric ?? 'views'
                        return (
                          <span key={p} className="flex items-center gap-1 text-[10px] font-semibold text-charcoal">
                            <span className="w-2 h-2 rounded-none" style={{ backgroundColor: trackingPlatformColor[p] || '#0c0c0c' }} />
                            {trackingPlatformLabel[p] || p}
                            <span className="text-ash-gray font-medium">({metricLabel[metric] || metric})</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
                    {[0, 0.5, 1].map(pct => {
                      const y = PT + chartH * (1 - pct)
                      return (
                        <g key={pct}>
                          <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#dbdbdb" strokeWidth="0.5" />
                          <text x={PL - 6} y={y} textAnchor="end" dominantBaseline="middle" style={{ fontSize: '9px', fill: '#9e9e9e' }}>
                            {Math.round(maxVal * pct).toLocaleString()}
                          </text>
                        </g>
                      )
                    })}
                    {[...byPlatform.entries()].map(([p, series]) => {
                      const color = trackingPlatformColor[p] || '#0c0c0c'
                      // 데이터가 없는 날짜는 0으로 찍지 않고 건너뛴다
                      // (플랫폼마다 집계 완료 시점이 달라 최근 날짜가 비어 있을 수 있음)
                      const points = dates
                        .map((d, i) => ({ i, v: series.get(d) }))
                        .filter((pt): pt is { i: number; v: number } => pt.v != null)
                      if (points.length === 0) return null
                      const path = points
                        .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${getX(pt.i)},${getY(pt.v)}`)
                        .join(' ')
                      return (
                        <g key={p}>
                          <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
                          {points.map((pt) => (
                            <circle
                              key={pt.i}
                              cx={getX(pt.i)}
                              cy={getY(pt.v)}
                              r="2"
                              fill="#fffefb"
                              stroke={color}
                              strokeWidth="1.1"
                              className="transition-all"
                              style={{ pointerEvents: 'none' }}
                            />
                          ))}
                          {/* 호버 영역 — 점보다 넓게 잡아 마우스가 쉽게 닿도록 */}
                          {points.map((pt) => (
                            <circle
                              key={`hit-${pt.i}`}
                              cx={getX(pt.i)}
                              cy={getY(pt.v)}
                              r="9"
                              fill="transparent"
                              className="cursor-pointer"
                              onMouseEnter={() =>
                                setHoverPoint({
                                  platform: p,
                                  date: dates[pt.i],
                                  value: pt.v,
                                  x: getX(pt.i),
                                  y: getY(pt.v),
                                })
                              }
                              onMouseLeave={() => setHoverPoint(null)}
                            />
                          ))}
                        </g>
                      )
                    })}
                    {[0, Math.floor(dates.length / 2), dates.length - 1].map(idx => (
                      <text key={idx} x={getX(idx)} y={H - 6} textAnchor="middle" style={{ fontSize: '9px', fill: '#9e9e9e' }}>
                        {dates[idx].slice(5)}
                      </text>
                    ))}

                    {/* 호버 툴팁 */}
                    {hoverPoint && (() => {
                      const color = trackingPlatformColor[hoverPoint.platform] || '#0c0c0c'
                      const metric = organicRows.find(r => r.platform === hoverPoint.platform)?.metric ?? 'views'
                      const paid = paidByPlatform.get(hoverPoint.platform)?.get(hoverPoint.date) ?? 0
                      const organic = hoverPoint.value - paid
                      const text = `${trackingPlatformLabel[hoverPoint.platform] ?? hoverPoint.platform} ${hoverPoint.value.toLocaleString()}`
                      const sub = paid > 0
                        ? `${hoverPoint.date.slice(5)} · 자연 ${organic.toLocaleString()} + 유료 ${paid.toLocaleString()}`
                        : `${hoverPoint.date.slice(5)} · ${metricLabel[metric] || metric}`
                      const boxW = Math.max(text.length, sub.length) * 6.2 + 16
                      const boxH = 34
                      // 오른쪽 끝에서는 왼쪽으로 뒤집어 잘리지 않게
                      const flip = hoverPoint.x + boxW + 12 > W
                      const bx = flip ? hoverPoint.x - boxW - 10 : hoverPoint.x + 10
                      const by = Math.max(2, Math.min(hoverPoint.y - boxH / 2, H - boxH - 2))
                      return (
                        <g style={{ pointerEvents: 'none' }}>
                          <circle cx={hoverPoint.x} cy={hoverPoint.y} r="4" fill={color} />
                          <rect x={bx} y={by} width={boxW} height={boxH} rx="3" fill="#0c0c0c" opacity="0.92" />
                          <text x={bx + 8} y={by + 14} style={{ fontSize: '10px', fill: '#fffefb', fontWeight: 700 }}>
                            {text}
                          </text>
                          <text x={bx + 8} y={by + 26} style={{ fontSize: '9px', fill: '#9e9e9e' }}>
                            {sub}
                          </text>
                        </g>
                      )
                    })()}
                  </svg>
                </div>
              )
            })()}

            {/* 조회수 상위 게시글 */}
            {ps.top.length > 0 && (
              <div className="bg-paper-white rounded p-5 border border-paper-gray">
                <h4 className="text-sm font-bold text-charcoal mb-3 flex items-center gap-2">
                  <Crown size={14} className="text-ink" />
                  조회수 상위 게시글
                </h4>
                <div className="space-y-2.5">
                  {ps.top.map((item, idx) => {
                    const maxTop = Math.max(...ps.top.map(t => t.views + t.paid), 1)
                    const itemTotal = item.views + item.paid
                    const color = trackingPlatformColor[item.platform] || '#0c0c0c'
                    const RankIcon = idx === 0 ? Crown : idx === 1 ? Medal : idx === 2 ? Award : null
                    const RowTag = item.post_url ? 'a' : 'div'
                    return (
                      <RowTag
                        key={item.id}
                        {...(item.post_url ? { href: item.post_url, target: '_blank', rel: 'noreferrer' } : {})}
                        className={`flex items-center gap-3 rounded px-2 py-0.5 -mx-2 transition-colors ${item.post_url ? 'cursor-pointer hover:bg-paper-ivory' : ''}`}
                      >
                        <div className="w-6 shrink-0 flex justify-center">
                          {RankIcon
                            ? <RankIcon size={15} className={idx === 0 ? 'text-ink' : idx === 1 ? 'text-charcoal' : 'text-muted-gray'} />
                            : <span className="text-xs font-bold text-ash-gray">{idx + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-none whitespace-nowrap"
                              style={{ backgroundColor: `${color}15`, color }}>
                              {trackingPlatformLabel[item.platform] || item.platform}
                            </span>
                            <span className="text-xs font-semibold text-ink truncate">{item.title}</span>
                            {item.boosted && <Megaphone size={11} className="text-danger shrink-0" />}
                            <span className="text-[11px] text-muted-gray shrink-0 ml-auto">
                              {item.paid > 0 && <>자연 {item.views.toLocaleString()} + <span className="text-danger font-semibold">유료 {item.paid.toLocaleString()}</span> · </>}
                              참여 {item.engage.toLocaleString()} · 클릭 {item.clicks.toLocaleString()}
                            </span>
                          </div>
                          <div className="bg-paper-beige rounded-none h-2 overflow-hidden">
                            <div className="h-full rounded-none transition-all duration-700"
                              style={{ width: `${Math.max((itemTotal / maxTop) * 100, 4)}%`, backgroundColor: color }} />
                          </div>
                        </div>
                        <div className="w-16 text-right shrink-0">
                          <span className="text-base font-extrabold text-ink">{itemTotal.toLocaleString()}</span>
                          <span className="text-[10px] font-semibold text-ash-gray ml-0.5">조회</span>
                        </div>
                      </RowTag>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )
      })()}

      {/* 링크 분석 섹션 */}
      {analytics && (() => {
        const maxPlatformClicks = Math.max(...analytics.platform_breakdown.map(p => p.total_clicks), 1)
        const maxContentClicks = Math.max(...analytics.top_content.map(c => c.total_clicks), 1)

        return (
          <>
            {/* 링크 분석 헤더 */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                <BarChart3 size={20} className="text-ink" />
                링크 분석
              </h3>
              <div className="flex items-center bg-paper-white rounded border border-paper-gray overflow-hidden">
                {[7, 30, 90].map(d => (
                  <button key={d} onClick={() => setAnalyticsDays(d)}
                    className={`px-3 py-1.5 text-xs font-semibold transition-all ${analyticsDays === d ? 'bg-paper-ink text-paper-white' : 'text-muted-gray hover:bg-paper-beige'}`}>
                    {d}일
                  </button>
                ))}
              </div>
            </div>

            {/* 링크 분석 요약 카드 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: '총 클릭', value: analytics.total_clicks, icon: MousePointerClick, bg: 'bg-paper-beige', text: 'text-ink' },
                { label: '트래킹 링크', value: analytics.total_links, icon: Link2, bg: 'bg-paper-beige', text: 'text-ink' },
                { label: '오늘 클릭', value: analytics.today_clicks, icon: TrendingUp, bg: 'bg-paper-beige', text: 'text-ink' },
                { label: '평균 클릭/링크', value: analytics.avg_clicks_per_link, icon: BarChart3, bg: 'bg-paper-beige', text: 'text-ink' },
              ].map(card => (
                <div key={card.label} className="bg-paper-white p-4 rounded border border-paper-gray">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded ${card.bg} flex items-center justify-center`}>
                      <card.icon size={20} className={card.text} strokeWidth={2} />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-gray">{card.label}</div>
                      <div className="text-2xl font-extrabold text-ink">
                        {typeof card.value === 'number' && card.value % 1 !== 0 ? card.value.toFixed(1) : card.value.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 차트 2열 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 플랫폼별 클릭 */}
              <div className="bg-paper-white rounded p-6 border border-paper-gray">
                <h4 className="text-sm font-bold text-charcoal mb-4 flex items-center gap-2">
                  <BarChart3 size={14} className="text-ink" />
                  플랫폼별 클릭 수
                </h4>
                {analytics.platform_breakdown.length > 0 ? (
                  <div className="space-y-2.5">
                    {analytics.platform_breakdown.map(p => {
                      const barWidth = (p.total_clicks / maxPlatformClicks) * 100
                      const color = trackingPlatformColor[p.platform] || '#0c0c0c'
                      return (
                        <div key={p.platform} className="flex items-center gap-2.5">
                          <div className="w-20 text-[11px] font-semibold text-charcoal text-right shrink-0">
                            {trackingPlatformLabel[p.platform] || p.platform}
                          </div>
                          <div className="flex-1 bg-paper-beige rounded-none h-6 overflow-hidden">
                            <div className="h-full rounded-none transition-all duration-700 ease-out flex items-center"
                              style={{ width: `${Math.max(barWidth, 3)}%`, backgroundColor: color }}>
                              <span className="text-[10px] font-bold text-paper-white ml-2 whitespace-nowrap">
                                {p.total_clicks.toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="w-10 text-[11px] font-bold text-ash-gray text-right shrink-0">{p.percentage}%</div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-ash-gray text-center py-8">클릭 데이터가 없습니다</div>
                )}
              </div>

              {/* 일별 클릭 추이 */}
              <div className="bg-paper-white rounded p-6 border border-paper-gray">
                <h4 className="text-sm font-bold text-charcoal mb-4 flex items-center gap-2">
                  <TrendingUp size={14} className="text-ink" />
                  일별 클릭 추이
                </h4>
                {analytics.daily_trend.length >= 2 ? (() => {
                  const W = 460, H = 180, PL = 36, PR = 12, PT = 16, PB = 26
                  const points = analytics.daily_trend
                  const maxVal = Math.max(...points.map(p => p.click_count), 1)
                  const chartW = W - PL - PR, chartH = H - PT - PB
                  const getX = (i: number) => PL + (i / (points.length - 1)) * chartW
                  const getY = (v: number) => PT + chartH - (v / maxVal) * chartH
                  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${getX(i)},${getY(p.click_count)}`).join(' ')
                  const areaPath = `${linePath} L${getX(points.length - 1)},${PT + chartH} L${PL},${PT + chartH} Z`

                  return (
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl mx-auto block">
                      <defs>
                        <linearGradient id="dashTrendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0c0c0c" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#0c0c0c" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>
                      {[0, 0.5, 1].map(pct => {
                        const y = PT + chartH * (1 - pct)
                        return (
                          <g key={pct}>
                            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#dbdbdb" strokeWidth="0.5" />
                            <text x={PL - 5} y={y} textAnchor="end" dominantBaseline="middle"
                              style={{ fontSize: '8px', fill: '#9e9e9e' }}>{Math.round(maxVal * pct)}</text>
                          </g>
                        )
                      })}
                      <path d={areaPath} fill="url(#dashTrendFill)" />
                      <path d={linePath} fill="none" stroke="#0c0c0c" strokeWidth="1.8" strokeLinejoin="round" />
                      {points.map((p, i) => (
                        <circle key={i} cx={getX(i)} cy={getY(p.click_count)} r="2.5"
                          fill="#fffefb" stroke="#0c0c0c" strokeWidth="1.2" />
                      ))}
                      {[0, Math.floor(points.length / 2), points.length - 1].map(idx => (
                        <text key={idx} x={getX(idx)} y={H - 5} textAnchor="middle"
                          style={{ fontSize: '8px', fill: '#9e9e9e' }}>{points[idx].date.slice(5)}</text>
                      ))}
                    </svg>
                  )
                })() : (
                  <div className="text-sm text-ash-gray text-center py-8">추이 데이터가 부족합니다</div>
                )}
              </div>
            </div>

            {/* 콘텐츠 클릭 랭킹 */}
            <div className="bg-paper-white rounded p-6 border border-paper-gray">
              <h4 className="text-sm font-bold text-charcoal mb-4 flex items-center gap-2">
                <Crown size={14} className="text-ink" />
                콘텐츠별 클릭 랭킹
              </h4>
              {analytics.top_content.length > 0 ? (
                <div className="space-y-2.5">
                  {analytics.top_content.map((item, idx) => {
                    const barWidth = (item.total_clicks / maxContentClicks) * 100
                    const RankIcon = idx === 0 ? Crown : idx === 1 ? Medal : idx === 2 ? Award : null
                    const rankColor = idx === 0 ? 'text-ink' : idx === 1 ? 'text-charcoal' : idx === 2 ? 'text-muted-gray' : 'text-ash-gray'
                    return (
                      <div key={item.content_id} className="flex items-center gap-2.5 py-2">
                        <div className="w-7 shrink-0 flex justify-center">
                          {RankIcon ? <RankIcon size={16} className={rankColor} /> : <span className="text-[11px] font-bold text-ash-gray">{idx + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-semibold text-ink truncate">{item.content_title}</span>
                            <div className="flex gap-0.5 shrink-0">
                              {item.platforms.map(p => (
                                <span key={p} className="text-[9px] px-1 py-0.5 rounded-none font-semibold"
                                  style={{ backgroundColor: `${trackingPlatformColor[p] || '#0c0c0c'}15`, color: trackingPlatformColor[p] || '#0c0c0c' }}>
                                  {trackingPlatformLabel[p] || p}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="bg-paper-beige rounded-none h-1.5 overflow-hidden">
                            <div className="h-full rounded-none bg-paper-ink transition-all duration-700"
                              style={{ width: `${barWidth}%` }} />
                          </div>
                        </div>
                        <div className="w-14 text-right shrink-0">
                          <span className="text-xs font-bold text-charcoal">{item.total_clicks.toLocaleString()}</span>
                          <span className="text-[9px] text-ash-gray ml-0.5">클릭</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-sm text-ash-gray text-center py-8">클릭 데이터가 없습니다</div>
              )}
            </div>
          </>
        )
      })()}

      {/* 전체 트래킹 링크 비교 */}
      {trackingLinks.length > 0 && (() => {
        const filtered = linkFilter === 'all'
          ? trackingLinks
          : trackingLinks.filter(l => l.platform === linkFilter)
        const displayed = filtered.slice(0, 30)
        const maxClicks = Math.max(...displayed.map(l => l.click_count), 1)
        const platforms = [...new Set(trackingLinks.map(l => l.platform))]

        return (
          <div className="bg-paper-white rounded p-6 border border-paper-gray">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-charcoal flex items-center gap-2">
                <Link2 size={14} className="text-ink" />
                전체 트래킹 링크 비교
                <span className="text-[10px] font-medium text-ash-gray ml-1">
                  {displayed.length}{filtered.length > 30 ? ` / ${filtered.length}` : ''}개
                </span>
              </h4>
              <div className="flex items-center gap-1 bg-paper-ivory rounded p-1 border border-paper-beige">
                <button
                  onClick={() => setLinkFilter('all')}
                  className={`px-2.5 py-1 text-[10px] font-semibold rounded transition-all ${
                    linkFilter === 'all' ? 'bg-paper-white text-ink border border-paper-gray' : 'text-ash-gray hover:text-charcoal'
                  }`}
                >
                  전체
                </button>
                {platforms.map(p => (
                  <button
                    key={p}
                    onClick={() => setLinkFilter(linkFilter === p ? 'all' : p)}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded transition-all whitespace-nowrap ${
                      linkFilter === p ? 'bg-paper-white border border-paper-gray' : 'text-ash-gray hover:text-charcoal'
                    }`}
                    style={linkFilter === p ? { color: trackingPlatformColor[p] } : undefined}
                  >
                    {trackingPlatformLabel[p] || p}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {displayed.map((link, idx) => {
                const barWidth = (link.click_count / maxClicks) * 100
                const color = trackingPlatformColor[link.platform] || '#0c0c0c'
                return (
                  <div key={link.id} className="flex items-center gap-2.5 group">
                    <div className="w-5 shrink-0 text-center">
                      <span className="text-[10px] font-bold text-ash-gray">{idx + 1}</span>
                    </div>
                    <div className="w-24 shrink-0">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-none whitespace-nowrap"
                        style={{ backgroundColor: `${color}15`, color }}>
                        {trackingPlatformLabel[link.platform] || link.platform}
                      </span>
                    </div>
                    <div className="w-28 shrink-0 text-[11px] font-medium text-charcoal truncate">
                      {contentNames[link.content_id] || `콘텐츠 #${link.content_id}`}
                    </div>
                    <div className="flex-1 bg-paper-beige rounded-none h-5 overflow-hidden">
                      <div className="h-full rounded-none transition-all duration-700 ease-out flex items-center"
                        style={{ width: `${Math.max(barWidth, 4)}%`, backgroundColor: color }}>
                        <span className="text-[9px] font-bold text-paper-white ml-2 whitespace-nowrap">
                          {link.click_count.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

