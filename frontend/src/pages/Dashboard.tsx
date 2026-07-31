import { useState, useEffect } from 'react'
import { Youtube, FileText, Facebook, Instagram, CheckCircle, Clock, AlertCircle, Clapperboard, Film, AtSign, LayoutDashboard, CloudLightning, Activity, BarChart3, MousePointerClick, Link2, TrendingUp, Crown, Medal, Award, Linkedin, FlaskConical } from 'lucide-react'
import { api } from '../services/api'
import type { AnalyticsSummary } from '../types'

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

const trackingPlatformLabel: Record<string, string> = {
  youtube: 'YouTube', youtube_shorts: 'YouTube Shorts', naver_blog: '네이버 블로그',
  facebook: 'Facebook', instagram: 'Instagram', instagram_reels: 'Instagram Reels', threads: 'Threads',
  linkedin: 'LinkedIn', living_sequence_lab: 'Living Sequence Lab',
}
const trackingPlatformColor: Record<string, string> = {
  youtube: '#ef4444', youtube_shorts: '#f97316', naver_blog: '#22c55e',
  facebook: '#3b82f6', instagram: '#ec4899', instagram_reels: '#a855f7', threads: '#71717a',
  linkedin: '#1d4ed8', living_sequence_lab: '#10b981',
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
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

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    fetchAnalytics()
  }, [analyticsDays])

  const fetchData = async () => {
    try {
      // Fetch contents from Supabase
      const contents = await api.getContents()
      setRecentContents(contents.slice(0, 5))
      setDrafts(contents.filter((c: Content) => c.status === 'draft'))

      setStats({
        total: contents.length,
        completed: contents.filter((c: Content) => c.status === 'completed').length,
        pending: contents.filter((c: Content) => c.status === 'pending' || c.status === 'draft').length,
        failed: contents.filter((c: Content) => c.status === 'failed').length,
      })

      // Fetch platforms from Supabase
      const platformData = await api.getPlatforms()
      setPlatforms(platformData)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
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

  const fetchAnalytics = async () => {
    try {
      const result = await api.getAnalyticsSummary(analyticsDays)
      setAnalytics(result)
    } catch {
      setAnalytics(getSampleAnalytics())
    }
  }

  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const links = await api.getTrackingLinks()
        setTrackingLinks(links.sort((a: { click_count: number }, b: { click_count: number }) => b.click_count - a.click_count))
        // 콘텐츠 이름 매핑
        const contents = await api.getContents()
        const nameMap: Record<number, string> = {}
        contents.forEach((c: { id: number; title: string }) => { nameMap[c.id] = c.title })
        setContentNames(nameMap)
      } catch { /* ignore */ }
    }
    fetchLinks()
  }, [])

  const platformIcons: Record<string, { icon: React.ReactNode; name: string }> = {
    youtube: { icon: <Youtube size={22} />, name: 'YouTube' },
    youtube_shorts: { icon: <Clapperboard size={22} />, name: 'YouTube Shorts' },
    naver_blog: { icon: <FileText size={22} />, name: '네이버 블로그' },
    facebook: { icon: <Facebook size={22} />, name: 'Facebook' },
    instagram: { icon: <Instagram size={22} />, name: 'Instagram' },
    instagram_reels: { icon: <Film size={22} />, name: 'Instagram Reels' },
    threads: { icon: <AtSign size={22} />, name: 'Threads' },
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
        <div className="flex items-center gap-2 text-sm text-muted-gray bg-paper-white px-4 py-2 rounded border border-paper-gray">
          <Activity size={16} className="text-success animate-pulse" />
          시스템 정상 작동 중
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-paper-white p-6 rounded border border-paper-gray transition-colors relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
            <LayoutDashboard size={100} className="text-ink" />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded bg-paper-beige flex items-center justify-center">
              <FileText size={24} className="text-ink" strokeWidth={2} />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-gray">전체 콘텐츠</div>
              <div className="text-3xl font-extrabold text-ink mt-0.5">{stats.total}</div>
            </div>
          </div>
        </div>

        <div className="bg-paper-white p-6 rounded border border-paper-gray transition-colors relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
            <CheckCircle size={100} className="text-success" />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded bg-paper-beige flex items-center justify-center">
              <CheckCircle size={24} className="text-success" strokeWidth={2} />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-gray">업로드 완료</div>
              <div className="text-3xl font-extrabold text-ink mt-0.5">{stats.completed}</div>
            </div>
          </div>
        </div>

        <div className="bg-paper-white p-6 rounded border border-paper-gray transition-colors relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
            <Clock size={100} className="text-muted-gray" />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded bg-paper-beige flex items-center justify-center">
              <Clock size={24} className="text-muted-gray" strokeWidth={2} />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-gray">대기 중</div>
              <div className="text-3xl font-extrabold text-ink mt-0.5">{stats.pending}</div>
            </div>
          </div>
        </div>

        <div className="bg-paper-white p-6 rounded border border-paper-gray transition-colors relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
            <AlertCircle size={100} className="text-danger" />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded bg-paper-beige flex items-center justify-center">
              <AlertCircle size={24} className="text-danger" strokeWidth={2} />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-gray">실패</div>
              <div className="text-3xl font-extrabold text-ink mt-0.5">{stats.failed}</div>
            </div>
          </div>
        </div>
      </div>

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
              return (
                <div
                  key={platform.platform}
                  className={`p-4 rounded border transition-colors ${platform.is_connected
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
                </div>
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

function getSampleAnalytics(): AnalyticsSummary {
  const today = new Date()
  const trend = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (13 - i))
    return { date: d.toISOString().slice(0, 10), click_count: Math.floor(Math.random() * 80) + 10 }
  })
  return {
    total_clicks: 1247, total_links: 42, today_clicks: 38, avg_clicks_per_link: 29.7,
    platform_breakdown: [
      { platform: 'youtube', total_clicks: 523, percentage: 41.9 },
      { platform: 'instagram', total_clicks: 312, percentage: 25.0 },
      { platform: 'naver_blog', total_clicks: 198, percentage: 15.9 },
      { platform: 'facebook', total_clicks: 134, percentage: 10.7 },
      { platform: 'threads', total_clicks: 80, percentage: 6.4 },
    ],
    top_content: [
      { content_id: 1, content_title: '2026 봄 트렌드 총정리', total_clicks: 342, platforms: ['youtube', 'instagram'] },
      { content_id: 2, content_title: '초보자를 위한 가이드', total_clicks: 256, platforms: ['youtube', 'naver_blog'] },
      { content_id: 3, content_title: '일주일 브이로그', total_clicks: 189, platforms: ['youtube', 'instagram', 'facebook'] },
      { content_id: 4, content_title: '제품 리뷰 - 신제품 언박싱', total_clicks: 145, platforms: ['youtube'] },
      { content_id: 5, content_title: '맛집 탐방 시리즈 #3', total_clicks: 98, platforms: ['naver_blog', 'instagram'] },
    ],
    daily_trend: trend,
  }
}
