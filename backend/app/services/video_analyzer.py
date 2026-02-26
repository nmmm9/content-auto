import logging
from app.services import gemini_client

logger = logging.getLogger(__name__)

# ── 영상 분석 프롬프트 ──

ANALYSIS_PROMPT = """이 YouTube 영상을 분석해주세요. 반드시 아래 JSON 형식으로만 응답하세요.

{
  "summary": "영상 전체 요약 (200자 이내)",
  "topic": "메인 주제 (한 문장)",
  "keywords": ["키워드1", "키워드2", ...],
  "mood": "영상 분위기 (예: 밝고 에너지넘치는, 차분하고 정보전달, 감성적인 등)",
  "target_audience": "타겟층 설명",
  "key_points": ["핵심 포인트1", "핵심 포인트2", ...],
  "scenes": ["주요 장면1 설명", "주요 장면2 설명", ...],
  "audio_summary": "오디오/나레이션/대사 내용 요약 (없으면 '음성 없음')",
  "recommended_style": "추천 글 스타일"
}

모든 필드는 한국어로 작성해주세요. keywords는 10~20개, key_points와 scenes는 3~5개씩 작성해주세요."""


# ── 플랫폼별 변환 프롬프트 ──

PLATFORM_PROMPTS = {
    "youtube_shorts": {
        "system": "당신은 YouTube Shorts 콘텐츠 전문가입니다. 짧고 임팩트 있는 제목과 설명을 작성합니다.",
        "user": """다음 영상 분석 결과를 바탕으로 YouTube Shorts용 콘텐츠를 작성하세요.

영상 분석:
- 주제: {topic}
- 요약: {summary}
- 키워드: {keywords}
- 분위기: {mood}
- 타겟: {target_audience}
- 핵심 포인트: {key_points}

다음 JSON 형식으로만 응답하세요:
{{
  "title": "Shorts 제목 (40자 이내, 임팩트 있게)",
  "description": "짧은 설명 + #shorts 해시태그 포함 (500자 이내)",
  "hashtags": ["#shorts", "#해시태그1", "#해시태그2", ...]
}}""",
    },
    "naver_blog": {
        "system": "당신은 네이버 블로그 콘텐츠 전문가입니다. 네이버 검색 최적화(SEO)에 맞는 블로그 글을 작성합니다.",
        "user": """다음 영상 분석 결과를 바탕으로 네이버 블로그 글을 작성하세요.

영상 분석:
- 주제: {topic}
- 요약: {summary}
- 키워드: {keywords}
- 분위기: {mood}
- 핵심 포인트: {key_points}
- 장면 설명: {scenes}
- 오디오 내용: {audio_summary}

원본 영상 제목: {video_title}

다음 JSON 형식으로만 응답하세요:
{{
  "title": "블로그 제목 (네이버 검색 최적화)",
  "content": "블로그 본문 (소제목/본문/결론 구조, YouTube 영상 임베드 위치 [영상 삽입] 표시, 1000자 이상)",
  "tags": ["태그1", "태그2", ...]
}}""",
    },
    "facebook": {
        "system": "당신은 Facebook 소셜 미디어 전문가입니다. 공유와 참여를 유도하는 게시물을 작성합니다.",
        "user": """다음 영상 분석 결과를 바탕으로 Facebook 게시물을 작성하세요.

영상 분석:
- 주제: {topic}
- 요약: {summary}
- 분위기: {mood}
- 타겟: {target_audience}
- 핵심 포인트: {key_points}

다음 JSON 형식으로만 응답하세요:
{{
  "caption": "Facebook 게시물 본문 (이모지 활용, 질문으로 참여 유도, 300자 이내)",
  "hashtags": ["#해시태그1", "#해시태그2", ...]
}}""",
    },
    "instagram": {
        "system": "당신은 Instagram 콘텐츠 전문가입니다. 매력적인 캡션과 해시태그를 작성합니다.",
        "user": """다음 영상 분석 결과를 바탕으로 Instagram 게시물 캡션을 작성하세요.

영상 분석:
- 주제: {topic}
- 요약: {summary}
- 키워드: {keywords}
- 분위기: {mood}
- 타겟: {target_audience}

다음 JSON 형식으로만 응답하세요:
{{
  "caption": "Instagram 캡션 (이모지 포함, 줄바꿈 활용, 매력적으로)",
  "hashtags": ["#해시태그1", "#해시태그2", ...] (최대 30개)
}}""",
    },
    "instagram_reels": {
        "system": "당신은 Instagram Reels 전문가입니다. 짧고 강렬한 캡션을 작성합니다.",
        "user": """다음 영상 분석 결과를 바탕으로 Instagram Reels 캡션을 작성하세요.

영상 분석:
- 주제: {topic}
- 요약: {summary}
- 분위기: {mood}
- 핵심 포인트: {key_points}

다음 JSON 형식으로만 응답하세요:
{{
  "caption": "Reels 캡션 (짧고 임팩트 있게, 이모지 포함)",
  "hashtags": ["#reels", "#릴스", "#해시태그1", ...] (최대 30개)
}}""",
    },
    "threads": {
        "system": "당신은 Threads 소셜 미디어 전문가입니다. 대화형이고 공감을 이끄는 짧은 글을 작성합니다.",
        "user": """다음 영상 분석 결과를 바탕으로 Threads 게시물을 작성하세요.

영상 분석:
- 주제: {topic}
- 요약: {summary}
- 분위기: {mood}
- 타겟: {target_audience}

다음 JSON 형식으로만 응답하세요:
{{
  "caption": "Threads 게시물 (500자 이내, 대화체, 질문이나 의견 유도)",
  "hashtags": ["#해시태그1", "#해시태그2", ...]
}}""",
    },
}


