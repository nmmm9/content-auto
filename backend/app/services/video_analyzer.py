import asyncio
import logging
from app.services import gemini_client

logger = logging.getLogger(__name__)

# ── 영상 분석 프롬프트 ──

ANALYSIS_PROMPT = """당신은 유튜브 영상 콘텐츠 분석 전문가입니다.
이 영상을 시청하고 아래 모든 항목을 정확하게 분석해주세요.

## 분석 기준
- 영상의 시각적 요소(화면 구성, 자막, 그래픽)와 청각적 요소(말투, 배경음악, 효과음) 모두 반영
- 실제 영상 내용만 기반으로 작성 (추측 금지)
- 마케팅/SNS 콘텐츠 재가공 목적에 맞게 활용 가능한 정보 중심으로 분석

## 출력 형식 (반드시 아래 JSON 구조로만 응답)

{
  "summary": "영상 전체 내용을 상세하게 요약. 누가, 무엇을, 왜 하는 영상인지 명확히. 글자수 제한 없이 충분히 자세하게 작성",
  "detailed_summary": "영상의 처음부터 끝까지 시간 순서대로 전체 내용을 상세히 정리. 각 파트/챕터별로 무슨 내용을 다루는지, 어떤 장면이 나오는지, 출연자가 어떤 말을 하는지 구체적으로 서술. 최소 500자 이상으로 빠짐없이 기록",
  "topic": "핵심 주제를 한 문장으로 (예: '자취생을 위한 10분 원팬 요리 레시피')",
  "keywords": ["키워드1", "키워드2", ...],
  "mood": "영상의 전체적인 톤앤매너 (예: '밝고 유쾌한 예능 톤', '차분하고 신뢰감 있는 정보 전달')",
  "target_audience": "이 영상의 주요 시청 대상 (연령대, 관심사, 상황 포함. 예: '20~30대 자취생, 요리 초보자')",
  "key_points": ["핵심 포인트1", "핵심 포인트2", ...],  // 개수 제한 없이 모두 나열
  "scenes": ["타임스탬프와 함께 주요 장면 설명1", "주요 장면 설명2", ...],
  "audio_summary": "출연자의 핵심 발언/나레이션 내용을 가능한 한 상세하게 정리. 중요한 발언은 직접 인용 포함. 음성이 없으면 '음성 없음'",
  "recommended_style": "이 영상을 SNS 글로 재가공할 때 추천하는 글쓰기 톤 (예: '친근한 반말체로 꿀팁 공유', '전문적인 존댓말로 정보 전달')",
  "viral_hook": "이 영상에서 SNS에서 주목받을 수 있는 핵심 포인트/반전/명장면 (한 문장)",
  "content_type": "영상 유형 (예: 'vlog', 'tutorial', 'review', 'entertainment', 'news', 'shorts' 등)"
}

## 작성 규칙
- 모든 필드는 한국어로 작성
- summary: 글자수 제한 없이 충분히 상세하게
- detailed_summary: 영상 전체를 시간순으로 빠짐없이 정리 (최소 500자)
- keywords: 검색에 잘 걸리는 키워드 15~20개 (일반 키워드 + 롱테일 키워드 혼합)
- key_points: 영상의 핵심 메시지를 빠짐없이 모두 나열 (개수 제한 없음)
- scenes: 주요 장면 5~10개 (가능하면 대략적인 시간대 포함, 장면 설명을 구체적으로)
- audio_summary: 핵심 발언을 최대한 상세하게, 직접 인용 적극 활용"""


# ── 플랫폼별 변환 프롬프트 ──

