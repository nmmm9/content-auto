# Design: Gemini 비디오 분석 파이프라인

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React + React Flow)                                  │
│                                                                 │
│  Workflow.tsx                                                    │
│    ├─ YouTube URL 입력                                          │
│    ├─ POST /api/workflow/analyze → 영상 분석 결과 수신          │
│    ├─ POST /api/workflow/transform → 플랫폼별 콘텐츠 수신      │
│    ├─ 각 PlatformNode에 콘텐츠 표시                             │
│    └─ 승인/수정/거부 처리                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP (fetch)
┌────────────────────────▼────────────────────────────────────────┐
│  Backend (FastAPI)                                              │
│                                                                 │
│  app/api/workflow.py          ← 새 워크플로우 전용 엔드포인트   │
│    ├─ POST /analyze           ← YouTube URL → 영상 분석        │
│    └─ POST /transform         ← 분석결과 → 플랫폼별 변환      │
│                                                                 │
│  app/services/                                                  │
│    ├─ gemini_client.py        ← Gemini API 클라이언트 (새)     │
│    ├─ youtube_info.py         ← YouTube 메타데이터 추출 (새)   │
│    ├─ video_analyzer.py       ← 영상 분석 서비스 (새)          │
│    └─ ai_transform.py        ← OpenAI→Gemini 교체 (수정)      │
└─────────────────────────────────────────────────────────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         Gemini API   YouTube    yt-dlp
         (3.1 Pro)    oEmbed     (다운로드)
```

## 2. 백엔드 상세 설계

### 2-1. 새 파일: `app/services/gemini_client.py`

Gemini API 공식 SDK(`google-genai`) 기반 클라이언트.

```python
# 주요 구조
class GeminiClient:
    """Gemini 3.1 Pro API 클라이언트"""

    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)
        self.model = "gemini-3.1-pro-preview"

    async def analyze_video(self, video_path: str, prompt: str) -> dict:
        """비디오 파일을 Gemini에 업로드하고 분석"""
        # 1. File API로 영상 업로드
        # 2. 업로드 완료 대기 (polling)
        # 3. 분석 요청 + JSON 응답 파싱
        # 4. 임시 파일 정리
        pass

    async def generate_content(self, prompt: str, system_instruction: str) -> dict:
        """텍스트 기반 콘텐츠 생성 (플랫폼 변환용)"""
        pass

    async def upload_file(self, file_path: str) -> object:
        """Gemini File API로 파일 업로드"""
        pass

    def _wait_for_file_active(self, file) -> None:
        """파일 처리 완료 대기"""
        pass
```

**설정값:**
- model: `gemini-3.1-pro-preview`
- temperature: 0.7 (변환), 0.3 (분석)
- response_mime_type: `application/json`

### 2-2. 새 파일: `app/services/youtube_info.py`

YouTube URL에서 메타데이터 추출.

```python
# 주요 구조
class YouTubeInfo:
    """YouTube 영상 정보 추출"""

    @staticmethod
    async def extract_video_id(url: str) -> str:
        """URL에서 videoId 추출"""
        # youtube.com/watch?v=, youtu.be/, youtube.com/shorts/ 지원
        pass

    @staticmethod
    async def get_metadata(url: str) -> dict:
        """oEmbed API로 메타데이터 조회"""
        # GET https://www.youtube.com/oembed?url={url}&format=json
        # 반환: title, author_name, thumbnail_url
        pass

    @staticmethod
    async def download_video(url: str, output_dir: str) -> str:
        """yt-dlp로 영상 다운로드 (최대 720p, 10분 제한)"""
        # yt-dlp -f "best[height<=720]" --max-filesize 200M
        # 반환: 다운로드된 파일 경로
        pass
```

**제한사항:**
- 최대 영상 길이: 10분 (Gemini 제한 고려)
- 최대 파일 크기: 200MB
- 해상도: 720p 이하 (토큰 절약)
- 다운로드 경로: `./uploads/temp/`

### 2-3. 새 파일: `app/services/video_analyzer.py`

Gemini를 이용한 영상 분석 서비스.

```python
# 주요 구조
class VideoAnalyzer:
    """Gemini 기반 영상 분석"""

    def __init__(self, gemini_client: GeminiClient):
        self.client = gemini_client

    async def analyze(self, video_path: str) -> VideoAnalysisResult:
        """영상 분석 실행"""
        # 프롬프트와 함께 Gemini에 전송
        # JSON 결과 파싱 후 반환
        pass

    async def transform_for_platform(
        self,
        analysis: VideoAnalysisResult,
        platform: str
    ) -> PlatformContent:
        """분석 결과를 특정 플랫폼용 콘텐츠로 변환"""
        pass

    async def transform_all_platforms(
        self,
        analysis: VideoAnalysisResult,
        platforms: list[str]
    ) -> dict[str, PlatformContent]:
        """모든 플랫폼에 대해 변환"""
        pass
