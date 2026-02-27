import re
import time
import json
import asyncio
import logging
from google import genai
from google.genai import types
from app.core.config import settings

logger = logging.getLogger(__name__)

_client = None

MAX_RETRIES = 3


def get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set")
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


DEFAULT_MODEL = "gemini-2.5-flash"


def _parse_retry_delay(error_msg: str) -> float:
    """429 에러 메시지에서 retry delay 추출"""
    match = re.search(r'retry in (\d+(?:\.\d+)?)', str(error_msg), re.IGNORECASE)
    if match:
        return min(float(match.group(1)), 60.0)
    return 10.0


async def _retry_on_rate_limit(func, *args, **kwargs):
    """429 Rate Limit 자동 재시도 (최대 MAX_RETRIES회)"""
    for attempt in range(MAX_RETRIES + 1):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            error_str = str(e)
            if '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str:
                if attempt >= MAX_RETRIES:
                    raise
                delay = _parse_retry_delay(error_str)
                logger.warning(f"Rate limit hit (attempt {attempt + 1}/{MAX_RETRIES}), waiting {delay:.0f}s...")
                await asyncio.sleep(delay)
            else:
                raise


async def upload_video(file_path: str) -> object:
    """Gemini File API로 비디오 업로드 후 active 상태까지 대기"""
    client = get_client()
    logger.info(f"Uploading video to Gemini: {file_path}")

    uploaded = client.files.upload(file=file_path)

    # 파일 처리 완료 대기
    while uploaded.state == "PROCESSING":
        time.sleep(2)
        uploaded = client.files.get(name=uploaded.name)

    if uploaded.state != "ACTIVE":
        raise RuntimeError(f"File upload failed: state={uploaded.state}")

    logger.info(f"Video uploaded: {uploaded.name}, state={uploaded.state}")
    return uploaded


async def analyze_video(video_file: object, prompt: str, model: str = DEFAULT_MODEL) -> dict:
    """업로드된 비디오를 분석하여 JSON 결과 반환"""
    client = get_client()

    response = await _retry_on_rate_limit(
        client.models.generate_content,
        model=model,
        contents=[video_file, prompt],
        config=types.GenerateContentConfig(
            temperature=0.3,
            response_mime_type="application/json",
        ),
    )

    result = json.loads(response.text)
    return result


async def generate_content(prompt: str, system_instruction: str, model: str = DEFAULT_MODEL) -> dict:
    """텍스트 기반 콘텐츠 생성 (플랫폼 변환용)"""
    client = get_client()

    response = await _retry_on_rate_limit(
        client.models.generate_content,
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.7,
            response_mime_type="application/json",
        ),
    )

    result = json.loads(response.text)
    return result


async def delete_file(file_name: str) -> None:
    """업로드된 파일 삭제"""
    try:
        client = get_client()
        client.files.delete(name=file_name)
        logger.info(f"Deleted file: {file_name}")
    except Exception as e:
        logger.warning(f"Failed to delete file {file_name}: {e}")
