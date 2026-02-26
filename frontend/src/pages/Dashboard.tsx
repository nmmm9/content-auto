import { useState, useEffect } from 'react'
import { Youtube, FileText, Facebook, Instagram, CheckCircle, Clock, AlertCircle, Clapperboard, Film, AtSign } from 'lucide-react'

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
    youtube: { icon: <Youtube size={24} />, name: 'YouTube' },
    youtube_shorts: { icon: <Clapperboard size={24} />, name: 'YouTube Shorts' },
    naver_blog: { icon: <FileText size={24} />, name: '네이버 블로그' },
    facebook: { icon: <Facebook size={24} />, name: 'Facebook' },
    instagram: { icon: <Instagram size={24} />, name: 'Instagram' },
    instagram_reels: { icon: <Film size={24} />, name: 'Instagram Reels' },
    threads: { icon: <AtSign size={24} />, name: 'Threads' },
  }

  const statusIcons: Record<string, React.ReactNode> = {
    completed: <CheckCircle size={16} className="text-green-500" />,
    pending: <Clock size={16} className="text-yellow-500" />,
    draft: <Clock size={16} className="text-gray-400" />,
    failed: <AlertCircle size={16} className="text-red-500" />,
    uploading: <Clock size={16} className="text-blue-500" />,
  }

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">로딩 중...</div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">대시보드</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500">전체 콘텐츠</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500">업로드 완료</div>
          <div className="text-3xl font-bold text-green-600 mt-2">{stats.completed}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500">대기 중</div>
          <div className="text-3xl font-bold text-yellow-600 mt-2">{stats.pending}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500">실패</div>
          <div className="text-3xl font-bold text-red-600 mt-2">{stats.failed}</div>
        </div>
      </div>

      {/* Platform Status */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">플랫폼 연동 상태</h3>
        <div className="grid grid-cols-4 gap-4">
          {platforms.map((platform) => {
            const info = platformIcons[platform.platform]
            return (
              <div
                key={platform.platform}
                className={`p-4 rounded-lg border ${
                  platform.is_connected ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={platform.is_connected ? 'text-green-600' : 'text-gray-400'}>
                    {info?.icon}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{info?.name}</div>
                    <div className={`text-sm ${platform.is_connected ? 'text-green-600' : 'text-gray-500'}`}>
                      {platform.is_connected ? '연동됨' : '미연동'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Uploads */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">최근 콘텐츠</h3>
        {recentContents.length > 0 ? (
          <div className="space-y-3">
            {recentContents.map((content) => (
              <div
                key={content.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    {statusIcons[content.status] || statusIcons.draft}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{content.title}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(content.created_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {content.status === 'completed' ? '완료' :
                   content.status === 'failed' ? '실패' :
                   content.status === 'uploading' ? '업로드 중' : '대기'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            아직 콘텐츠가 없습니다. 업로드 페이지에서 새 콘텐츠를 추가하세요.
          </div>
        )}
      </div>
    </div>
  )
}
