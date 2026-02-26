import time
import json
import logging
from google import genai
from google.genai import types
from app.core.config import settings

logger = logging.getLogger(__name__)

_client = None


def get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set")
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


DEFAULT_MODEL = "gemini-2.5-flash"


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

    response = client.models.generate_content(
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

    response = client.models.generate_content(
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
