import { useState, useEffect } from 'react'
import { Youtube, FileText, Facebook, Instagram, CheckCircle, Clock, AlertCircle, Clapperboard, Film, AtSign, LayoutDashboard, CloudLightning, Activity } from 'lucide-react'

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
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    completed: 0,
    pending: 0,
    failed: 0
  })

  const [recentContents, setRecentContents] = useState<Content[]>([])
  const [platforms, setPlatforms] = useState<PlatformConnection[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch contents
      const contentsRes = await fetch('http://localhost:8000/api/contents/')
      if (contentsRes.ok) {
        const contents = await contentsRes.json()
        setRecentContents(contents.slice(0, 5))

        // Calculate stats
        setStats({
          total: contents.length,
          completed: contents.filter((c: Content) => c.status === 'completed').length,
          pending: contents.filter((c: Content) => c.status === 'pending' || c.status === 'draft').length,
          failed: contents.filter((c: Content) => c.status === 'failed').length,
        })
      }

      // Fetch platforms
      const platformsRes = await fetch('http://localhost:8000/api/platforms/')
      if (platformsRes.ok) {
        const platformData = await platformsRes.json()
        setPlatforms(platformData)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
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
  }

  const statusIcons: Record<string, { icon: React.ReactNode; text: string; bg: string }> = {
    completed: { icon: <CheckCircle size={14} className="text-emerald-600" strokeWidth={2.5} />, text: 'text-emerald-600', bg: 'bg-emerald-100/50' },
    pending: { icon: <Clock size={14} className="text-amber-500" strokeWidth={2.5} />, text: 'text-amber-600', bg: 'bg-amber-100/50' },
    draft: { icon: <Clock size={14} className="text-slate-400" strokeWidth={2.5} />, text: 'text-slate-500', bg: 'bg-slate-100/80' },
    failed: { icon: <AlertCircle size={14} className="text-rose-500" strokeWidth={2.5} />, text: 'text-rose-600', bg: 'bg-rose-100/50' },
    uploading: { icon: <CloudLightning size={14} className="text-blue-500" strokeWidth={2.5} />, text: 'text-blue-600', bg: 'bg-blue-100/50' },
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">대시보드 개요</h2>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-full border border-slate-200/60 shadow-sm">
          <Activity size={16} className="text-emerald-500 animate-pulse" />
          시스템 정상 작동 중
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
            <LayoutDashboard size={100} className="text-indigo-600" />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shadow-inner">
              <FileText size={24} className="text-indigo-600" strokeWidth={2} />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">전체 콘텐츠</div>
              <div className="text-3xl font-extrabold text-slate-900 mt-0.5">{stats.total}</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
            <CheckCircle size={100} className="text-emerald-600" />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shadow-inner">
              <CheckCircle size={24} className="text-emerald-600" strokeWidth={2} />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">업로드 완료</div>
              <div className="text-3xl font-extrabold text-slate-900 mt-0.5">{stats.completed}</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
            <Clock size={100} className="text-amber-600" />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shadow-inner">
              <Clock size={24} className="text-amber-600" strokeWidth={2} />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">대기 중</div>
              <div className="text-3xl font-extrabold text-slate-900 mt-0.5">{stats.pending}</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 p-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
            <AlertCircle size={100} className="text-rose-600" />
          </div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center shadow-inner">
              <AlertCircle size={24} className="text-rose-600" strokeWidth={2} />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">실패</div>
              <div className="text-3xl font-extrabold text-slate-900 mt-0.5">{stats.failed}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Platform Status */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <CloudLightning className="text-indigo-500" size={20} />
            플랫폼 연동 상태
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {platforms.map((platform) => {
              const info = platformIcons[platform.platform]
              return (
                <div
                  key={platform.platform}
                  className={`p-4 rounded-xl border transition-colors ${platform.is_connected
                      ? 'border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50'
                      : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${platform.is_connected ? 'bg-white text-emerald-600 shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                      {info?.icon}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{info?.name}</div>
                      <div className={`text-xs mt-0.5 font-medium flex items-center gap-1 ${platform.is_connected ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {platform.is_connected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>}
                        {!platform.is_connected && <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>}
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Activity className="text-indigo-500" size={20} />
            최근 업로드 내역
          </h3>
          {recentContents.length > 0 ? (
            <div className="space-y-3 flex-1">
              {recentContents.map((content) => {
                const statusInfo = statusIcons[content.status] || statusIcons.draft;
                return (
                  <div
                    key={content.id}
                    className="flex justify-between p-4 bg-slate-50/80 rounded-xl hover:bg-slate-100/80 transition-colors border border-slate-100/50 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${statusInfo.bg} shadow-sm group-hover:scale-110 transition-transform`}>
                        {statusInfo.icon}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{content.title}</div>
                        <div className="text-sm text-slate-500 mt-0.5 font-medium">
                          {new Date(content.created_at).toLocaleDateString('ko-KR', {
                            year: 'numeric', month: 'long', day: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>
                    <div className={`text-xs font-bold px-3 py-1.5 rounded-full self-start ${statusInfo.bg} ${statusInfo.text}`}>
                      {content.status === 'completed' ? '업로드 완료' :
                        content.status === 'failed' ? '실패' :
                          content.status === 'uploading' ? '업로드 중' : '대기중'}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400">
              <div className="w-16 h-16 mb-4 rounded-full bg-slate-50 flex items-center justify-center">
                <FileText size={32} className="text-slate-300" />
              </div>
              <p className="font-medium text-slate-500">아직 등록된 콘텐츠가 없습니다</p>
              <p className="text-sm mt-1 text-slate-400">업로드 메뉴에서 새 콘텐츠를 추가해보세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
