from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.ai_transform import transform_content, transform_all_platforms

router = APIRouter()


class TransformRequest(BaseModel):
    title: str
    description: str
    tags: str
    platform: str


class TransformAllRequest(BaseModel):
    title: str
    description: str
    tags: str
    platforms: list[str]


@router.post("/transform")
async def ai_transform(request: TransformRequest):
    """Transform content for a single platform using AI"""
    try:
        result = await transform_content(
            platform=request.platform,
            title=request.title,
            description=request.description,
            tags=request.tags,
        )
        return {"platform": request.platform, "result": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI transform failed: {str(e)}")


@router.post("/transform-all")
async def ai_transform_all(request: TransformAllRequest):
    """Transform content for multiple platforms using AI"""
    try:
        results = await transform_all_platforms(
            title=request.title,
            description=request.description,
            tags=request.tags,
            platforms=request.platforms,
        )
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI transform failed: {str(e)}")


@router.get("/platforms")
async def get_supported_platforms():
    """Get list of platforms supported by AI transform"""
    return {
        "platforms": [
            {"id": "youtube", "name": "YouTube"},
            {"id": "youtube_shorts", "name": "YouTube Shorts"},
            {"id": "naver_blog", "name": "네이버 블로그"},
            {"id": "facebook", "name": "Facebook"},
            {"id": "instagram", "name": "Instagram"},
            {"id": "instagram_reels", "name": "Instagram Reels"},
            {"id": "threads", "name": "Threads"},
            {"id": "linkedin", "name": "LinkedIn"},
            {"id": "living_sequence_lab", "name": "Living Sequence Lab"},
        ]
    }
