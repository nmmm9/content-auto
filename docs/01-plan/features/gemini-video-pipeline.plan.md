# Plan: Gemini 비디오 분석 파이프라인

## 1. 개요

### 배경
현재 시스템은 UI 프로토타입 상태로, 실제 AI 연동이 없음.
- 백엔드: OpenAI GPT-4o-mini 기반 `ai_transform.py` 존재하나 프론트와 미연결
- 프론트: 워크플로우에서 YouTube URL 입력 → 데모 데이터만 표시
- 영상 분석 기능 자체가 없음 (텍스트 기반 변환만 존재)

### 목적
- YouTube 영상을 **Gemini 3.1 Pro**가 직접 분석하여 콘텐츠 추출
- 추출된 정보를 **Gemini 3.1 Pro**로 각 플랫폼 형식에 맞게 변환
- 프론트엔드 워크플로우와 실제 API 연동
- OpenAI 의존성 제거 → Gemini 단일 모델로 통일

### 대상 사용자
- YouTube 크리에이터가 영상 하나로 멀티 플랫폼 콘텐츠를 자동 생성

## 2. 기능 요구사항

### FR-01: YouTube 영상 정보 추출
- YouTube URL에서 videoId 추출
- YouTube Data API v3 또는 oEmbed로 메타데이터 수집 (제목, 설명, 채널명, 썸네일)
- 영상 다운로드 (yt-dlp) 또는 Gemini File API로 직접 처리

### FR-02: Gemini 영상 분석
- Gemini 3.1 Pro에 영상을 전달하여 분석
- 추출 항목:
  - 영상 주제/요약
  - 핵심 키워드 (10~20개)
  - 영상 분위기/톤
  - 주요 장면 설명
  - 대상 타겟층
  - 오디오 내용 (대사/나레이션 요약)
- 3분 영상 기준 ~52,200 토큰, 비용 ~$0.116/건

### FR-03: 플랫폼별 콘텐츠 변환 (Gemini)
- Gemini 3.1 Pro로 영상 분석 결과를 각 플랫폼에 맞게 변환
- 지원 플랫폼 7개:
  - **YouTube Shorts**: 짧은 제목 + 설명 + 해시태그
  - **네이버 블로그**: SEO 최적화 장문 포스트
  - **Facebook**: 공유형 포스트 + 해시태그
  - **Instagram**: 캡션 + 해시태그 30개
  - **Instagram Reels**: 짧은 캡션 + 트렌드 태그
  - **Threads**: 대화형 짧은 텍스트
- 기존 `ai_transform.py`의 프롬프트 구조 참고하되 Gemini 전용으로 재작성

### FR-04: 프론트엔드 API 연동
- 워크플로우에서 YouTube URL 입력 시 실제 백엔드 API 호출
- Phase별 진행 상태 실시간 표시:
  1. URL 입력 → 영상 정보 로딩
  2. Gemini 분석 중 (프로그레스)
  3. 플랫폼별 변환 완료 → 승인 대기
  4. 사용자 승인/수정
- 에러 핸들링 (API 실패, 영상 접근 불가 등)

### FR-05: 콘텐츠 승인/수정 플로우
- 각 플랫폼 노드에 생성된 콘텐츠 미리보기
- 승인: 그대로 확정
- 수정: 모달에서 텍스트 편집 후 확정
- 거부: 해당 플랫폼 건너뛰기

## 3. 기술 설계 방향

### 백엔드 변경사항

#### 새 파일
- `app/services/gemini_client.py` - Gemini API 클라이언트
- `app/services/video_analyzer.py` - 영상 분석 서비스
- `app/services/youtube_info.py` - YouTube 메타데이터 추출
- `app/api/workflow.py` - 워크플로우 전용 API 엔드포인트

#### 수정 파일
- `app/services/ai_transform.py` - OpenAI → Gemini로 교체
- `app/core/config.py` - Gemini API 키 설정 추가
- `requirements.txt` - google-genai 패키지 추가
- `.env.example` - GEMINI_API_KEY 추가