```

**분석 프롬프트 (JSON 응답):**
```json
{
  "summary": "영상 요약 (200자)",
  "topic": "메인 주제",
  "keywords": ["키워드1", "키워드2", ...],
  "mood": "영상 분위기 (예: 밝고 에너지넘치는)",
  "target_audience": "타겟층",
  "key_points": ["핵심 포인트1", "핵심 포인트2", ...],
  "scenes": ["주요 장면1 설명", "주요 장면2 설명", ...],
  "audio_summary": "오디오/나레이션 내용 요약",
  "recommended_style": "추천 글 스타일"
}
```

**플랫폼별 변환 프롬프트:**
기존 `ai_transform.py`의 `PLATFORM_PROMPTS` 구조를 유지하되:
- 입력: 텍스트(title, description, tags) → 영상 분석 결과(VideoAnalysisResult)
- 모델: OpenAI gpt-4o-mini → Gemini 3.1 Pro
- 추가 컨텍스트: 영상 분위기, 키워드, 타겟층 정보 활용

**플랫폼별 응답 스키마:**
```python
PLATFORM_SCHEMAS = {
    "youtube_shorts": {
        "title": "str - 40자 이내",
        "description": "str - 500자 이내, #shorts 포함",
        "hashtags": "list[str]"
    },
    "naver_blog": {
        "title": "str - 네이버 SEO 최적화",
        "content": "str - HTML, 1000자 이상",
        "tags": "list[str]"
    },
    "facebook": {
        "caption": "str - 300자 이내, 이모지",
        "hashtags": "list[str]"
    },
    "instagram": {
        "caption": "str - 이모지 + 줄바꿈",
        "hashtags": "list[str] - 최대 30개"
    },
    "instagram_reels": {
        "caption": "str - 짧고 강렬",
        "hashtags": "list[str] - 최대 30개"
    },
    "threads": {
        "caption": "str - 500자 이내, 대화체",
        "hashtags": "list[str]"
    }
}
```

### 2-4. 새 파일: `app/api/workflow.py`

워크플로우 전용 API 엔드포인트.

```python
# 엔드포인트 설계

# --- 1. 영상 분석 ---
POST /api/workflow/analyze
Request:
{
    "youtube_url": "https://www.youtube.com/watch?v=xxxxx"
}
Response:
{
    "video_info": {
        "video_id": "xxxxx",
        "title": "영상 제목",
        "channel_name": "채널명",
        "thumbnail_url": "https://img.youtube.com/vi/xxxxx/mqdefault.jpg"
    },
    "analysis": {
        "summary": "...",
        "topic": "...",
        "keywords": [...],
        "mood": "...",
        "target_audience": "...",
        "key_points": [...],
        "scenes": [...],
        "audio_summary": "...",
        "recommended_style": "..."
    }
}
에러:
- 400: 잘못된 URL
- 404: 영상을 찾을 수 없음
- 500: Gemini API 오류

# --- 2. 플랫폼별 변환 ---
POST /api/workflow/transform
Request:
{
    "analysis": { ... },  // /analyze 응답의 analysis 객체
    "video_info": { ... },  // /analyze 응답의 video_info 객체
    "platforms": ["youtube_shorts", "naver_blog", "facebook", "instagram", "instagram_reels", "threads"]
}
Response:
{
    "results": {
        "youtube_shorts": {
            "status": "success",
            "data": { "title": "...", "description": "...", "hashtags": [...] }
        },
        "naver_blog": {
            "status": "success",
            "data": { "title": "...", "content": "...", "tags": [...] }
        },
        ...
    }
}
에러:
- 400: 잘못된 플랫폼
- 500: Gemini API 오류
```

### 2-5. 수정 파일: `app/core/config.py`

```python
# 추가 항목
GEMINI_API_KEY: Optional[str] = None
TEMP_DOWNLOAD_DIR: str = "./uploads/temp"
MAX_VIDEO_DURATION: int = 600  # 10분 (초)
MAX_VIDEO_SIZE: int = 200 * 1024 * 1024  # 200MB
```

### 2-6. 수정 파일: `app/api/__init__.py`

```python
# workflow 라우터 추가
from app.api.workflow import router as workflow_router
router.include_router(workflow_router, prefix="/workflow", tags=["workflow"])
```

### 2-7. 수정 파일: `requirements.txt`

```
# 추가
google-genai>=1.0.0
yt-dlp>=2024.0.0
```

### 2-8. 수정 파일: `app/services/ai_transform.py`

기존 OpenAI 코드는 **삭제하지 않고** deprecated 처리.
새 코드는 `video_analyzer.py`에서 Gemini로 처리.
향후 완전 제거 예정.

## 3. 프론트엔드 상세 설계

### 3-1. 수정 파일: `pages/Workflow.tsx`

**변경 핵심:**
- 데모 데이터 → 실제 API 호출
- `sampleGeneratedContent` 삭제 → API 응답 데이터 사용
- AI Transform 노드: `model: 'gpt-4o-mini'` → `model: 'gemini-3.1-pro'`

**API 호출 흐름:**
```typescript
// Phase 1: YouTube URL → 분석
const handleYoutubeUrl = async (url: string) => {
  setYoutubeUrl(url)
  // 즉시 노드에 URL 반영 (로딩 표시)
  updateMainNode({ status: 'pending', youtubeUrl: url })

  try {
    const res = await fetch('/api/workflow/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtube_url: url })
    })
    const data = await res.json()

    // 영상 정보 + 분석 결과 저장
    setVideoInfo(data.video_info)
    setAnalysisResult(data.analysis)

    // YouTube 노드에 실제 데이터 반영
    updateMainNode({
      status: 'ready',
      videoTitle: data.video_info.title,
      videoThumbnail: data.video_info.thumbnail_url,
      channelName: data.video_info.channel_name,
    })
  } catch (err) {
    updateMainNode({ status: 'failed', message: '영상 분석 실패' })
  }
}