PLATFORM_PROMPTS = {
    "youtube_shorts": {
        "system": """당신은 YouTube Shorts 알고리즘과 트렌드에 정통한 숏폼 콘텐츠 전문가입니다.

## 핵심 원칙
- 첫 1초에 시선을 사로잡는 후킹 제목 작성
- 검색 노출 + 추천 알고리즘 최적화
- 세로형 영상(9:16) 시청 환경 고려
- 10~30대가 공감하는 말투와 트렌드 반영""",
        "user": """다음 원본 영상 분석 결과를 바탕으로 YouTube Shorts용 콘텐츠를 작성하세요.

## 원본 영상 분석
- 주제: {topic}
- 요약: {summary}
- 상세 내용: {detailed_summary}
- 키워드: {keywords}
- 분위기: {mood}
- 타겟: {target_audience}
- 바이럴 포인트: {viral_hook}
- 핵심 포인트:
{key_points}

## 작성 가이드
1. title: 궁금증/놀라움/공감 유발 (40자 이내). 숫자/이모지/말줄임표 활용 가능
   - 좋은 예: "이거 모르면 손해..🤯", "3가지만 바꿨더니 인생 달라짐"
   - 나쁜 예: "유용한 정보 공유합니다", "꿀팁 알려드릴게요"
2. description: 영상 내용 요약 + 시청 유도 문구 + CTA(좋아요/구독) 포함 (500자 이내)
3. hashtags: #shorts 필수 포함, 검색량 높은 태그 + 니치 태그 혼합 (15~20개)

## 출력 (반드시 아래 JSON만 응답)
{{
  "title": "Shorts 제목",
  "description": "Shorts 설명",
  "hashtags": ["#shorts", "#해시태그1", "#해시태그2"]
}}""",
    },
    "naver_blog": {
        "system": """당신은 네이버 블로그 상위 노출 전문 작가입니다.

## 핵심 원칙
- 네이버 검색 알고리즘(C-Rank, D.I.A) 최적화
- 메인 키워드는 제목/본문 초반/소제목에 자연스럽게 반복
- 문단 사이 적절한 줄바꿈으로 가독성 확보
- 개인 경험담 + 정보성 콘텐츠 혼합하여 체류시간 극대화
- 이미지/영상 삽입 위치를 명확히 표시""",
        "user": """다음 영상 분석 결과를 바탕으로 네이버 블로그 글을 작성하세요.

## 원본 영상 분석
- 주제: {topic}
- 요약: {summary}
- 상세 내용: {detailed_summary}
- 키워드: {keywords}
- 분위기: {mood}
- 바이럴 포인트: {viral_hook}
- 핵심 포인트:
{key_points}
- 주요 장면:
{scenes}
- 오디오/나레이션 내용: {audio_summary}
- 원본 영상 제목: {video_title}

## 작성 가이드
1. title: 메인 키워드를 앞쪽에 배치, 30~40자, 검색 의도에 맞는 제목
   - 좋은 예: "자취 원룸 인테리어 꿀팁 5가지 (비용 10만원 이하)"
   - 나쁜 예: "예쁜 방 꾸미기~"
2. content 구조:
   - 도입부: 공감/상황 설명으로 시작 (1~2문단)
   - [영상 삽입] 위치 표시
   - 본문: 소제목(##)으로 구분, 핵심 포인트별 설명 (각 2~3문단)
   - [이미지 삽입] 위치 적절히 표시 (2~3곳)
   - 마무리: 요약 + 개인 의견/추천 + 영상 시청 유도
   - 총 1500자 이상
3. tags: 네이버 검색량 높은 태그 10~15개 (메인/서브/롱테일 혼합)

## 출력 (반드시 아래 JSON만 응답)
{{
  "title": "블로그 제목",
  "content": "블로그 본문 전체",
  "tags": ["태그1", "태그2"]
}}""",
    },
    "facebook": {
        "system": """당신은 Facebook 바이럴 콘텐츠 전문 마케터입니다.

## 핵심 원칙
- 피드 스크롤 중 멈추게 만드는 첫 2줄이 핵심
- 공유/댓글을 유도하는 감정적 트리거 활용
- 지인 태그 유도 문구 포함
- 이모지는 포인트로만 사용 (과하지 않게)
- 30~50대 사용자 비중이 높은 플랫폼 특성 반영""",
        "user": """다음 영상 분석 결과를 바탕으로 Facebook 게시물을 작성하세요.

## 원본 영상 분석
- 주제: {topic}
- 요약: {summary}
- 상세 내용: {detailed_summary}
- 분위기: {mood}
- 타겟: {target_audience}
- 바이럴 포인트: {viral_hook}
- 핵심 포인트:
{key_points}

## 작성 가이드
1. caption 구조 (300~500자):
   - 첫 줄: 강렬한 후킹 (질문/놀라운 사실/공감 문장)
   - 본문: 영상 핵심 내용 요약 (2~3문단, 줄바꿈 활용)
   - 마지막: CTA (댓글 유도 질문 또는 "이런 분들께 공유해주세요!" 등)
   - 좋은 첫 줄 예: "이거 아직도 모르는 사람 많더라고요...", "솔직히 저도 깜짝 놀랐습니다"
2. hashtags: 5~10개 (너무 많으면 Facebook에서 노출 감소)

## 출력 (반드시 아래 JSON만 응답)
{{
  "caption": "Facebook 게시물 전체 텍스트",
  "hashtags": ["#해시태그1", "#해시태그2"]
}}""",
    },
    "instagram": {
        "system": """당신은 Instagram 피드 콘텐츠 전문 크리에이터입니다.

## 핵심 원칙
- 캡션 첫 줄이 피드에서 '더보기' 전에 보이는 유일한 텍스트 → 최대한 매력적으로
- 줄바꿈과 이모지로 시각적 리듬감 부여
- 저장(북마크)을 유도하는 유용한 정보 포함
- 해시태그는 대형(100만+) + 중형(1만~100만) + 소형(1만 이하) 혼합
- 20~30대 여성 사용자 비중이 높은 특성 고려""",
        "user": """다음 영상 분석 결과를 바탕으로 Instagram 피드 게시물 캡션을 작성하세요.

## 원본 영상 분석
- 주제: {topic}
- 요약: {summary}
- 상세 내용: {detailed_summary}
- 키워드: {keywords}
- 분위기: {mood}
- 타겟: {target_audience}
- 바이럴 포인트: {viral_hook}
- 핵심 포인트:
{key_points}

## 작성 가이드
1. caption 구조:
   - 첫 줄: 후킹 한 줄 (이모지 시작, 궁금증/공감 유발)
   - 빈 줄
   - 본문: 핵심 내용 3~5줄 (이모지 포인트, 줄바꿈 활용)
   - 빈 줄
   - CTA: 저장/공유/댓글 유도 ("저장해두고 나중에 써먹어요 📌", "여러분은 어떠세요? 댓글로 알려주세요💬")
   - 빈 줄
   - 구분선: "·" 또는 "—"
2. hashtags: 20~30개 (대형 5개 + 중형 10개 + 소형/니치 10개)
   - 한국어 + 영어 혼합 가능

## 출력 (반드시 아래 JSON만 응답)
{{
  "caption": "Instagram 캡션 전체",
  "hashtags": ["#해시태그1", "#해시태그2"]
}}""",
    },
    "instagram_reels": {
        "system": """당신은 Instagram Reels 숏폼 콘텐츠 전문가입니다.

## 핵심 원칙
- Reels 캡션은 짧을수록 좋음 (영상 자체가 주인공)
- 첫 줄에서 영상 시청 이유를 제시
- 댓글 유도로 알고리즘 부스트
- 트렌디한 말투 (10~20대 타겟)
- 이모지 적극 활용하되 3~5개 이내""",
        "user": """다음 영상 분석 결과를 바탕으로 Instagram Reels 캡션을 작성하세요.

## 원본 영상 분석
- 주제: {topic}
- 요약: {summary}
- 상세 내용: {detailed_summary}
- 분위기: {mood}
- 바이럴 포인트: {viral_hook}
- 핵심 포인트:
{key_points}

## 작성 가이드
1. caption 구조 (100~200자):
   - 후킹 한 줄 (강렬하게, 말줄임표나 이모지 활용)
   - 핵심 메시지 1~2줄
   - 댓글 유도 한 줄 ("맞는 사람 ✋", "이거 나만 그래? 😂")
   - 좋은 예: "이거 진짜 미친 꿀팁이에요...🤫\\n나만 알고 싶었는데 공유합니다\\n아는 사람 댓글 🙋‍♀️"
2. hashtags: 15~25개 (#reels #릴스 필수 포함)

## 출력 (반드시 아래 JSON만 응답)
{{
  "caption": "Reels 캡션 전체",
  "hashtags": ["#reels", "#릴스", "#해시태그1"]
}}""",
    },
    "threads": {
        "system": """당신은 Threads 바이럴 콘텐츠 전문가입니다.

## 핵심 원칙
- Threads = 텍스트 기반 대화 플랫폼, 짧고 강한 의견이 핵심
- 트위터(X)처럼 짧은 문장 + 개인 의견/관점 필수
- "나"의 시점에서 작성 (개인적인 경험담/의견 톤)
- 댓글/리포스트를 유도하는 논쟁적이거나 공감가는 포인트
- 해시태그는 최소한으로 (3~5개)""",
        "user": """다음 영상 분석 결과를 바탕으로 Threads 게시물을 작성하세요.

## 원본 영상 분석
- 주제: {topic}
- 요약: {summary}
- 상세 내용: {detailed_summary}
- 분위기: {mood}
- 타겟: {target_audience}
- 바이럴 포인트: {viral_hook}
- 핵심 포인트:
{key_points}

## 작성 가이드
1. caption 구조 (200~400자):
   - 강한 첫 문장 (의견/놀라움/질문으로 시작)
   - 본문: 영상 내용을 "내 경험/의견"처럼 풀어쓰기 (2~3문장)
   - 마지막: 토론 유도 질문 ("여러분은 어떻게 생각하세요?", "나만 이렇게 느낀 건 아니겠지?")
   - 좋은 예: "솔직히 이거 보고 생각이 바뀌었다.\\n\\n그동안 ~라고 생각했는데...\\n\\n여러분은 어떠세요?"
   - 나쁜 예: "이 영상을 보고 정리해봤습니다." (광고/홍보 느낌 금지)
2. hashtags: 3~5개만 (Threads는 태그 적은 게 자연스러움)

## 출력 (반드시 아래 JSON만 응답)
{{
  "caption": "Threads 게시물 전체",
  "hashtags": ["#해시태그1", "#해시태그2"]
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
        "detailed_summary": analysis.get("detailed_summary", ""),
        "keywords": ", ".join(analysis.get("keywords", [])),
        "mood": analysis.get("mood", ""),
        "target_audience": analysis.get("target_audience", ""),
        "key_points": "\n".join(f"- {p}" for p in analysis.get("key_points", [])),
        "scenes": "\n".join(f"- {s}" for s in analysis.get("scenes", [])),
        "audio_summary": analysis.get("audio_summary", ""),
        "viral_hook": analysis.get("viral_hook", ""),
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
    """모든 플랫폼에 대해 변환 (rate limit 방지 딜레이 포함)"""
    results = {}
    for i, platform in enumerate(platforms):
        # 두 번째 호출부터 딜레이 (rate limit 방지)
        if i > 0:
            await asyncio.sleep(3)
        try:
            result = await transform_for_platform(analysis, platform, video_title, model=model)
            results[platform] = {"status": "success", "data": result}
            logger.info(f"Transform success: {platform} ({i + 1}/{len(platforms)})")
        except Exception as e:
            logger.error(f"Transform failed for {platform}: {e}")
            results[platform] = {"status": "error", "error": str(e)}
    return results
