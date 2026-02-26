import { useState, useEffect } from 'react'
import { Youtube, FileText, Facebook, Instagram, CheckCircle, XCircle, ExternalLink, Clapperboard, Film, AtSign } from 'lucide-react'

interface PlatformConnection {
  id: number
  platform: string
  is_connected: boolean
  account_name: string | null
  account_id: string | null
}

const platformInfo: Record<string, {
  name: string
  icon: typeof Youtube
  color: string
  bgColor: string
  description: string
  setupUrl: string
}> = {
  youtube: {
    name: 'YouTube',
    icon: Youtube,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    description: 'YouTube Data API v3를 통해 동영상을 업로드합니다.',
    setupUrl: 'https://console.cloud.google.com/'
  },
  naver_blog: {
    name: '네이버 블로그',
    icon: FileText,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    description: '네이버 오픈 API를 통해 블로그에 글을 작성합니다.',
    setupUrl: 'https://developers.naver.com/'
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    description: 'Meta Graph API를 통해 페이지에 게시물을 올립니다.',
    setupUrl: 'https://developers.facebook.com/'
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-500',
    bgColor: 'bg-pink-50',
    description: 'Instagram Graph API를 통해 비즈니스 계정에 게시합니다.',
    setupUrl: 'https://developers.facebook.com/'
  },
  youtube_shorts: {
    name: 'YouTube Shorts',
    icon: Clapperboard,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    description: 'YouTube Shorts 영상을 업로드합니다. (YouTube API 공유)',
    setupUrl: 'https://console.cloud.google.com/'
  },
  instagram_reels: {
    name: 'Instagram Reels',
    icon: Film,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    description: 'Instagram Reels 영상을 업로드합니다. (Instagram API 공유)',
    setupUrl: 'https://developers.facebook.com/'
  },
  threads: {
    name: 'Threads',
    icon: AtSign,
    color: 'text-gray-800',
    bgColor: 'bg-gray-50',
    description: 'Threads API를 통해 게시물을 올립니다.',
    setupUrl: 'https://developers.facebook.com/'
  },
}

export default function Settings() {
  const [connections, setConnections] = useState<PlatformConnection[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchConnections()
  }, [])

  const fetchConnections = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/platforms/')
      if (response.ok) {
        const data = await response.json()
        setConnections(data)
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = (platform: string) => {
    // TODO: Implement OAuth flow
    alert(`${platformInfo[platform].name} 연동은 API 키 설정 후 사용 가능합니다.\n\n설정 방법:\n1. ${platformInfo[platform].setupUrl} 접속\n2. 앱 생성 및 API 키 발급\n3. backend/.env 파일에 키 입력`)
  }

  const handleDisconnect = async (platform: string) => {
    if (!confirm(`${platformInfo[platform].name} 연동을 해제하시겠습니까?`)) return

    try {
      const response = await fetch(`http://localhost:8000/api/platforms/${platform}/disconnect`, {
        method: 'POST',
      })
      if (response.ok) {
        fetchConnections()
      }
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">로딩 중...</div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">설정</h2>

      {/* Platform Connections */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">플랫폼 연동</h3>

        {Object.entries(platformInfo).map(([key, info]) => {
          const connection = connections.find(c => c.platform === key)
          const isConnected = connection?.is_connected || false
          const Icon = info.icon

          return (
            <div
              key={key}
              className={`p-6 rounded-lg border border-gray-200 ${info.bgColor}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Icon size={32} className={info.color} />
                  <div>
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      {info.name}
                      {isConnected ? (
                        <CheckCircle size={16} className="text-green-500" />
                      ) : (
                        <XCircle size={16} className="text-gray-400" />
                      )}
                    </h4>
                    <p className="text-sm text-gray-600">{info.description}</p>
                    {isConnected && connection?.account_name && (
                      <p className="text-sm text-gray-500 mt-1">
                        연결된 계정: {connection.account_name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href={info.setupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                  >
                    개발자 콘솔
                    <ExternalLink size={14} />
                  </a>
                  {isConnected ? (
                    <button
                      onClick={() => handleDisconnect(key)}
                      className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                    >
                      연동 해제
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(key)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      연동하기
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* API Keys Info */}
      <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
        <h3 className="font-semibold text-yellow-800 mb-2">API 키 설정 안내</h3>
        <p className="text-sm text-yellow-700 mb-4">
          플랫폼 연동을 위해서는 각 플랫폼의 API 키가 필요합니다.
        </p>
        <div className="bg-yellow-100 p-4 rounded font-mono text-sm text-yellow-900">
          <p># backend/.env 파일 예시</p>
          <p className="mt-2">YOUTUBE_CLIENT_ID=your_client_id</p>
          <p>YOUTUBE_CLIENT_SECRET=your_client_secret</p>
          <p className="mt-2">NAVER_CLIENT_ID=your_naver_client_id</p>
          <p>NAVER_CLIENT_SECRET=your_naver_client_secret</p>
          <p className="mt-2">META_APP_ID=your_meta_app_id</p>
          <p>META_APP_SECRET=your_meta_app_secret</p>
        </div>
      </div>
    </div>
  )
}