async def analyze_video(video_path: str, model: str = gemini_client.DEFAULT_MODEL) -> dict:
    """영상을 Gemini에 업로드하고 분석 결과를 반환"""
    logger.info(f"Starting video analysis: {video_path} (model={model})")

    # 1. Gemini File API에 영상 업로드
    uploaded_file = await gemini_client.upload_video(video_path)

    try:
        # 2. 영상 분석 요청
        analysis = await gemini_client.analyze_video(uploaded_file, ANALYSIS_PROMPT, model=model)
        logger.info(f"Analysis complete: topic={analysis.get('topic', 'N/A')}")
        return analysis
    finally:
        # 3. 업로드 파일 정리
        await gemini_client.delete_file(uploaded_file.name)


async def transform_for_platform(
    analysis: dict,
    platform: str,
    video_title: str = "",
    model: str = gemini_client.DEFAULT_MODEL,
) -> dict:
    """분석 결과를 특정 플랫폼용 콘텐츠로 변환"""
    prompt_config = PLATFORM_PROMPTS.get(platform)
    if not prompt_config:
        raise ValueError(f"Unknown platform: {platform}")

    # 분석 결과에서 값 추출 (없으면 빈 문자열)
    format_data = {
        "topic": analysis.get("topic", ""),
        "summary": analysis.get("summary", ""),
        "keywords": ", ".join(analysis.get("keywords", [])),
        "mood": analysis.get("mood", ""),
        "target_audience": analysis.get("target_audience", ""),
        "key_points": "\n".join(f"- {p}" for p in analysis.get("key_points", [])),
        "scenes": "\n".join(f"- {s}" for s in analysis.get("scenes", [])),
        "audio_summary": analysis.get("audio_summary", ""),
        "video_title": video_title,
    }

    user_prompt = prompt_config["user"].format(**format_data)
    result = await gemini_client.generate_content(
        prompt=user_prompt,
        system_instruction=prompt_config["system"],
        model=model,
    )
    return result


async def transform_all_platforms(
    analysis: dict,
    platforms: list[str],
    video_title: str = "",
    model: str = gemini_client.DEFAULT_MODEL,
) -> dict[str, dict]:
    """모든 플랫폼에 대해 변환"""
    results = {}
    for platform in platforms:
        try:
            result = await transform_for_platform(analysis, platform, video_title, model=model)
            results[platform] = {"status": "success", "data": result}
        except Exception as e:
            logger.error(f"Transform failed for {platform}: {e}")
            results[platform] = {"status": "error", "error": str(e)}
    return results
