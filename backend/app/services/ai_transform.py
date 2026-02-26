from openai import OpenAI
from app.core.config import settings

client = None

def get_client():
    global client
    if client is None:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return client


PLATFORM_PROMPTS = {
    "youtube": {
        "system": "당신은 YouTube 콘텐츠 전문가입니다. SEO에 최적화된 제목, 설명, 태그를 작성합니다.",
        "user": """다음 콘텐츠를 YouTube 영상용으로 변환해주세요.

원본 제목: {title}
원본 설명: {description}
태그: {tags}

다음 형식으로 JSON을 반환해주세요:
{{
  "title": "YouTube 최적화 제목 (60자 이내)",
  "description": "YouTube 설명 (해시태그 포함, 2000자 이내)",
  "tags": ["태그1", "태그2", "태그3", ...]
}}"""
    },
    "youtube_shorts": {
        "system": "당신은 YouTube Shorts 콘텐츠 전문가입니다. 짧고 임팩트 있는 제목과 설명을 작성합니다.",
        "user": """다음 콘텐츠를 YouTube Shorts용으로 변환해주세요.

원본 제목: {title}
원본 설명: {description}
태그: {tags}

다음 형식으로 JSON을 반환해주세요:
{{
  "title": "Shorts 제목 (40자 이내, 임팩트 있게)",
  "description": "짧은 설명 + #shorts 해시태그 포함 (500자 이내)",
  "tags": ["태그1", "태그2", "#shorts", ...]
}}"""
    },
    "naver_blog": {
        "system": "당신은 네이버 블로그 콘텐츠 전문가입니다. 네이버 검색 최적화(SEO)에 맞는 블로그 글을 작성합니다.",
        "user": """다음 콘텐츠를 네이버 블로그 글로 변환해주세요.

원본 제목: {title}
원본 설명: {description}
태그: {tags}

다음 형식으로 JSON을 반환해주세요:
{{
  "title": "블로그 제목 (네이버 검색 최적화)",
  "content": "블로그 본문 (HTML 형식, 소제목/본문/결론 구조, YouTube 영상 임베드 위치 포함, 1000자 이상)",
  "tags": ["태그1", "태그2", ...]
}}"""
    },
    "facebook": {
        "system": "당신은 Facebook 소셜 미디어 전문가입니다. 공유와 참여를 유도하는 게시물을 작성합니다.",
        "user": """다음 콘텐츠를 Facebook 게시물로 변환해주세요.

원본 제목: {title}
원본 설명: {description}
태그: {tags}

다음 형식으로 JSON을 반환해주세요:
{{
  "content": "Facebook 게시물 본문 (이모지 활용, 질문으로 참여 유도, 300자 이내)",
  "hashtags": ["#해시태그1", "#해시태그2", ...]
}}"""
    },
    "instagram": {
        "system": "당신은 Instagram 콘텐츠 전문가입니다. 매력적인 캡션과 해시태그를 작성합니다.",
        "user": """다음 콘텐츠를 Instagram 게시물 캡션으로 변환해주세요.

원본 제목: {title}
원본 설명: {description}
태그: {tags}

다음 형식으로 JSON을 반환해주세요:
{{
  "caption": "Instagram 캡션 (이모지 포함, 줄바꿈 활용, 매력적으로)",
  "hashtags": ["#해시태그1", "#해시태그2", ...] (최대 30개)
}}"""
    },
    "instagram_reels": {
        "system": "당신은 Instagram Reels 전문가입니다. 짧고 강렬한 캡션을 작성합니다.",
        "user": """다음 콘텐츠를 Instagram Reels 캡션으로 변환해주세요.

원본 제목: {title}
원본 설명: {description}
태그: {tags}

다음 형식으로 JSON을 반환해주세요:
{{
  "caption": "Reels 캡션 (짧고 임팩트 있게, 이모지 포함)",
  "hashtags": ["#해시태그1", "#reels", "#릴스", ...] (최대 30개)
}}"""
    },
    "threads": {
        "system": "당신은 Threads 소셜 미디어 전문가입니다. 대화형이고 공감을 이끄는 짧은 글을 작성합니다.",
        "user": """다음 콘텐츠를 Threads 게시물로 변환해주세요.

원본 제목: {title}
원본 설명: {description}
태그: {tags}

다음 형식으로 JSON을 반환해주세요:
{{
  "content": "Threads 게시물 (500자 이내, 대화체, 질문이나 의견 유도)",
  "hashtags": ["#해시태그1", "#해시태그2", ...]
}}"""
    },
}


async def transform_content(
    platform: str,
    title: str,
    description: str,
    tags: str,
) -> dict:
    """Transform content for a specific platform using GPT"""
    prompt_config = PLATFORM_PROMPTS.get(platform)
    if not prompt_config:
        raise ValueError(f"Unknown platform: {platform}")

    user_prompt = prompt_config["user"].format(
        title=title,
        description=description,
        tags=tags,
    )

    openai_client = get_client()
    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": prompt_config["system"]},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
    )

    import json
    result = json.loads(response.choices[0].message.content)
    return result


async def transform_all_platforms(
    title: str,
    description: str,
    tags: str,
    platforms: list[str],
) -> dict[str, dict]:
    """Transform content for multiple platforms"""
    results = {}
    for platform in platforms:
        try:
            result = await transform_content(platform, title, description, tags)
            results[platform] = {"status": "success", "data": result}
        except Exception as e:
            results[platform] = {"status": "error", "error": str(e)}
    return results
