import { useState, useEffect } from 'react'
import { Youtube, FileText, Facebook, Instagram, CheckCircle, XCircle, ExternalLink, Clapperboard, Film, AtSign, Linkedin, FlaskConical } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

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
    color: 'text-ink',
    bgColor: 'bg-paper-white',
    description: 'YouTube Data API v3를 통해 동영상을 업로드합니다.',
    setupUrl: 'https://console.cloud.google.com/'
  },
  naver_blog: {
    name: '네이버 블로그',
    icon: FileText,
    color: 'text-ink',
    bgColor: 'bg-paper-white',
    description: '네이버 오픈 API를 통해 블로그에 글을 작성합니다.',
    setupUrl: 'https://developers.naver.com/'
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    color: 'text-ink',
    bgColor: 'bg-paper-white',
    description: 'Meta Graph API를 통해 페이지에 게시물을 올립니다.',
    setupUrl: 'https://developers.facebook.com/'
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: 'text-ink',
    bgColor: 'bg-paper-white',
    description: 'Instagram Graph API를 통해 비즈니스 계정에 게시합니다.',
    setupUrl: 'https://developers.facebook.com/'
  },
  youtube_shorts: {
    name: 'YouTube Shorts',
    icon: Clapperboard,
    color: 'text-ink',
    bgColor: 'bg-paper-white',
    description: 'YouTube Shorts 영상을 업로드합니다. (YouTube API 공유)',
    setupUrl: 'https://console.cloud.google.com/'
  },
  instagram_reels: {
    name: 'Instagram Reels',
    icon: Film,
    color: 'text-ink',
    bgColor: 'bg-paper-white',
    description: 'Instagram Reels 영상을 업로드합니다. (Instagram API 공유)',
    setupUrl: 'https://developers.facebook.com/'
  },
  threads: {
    name: 'Threads',
    icon: AtSign,
    color: 'text-ink',
    bgColor: 'bg-paper-white',
    description: 'Threads API를 통해 게시물을 올립니다.',
    setupUrl: 'https://developers.facebook.com/'
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-ink',
    bgColor: 'bg-paper-white',
    description: 'LinkedIn API를 통해 게시물을 올립니다.',
    setupUrl: 'https://www.linkedin.com/developers/'
  },
  living_sequence_lab: {
    name: 'Living Sequence Lab',
    icon: FlaskConical,
    color: 'text-ink',
    bgColor: 'bg-paper-white',
    description: 'Living Sequence Lab 자체 사이트에 아티클을 게시합니다.',
    setupUrl: ''
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
      const response = await fetch(`${API_BASE}/platforms`)
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
      const response = await fetch(`${API_BASE}/platforms/${platform}/disconnect`, {
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
      <h2 className="text-2xl font-bold text-ink">설정</h2>

      {/* Platform Connections */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-ink">플랫폼 연동</h3>

        {Object.entries(platformInfo).map(([key, info]) => {
          const connection = connections.find(c => c.platform === key)
          const isConnected = connection?.is_connected || false
          const Icon = info.icon

          return (
            <div
              key={key}
              className={`p-6 rounded border border-paper-gray ${info.bgColor}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Icon size={32} className={info.color} />
                  <div>
                    <h4 className="font-semibold text-ink flex items-center gap-2">
                      {info.name}
                      {isConnected ? (
                        <CheckCircle size={16} className="text-success" />
                      ) : (
                        <XCircle size={16} className="text-ash-gray" />
                      )}
                    </h4>
                    <p className="text-sm text-charcoal">{info.description}</p>
                    {isConnected && connection?.account_name && (
                      <p className="text-sm text-muted-gray mt-1">
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
                    className="flex items-center gap-1 text-sm text-muted-gray hover:text-ink"
                  >
                    개발자 콘솔
                    <ExternalLink size={14} />
                  </a>
                  {isConnected ? (
                    <button
                      onClick={() => handleDisconnect(key)}
                      className="px-4 py-2 border border-danger text-danger rounded hover:bg-paper-beige"
                    >
                      연동 해제
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(key)}
                      className="px-4 py-2 bg-paper-ink text-paper-white rounded hover:bg-charcoal"
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
      <div className="bg-paper-beige p-6 rounded border border-paper-gray">
        <h3 className="font-semibold text-ink mb-2">API 키 설정 안내</h3>
        <p className="text-sm text-muted-gray mb-4">
          플랫폼 연동을 위해서는 각 플랫폼의 API 키가 필요합니다.
        </p>
        <div className="bg-paper-ivory p-4 rounded border border-paper-gray font-mono text-sm text-charcoal">
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
