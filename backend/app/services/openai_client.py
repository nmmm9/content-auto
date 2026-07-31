import json
import asyncio
import logging
from openai import AsyncOpenAI, RateLimitError
from app.core.config import settings

logger = logging.getLogger(__name__)

_client = None

MAX_RETRIES = 3
DEFAULT_MODEL = "gpt-5-mini"

# temperature 파라미터를 지원하지 않는 추론 모델 프리픽스
_NO_TEMPERATURE_PREFIXES = ("gpt-5", "o1", "o3", "o4")


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not set")
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


async def generate_content(prompt: str, system_instruction: str, model: str = DEFAULT_MODEL) -> dict:
    """텍스트 기반 콘텐츠 생성 (플랫폼 변환용). JSON 모드로 강제 출력."""
    client = get_client()

    kwargs: dict = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
    }
    if not model.startswith(_NO_TEMPERATURE_PREFIXES):
        kwargs["temperature"] = 0.7

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content
            return json.loads(content)
        except RateLimitError as e:
            if attempt >= MAX_RETRIES:
                raise
            delay = 5 * (attempt + 1)
            logger.warning(
                f"OpenAI rate limit (attempt {attempt + 1}/{MAX_RETRIES}), waiting {delay}s... ({e})"
            )
            await asyncio.sleep(delay)
