import { useState } from 'react'
import {
  Youtube, FileText, Facebook, Instagram, Clapperboard, Film, AtSign,
  Link, Sparkles, ArrowRight, CheckCircle, Loader2, Play
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const derivedPlatforms = [
  { id: 'youtube_shorts', name: 'YouTube Shorts', icon: Clapperboard, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
  { id: 'naver_blog', name: '네이버 블로그', icon: FileText, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-pink-500', bg: 'bg-pink-50', border: 'border-pink-200' },
  { id: 'instagram_reels', name: 'Instagram Reels', icon: Film, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200' },
  { id: 'threads', name: 'Threads', icon: AtSign, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
]

interface YouTubeInfo {
  title: string
  description: string
  thumbnail: string
  channelName: string
  publishedAt: string
}

export default function Upload() {
  const navigate = useNavigate()
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeInfo, setYoutubeInfo] = useState<YouTubeInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(derivedPlatforms.map(p => p.id))
  const [step, setStep] = useState<'input' | 'confirm' | 'processing'>('input')

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
    ]
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  const fetchYouTubeInfo = async () => {
    const videoId = extractVideoId(youtubeUrl)
    if (!videoId) {
      alert('유효한 YouTube URL을 입력해주세요')
      return
    }

    setIsLoading(true)

    // TODO: 실제 YouTube API 연동 시 아래 코드 사용
    // const response = await fetch(`http://localhost:8000/api/youtube/info?video_id=${videoId}`)
    // const data = await response.json()

    // 임시 데모 데이터
    await new Promise(resolve => setTimeout(resolve, 1000))
    setYoutubeInfo({
      title: '유튜브 영상 제목이 여기에 표시됩니다',
      description: '영상 설명이 여기에 표시됩니다. AI가 이 정보를 기반으로 각 플랫폼에 맞는 콘텐츠를 생성합니다.',
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      channelName: '채널명',
      publishedAt: new Date().toLocaleDateString('ko-KR'),
    })

    setIsLoading(false)
    setStep('confirm')
  }

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    )
  }

  const selectAll = () => {
    setSelectedPlatforms(derivedPlatforms.map(p => p.id))
  }

  const deselectAll = () => {
    setSelectedPlatforms([])
  }

  const startProcess = () => {
    // 워크플로우 페이지로 이동
    navigate('/workflow')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Youtube size={28} className="text-red-500" />
        <h2 className="text-2xl font-bold text-gray-900">YouTube 영상에서 콘텐츠 생성</h2>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-4 py-4">
        <div className={`flex items-center gap-2 ${step === 'input' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'input' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>1</div>
          <span className="font-medium">URL 입력</span>
        </div>
        <ArrowRight size={16} className="text-gray-300" />
        <div className={`flex items-center gap-2 ${step === 'confirm' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'confirm' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>2</div>
          <span className="font-medium">플랫폼 선택</span>
        </div>
        <ArrowRight size={16} className="text-gray-300" />
        <div className={`flex items-center gap-2 ${step === 'processing' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'processing' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>3</div>
          <span className="font-medium">AI 변환 & 업로드</span>
        </div>
      </div>

      {/* Step 1: YouTube URL Input */}
      {step === 'input' && (
        <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Youtube size={32} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">YouTube 영상 URL을 입력하세요</h3>
            <p className="text-gray-500 text-sm mt-1">업로드된 YouTube 영상의 URL을 붙여넣으세요</p>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Link size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-lg"
              />
            </div>
            <button
              onClick={fetchYouTubeInfo}
              disabled={!youtubeUrl || isLoading}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  불러오는 중...
                </>
              ) : (
                <>
                  정보 가져오기
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>

          <div className="mt-6 text-center text-sm text-gray-500">
            지원 형식: youtube.com/watch, youtu.be, youtube.com/shorts
          </div>
        </div>
      )}

      {/* Step 2: Confirm & Select Platforms */}
      {step === 'confirm' && youtubeInfo && (
        <div className="space-y-6">
          {/* YouTube Video Info */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-start gap-2 mb-4">
              <Youtube size={20} className="text-red-500 mt-0.5" />
              <h3 className="font-semibold text-gray-900">원본 YouTube 영상</h3>
              <span className="ml-auto px-2 py-0.5 bg-red-100 text-red-600 text-xs font-medium rounded">메인</span>
            </div>
            <div className="flex gap-6">
              <img
                src={youtubeInfo.thumbnail}
                alt="Thumbnail"
                className="w-64 h-36 object-cover rounded-lg bg-gray-100"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/320x180?text=Thumbnail'
                }}
              />
              <div className="flex-1">
                <h4 className="font-bold text-lg text-gray-900 line-clamp-2">{youtubeInfo.title}</h4>
                <p className="text-sm text-gray-500 mt-1">{youtubeInfo.channelName} • {youtubeInfo.publishedAt}</p>
                <p className="text-sm text-gray-600 mt-3 line-clamp-3">{youtubeInfo.description}</p>
              </div>
            </div>
            <button
              onClick={() => setStep('input')}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700"
            >
              ← 다른 영상 선택
            </button>
          </div>

          {/* AI Transform Notice */}
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 flex items-start gap-3">
            <Sparkles size={20} className="text-indigo-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-indigo-900">AI가 각 플랫폼에 맞게 콘텐츠를 변환합니다</h4>
              <p className="text-sm text-indigo-700 mt-1">
                YouTube 영상의 제목, 설명, 태그를 분석하여 각 플랫폼에 최적화된 콘텐츠를 자동 생성합니다.
              </p>
            </div>
          </div>

          {/* Platform Selection */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">배포할 플랫폼 선택</h3>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-sm text-blue-600 hover:underline">전체 선택</button>
                <span className="text-gray-300">|</span>
                <button onClick={deselectAll} className="text-sm text-gray-500 hover:underline">전체 해제</button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {derivedPlatforms.map((platform) => {
                const isSelected = selectedPlatforms.includes(platform.id)
                return (
                  <button
                    key={platform.id}
                    onClick={() => togglePlatform(platform.id)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? `${platform.border} ${platform.bg} ring-2 ring-offset-1 ring-blue-500`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${platform.bg}`}>
                        <platform.icon size={22} className={platform.color} />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900">{platform.name}</div>
                        <div className="text-xs text-gray-500">
                          {isSelected ? '선택됨' : '선택 안됨'}
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle size={20} className="ml-auto text-blue-600" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={startProcess}
            disabled={selectedPlatforms.length === 0}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
          >
            <Play size={22} />
            AI 변환 & 업로드 시작 ({selectedPlatforms.length}개 플랫폼)
          </button>
        </div>
      )}
    </div>
  )
}
