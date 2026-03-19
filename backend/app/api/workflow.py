import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import youtube_info, video_analyzer

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request / Response 스키마 ──

class AnalyzeRequest(BaseModel):
    youtube_url: str
    model: str = "gemini-2.5-flash"


class VideoInfo(BaseModel):
    video_id: str
    title: str
    channel_name: str
    thumbnail_url: str


class AnalyzeResponse(BaseModel):
    video_info: dict
    analysis: dict


class TransformRequest(BaseModel):
    analysis: dict
    video_info: dict
    platforms: list[str]
    model: str = "gemini-2.5-flash"


class TransformResponse(BaseModel):
    results: dict


# ── 엔드포인트 ──

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_video(request: AnalyzeRequest):
    """YouTube URL을 받아 영상을 분석합니다.

    1. YouTube 메타데이터 추출 (oEmbed)
    2. yt-dlp로 영상 다운로드
    3. Gemini 3.1 Pro로 영상 분석
    """
    url = request.youtube_url.strip()

    try:
        # 1. URL 유효성 + 메타데이터
        try:
            info = await youtube_info.get_metadata(url)
        except ValueError as e:
            if "Cannot fetch video info" in str(e):
                raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다")
            raise HTTPException(status_code=400, detail=str(e))

        # 2. Gemini에 YouTube URL 직접 전달하여 분석
        try:
            analysis = await video_analyzer.analyze_video(url, model=request.model)
        except RuntimeError as e:
            raise HTTPException(
                status_code=500,
                detail=f"AI 분석 오류: {str(e)[:200]}",
            )

        return AnalyzeResponse(video_info=info, analysis=analysis)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in analyze_video")
        raise HTTPException(status_code=500, detail=f"서버 오류: {str(e)[:200]}")


@router.post("/transform", response_model=TransformResponse)
async def transform_content(request: TransformRequest):
    """분석 결과를 각 플랫폼에 맞게 변환합니다."""
    valid_platforms = [
        "youtube_shorts", "naver_blog", "facebook",
        "instagram", "instagram_reels", "threads",
        "linkedin", "living_sequence_lab",
    ]

    # 플랫폼 유효성 검사
    for p in request.platforms:
        if p not in valid_platforms:
            raise HTTPException(
                status_code=400,
                detail=f"지원하지 않는 플랫폼: {p}. 가능: {valid_platforms}",
            )

    try:
        video_title = request.video_info.get("title", "")
        results = await video_analyzer.transform_all_platforms(
            analysis=request.analysis,
            platforms=request.platforms,
            video_title=video_title,
            model=request.model,
        )
        return TransformResponse(results=results)
    except Exception as e:
        logger.exception("Unexpected error in transform_content")
        raise HTTPException(status_code=500, detail=f"변환 오류: {str(e)[:200]}")
