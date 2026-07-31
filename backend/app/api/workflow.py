import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from supabase import Client

from app.services import youtube_info, video_analyzer
from app.services.video_analyzer import (
    DEFAULT_BRAND_VOICE,
    PLATFORM_PROMPTS,
    TEMPLATE_VARIABLES,
)
from app.core.database import get_supabase

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
    youtube_url: str = ""
    brand_voice: str = ""
    # {platform: {"system": ..., "user": ...}} — 사용자가 편집한 프롬프트 (없으면 기본값)
    custom_prompts: dict[str, dict] | None = None


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


@router.get("/prompts")
def get_prompts():
    """플랫폼별 기본 변환 프롬프트를 반환합니다 (프론트 검토/수정 UI용)."""
    return {
        "brand_voice": DEFAULT_BRAND_VOICE,
        "platforms": {
            key: {"system": cfg["system"], "user": cfg["user"]}
            for key, cfg in PLATFORM_PROMPTS.items()
        },
        "variables": TEMPLATE_VARIABLES,
    }


@router.post("/transform", response_model=TransformResponse)
async def transform_content(request: TransformRequest):
    """분석 결과를 각 플랫폼에 맞게 변환합니다."""
    valid_platforms = list(PLATFORM_PROMPTS.keys())

    # 플랫폼 유효성 검사
    for p in request.platforms:
        if p not in valid_platforms:
            raise HTTPException(
                status_code=400,
                detail=f"지원하지 않는 플랫폼: {p}. 가능: {valid_platforms}",
            )

    try:
        video_title = request.video_info.get("title", "")
        video_id = request.video_info.get("video_id", "")
        video_url = request.youtube_url or (
            f"https://youtu.be/{video_id}" if video_id else ""
        )
        results = await video_analyzer.transform_all_platforms(
            analysis=request.analysis,
            platforms=request.platforms,
            video_title=video_title,
            video_url=video_url,
            brand_voice=request.brand_voice,
            custom_prompts=request.custom_prompts,
            model=request.model,
        )
        return TransformResponse(results=results)
    except Exception as e:
        logger.exception("Unexpected error in transform_content")
        raise HTTPException(status_code=500, detail=f"변환 오류: {str(e)[:200]}")


class SaveRequest(BaseModel):
    video_info: dict
    analysis: dict
    results: dict


@router.post("/save")
def save_workflow(body: SaveRequest, sb: Client = Depends(get_supabase)):
    """변환 결과를 contents 에 draft 로 저장한다."""
    generated = {
        platform: payload.get("data")
        for platform, payload in body.results.items()
        if isinstance(payload, dict) and payload.get("status") == "success"
    }

    row = {
        "title": body.video_info.get("title") or "제목 없음",
        "description": body.analysis.get("summary", ""),
        "tags": body.analysis.get("keywords", []),
        "thumbnail_path": body.video_info.get("thumbnail_url"),
        "status": "draft",
        "workflow_data": {
            "video_info": body.video_info,
            "analysis": body.analysis,
            "generated": generated,
        },
    }

    res = sb.table("contents").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save content")
    return {"content_id": res.data[0]["id"], "status": "draft"}