// Phase 2: 실행 버튼 → 플랫폼별 변환
const runWorkflow = async () => {
  // AI Transform 노드 processing 표시
  // POST /api/workflow/transform 호출
  // 응답 받으면 각 플랫폼 노드에 generatedContent 설정
  // waiting_approval 상태로 전환
}
```

**새 상태 변수:**
```typescript
const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
```

**타입 정의 (새 파일 또는 인라인):**
```typescript
interface VideoInfo {
  video_id: string
  title: string
  channel_name: string
  thumbnail_url: string
}

interface AnalysisResult {
  summary: string
  topic: string
  keywords: string[]
  mood: string
  target_audience: string
  key_points: string[]
  scenes: string[]
  audio_summary: string
  recommended_style: string
}
```

### 3-2. 수정 파일: `components/workflow/PlatformNode.tsx`

**변경사항:**
- URL 입력 시 로딩 스피너 표시 (pending 상태)
- 분석 중 프로그레스 표시
- 에러 상태 메시지 표시

### 3-3. 수정 파일: `components/workflow/TemplateNode.tsx`

**변경사항:**
- 모델명 표시: `gpt-4o-mini` → `Gemini 3.1 Pro`
- 분석 진행 상태 표시 (분석 중 / 변환 중 / 완료)

## 4. 구현 순서

```
순서  파일                              작업
─────────────────────────────────────────────────────────
 1   requirements.txt                   google-genai, yt-dlp 추가
 2   app/core/config.py                 GEMINI_API_KEY 등 설정 추가
 3   .env.example                       GEMINI_API_KEY 추가
 4   app/services/gemini_client.py      Gemini API 클라이언트 (새)
 5   app/services/youtube_info.py       YouTube 메타데이터/다운로드 (새)
 6   app/services/video_analyzer.py     영상 분석 + 플랫폼 변환 (새)
 7   app/api/workflow.py                워크플로우 API 엔드포인트 (새)
 8   app/api/__init__.py                workflow 라우터 등록 (수정)
 9   frontend: Workflow.tsx             실제 API 연동 (수정)
10   frontend: TemplateNode.tsx         모델명 변경 (수정)
```

## 5. 에러 핸들링

| 상황 | 프론트 표시 | 백엔드 처리 |
|------|-----------|------------|
| 잘못된 URL | YouTube 노드 failed + "올바른 YouTube URL을 입력하세요" | 400 Bad Request |
| 비공개/삭제 영상 | YouTube 노드 failed + "영상에 접근할 수 없습니다" | 404 Not Found |
| 영상 너무 길거나 큼 | YouTube 노드 failed + "10분 이하 영상만 지원합니다" | 400 Bad Request |
| Gemini API 키 없음 | AI 노드 failed + "API 설정을 확인하세요" | 500 + 로그 |
| Gemini API 에러 | AI 노드 failed + "AI 분석 중 오류 발생" | 500 + 재시도 안내 |
| 네트워크 오류 | 해당 노드 failed + "네트워크 오류" | 프론트 catch |

## 6. 환경 변수

```env
# .env 추가 항목
GEMINI_API_KEY=your_gemini_api_key

# 기존 유지 (하위호환)
OPENAI_API_KEY=your_openai_api_key
```

## 7. 파일 변경 요약

| 구분 | 파일 | 작업 |
|------|------|------|
| **새 파일** | `backend/app/services/gemini_client.py` | Gemini API 클라이언트 |
| **새 파일** | `backend/app/services/youtube_info.py` | YouTube 정보 추출 |
| **새 파일** | `backend/app/services/video_analyzer.py` | 영상 분석 + 변환 |
| **새 파일** | `backend/app/api/workflow.py` | 워크플로우 API |
| **수정** | `backend/requirements.txt` | 패키지 추가 |
| **수정** | `backend/app/core/config.py` | Gemini 설정 추가 |
| **수정** | `backend/.env.example` | GEMINI_API_KEY |
| **수정** | `backend/app/api/__init__.py` | 라우터 등록 |
| **수정** | `frontend/src/pages/Workflow.tsx` | 실제 API 연동 |
| **수정** | `frontend/src/components/workflow/TemplateNode.tsx` | 모델명 변경 |