#### 핵심 API 엔드포인트
```
POST /api/workflow/analyze-video
  - Input: { youtube_url: string }
  - Output: { video_info, analysis_result }

POST /api/workflow/transform
  - Input: { analysis_result, platforms: string[] }
  - Output: { platform_contents: { [platform]: content } }

POST /api/workflow/approve
  - Input: { platform, content, approved: boolean }
  - Output: { status }
```

### 프론트엔드 변경사항

#### 수정 파일
- `pages/Workflow.tsx` - 실제 API 호출 로직 연결
- `components/workflow/PlatformNode.tsx` - 실제 데이터 표시

#### 데이터 흐름
```
URL 입력 → POST /analyze-video → 영상 분석 결과 수신
         → POST /transform → 플랫폼별 콘텐츠 수신
         → 각 노드에 콘텐츠 표시 → 승인 대기
```

### 패키지 의존성
```
# 백엔드 추가
google-genai>=1.0.0       # Gemini API 공식 SDK
yt-dlp>=2024.0.0          # YouTube 영상 다운로드
youtube-transcript-api     # 자막 추출 (보조)
```

## 4. 파이프라인 상세 흐름

```
[YouTube URL 입력]
     │
     ▼
[1] YouTube 메타데이터 추출 (oEmbed / Data API)
     ├─ 제목, 설명, 채널명, 썸네일
     │
     ▼
[2] 영상 다운로드 (yt-dlp) → 임시 파일
     │
     ▼
[3] Gemini 3.1 Pro 영상 분석
     ├─ File API로 영상 업로드
     ├─ 프롬프트: "이 영상을 분석해서 JSON으로 반환"
     ├─ 결과: 주제, 키워드, 분위기, 장면 설명, 타겟
     │
     ▼
[4] Gemini 3.1 Pro 플랫폼별 변환
     ├─ 분석 결과 + 플랫폼별 프롬프트
     ├─ 7개 플랫폼 동시 또는 순차 호출
     ├─ 결과: 각 플랫폼 맞춤 제목/설명/해시태그
     │
     ▼
[5] 사용자 승인/수정
     ├─ 각 노드에 콘텐츠 미리보기
     ├─ 승인 / 수정 / 거부
     │
     ▼
[6] (Phase 2) 각 플랫폼 자동 업로드
```

## 5. 비용 분석

| 항목 | 토큰 | 비용/건 |
|------|------|---------|
| 영상 분석 (3분) | ~52,200 input + ~2,000 output | ~$0.128 |
| 플랫폼 변환 (7개) | ~7,000 input + ~7,000 output | ~$0.098 |
| **총 비용/건** | | **~$0.226** |
| **월 100건** | | **~$22.60** |

## 6. 우선순위

| 순서 | 기능 | 중요도 | 난이도 |
|------|------|--------|--------|
| 1 | Gemini 클라이언트 설정 (FR-02) | 높음 | 낮음 |
| 2 | YouTube 메타데이터 추출 (FR-01) | 높음 | 낮음 |
| 3 | 영상 분석 서비스 (FR-02) | 높음 | 중간 |
| 4 | 플랫폼별 변환 (FR-03) | 높음 | 중간 |
| 5 | API 엔드포인트 (FR-04) | 높음 | 중간 |
| 6 | 프론트 API 연동 (FR-04) | 높음 | 중간 |
| 7 | 승인/수정 플로우 (FR-05) | 중간 | 낮음 |

## 7. 구현 범위

**Phase 1 (이번 PDCA):**
- Gemini 3.1 Pro API 연동
- YouTube 영상 정보 추출
- 영상 분석 → 플랫폼별 콘텐츠 변환
- 프론트엔드 워크플로우 실제 API 연결
- 승인/수정 플로우

**Phase 2 (다음):**
- 각 플랫폼 실제 업로드 API 연동
- 업로드 상태 추적
- 캘린더와 워크플로우 연동
- 배치 처리 (여러 영상 동시 처리)
