import re
import os
import logging
import subprocess
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

# YouTube URL 패턴
VIDEO_ID_PATTERN = re.compile(
    r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([^&\n?#]+)"
)


def extract_video_id(url: str) -> str:
    """YouTube URL에서 videoId 추출"""
    match = VIDEO_ID_PATTERN.search(url)
    if not match:
        raise ValueError(f"Invalid YouTube URL: {url}")
    return match.group(1)


async def get_metadata(url: str) -> dict:
    """oEmbed API로 메타데이터 조회"""
    video_id = extract_video_id(url)

    async with httpx.AsyncClient(timeout=10) as client:
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        response = await client.get(oembed_url)

        if response.status_code != 200:
            raise ValueError(f"Cannot fetch video info: status={response.status_code}")

        data = response.json()

    return {
        "video_id": video_id,
        "title": data.get("title", ""),
        "channel_name": data.get("author_name", ""),
        "thumbnail_url": f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
    }


async def download_video(url: str) -> str:
    """yt-dlp로 영상 다운로드. 반환: 다운로드된 파일 경로"""
    video_id = extract_video_id(url)
    output_path = os.path.join(settings.TEMP_DOWNLOAD_DIR, f"{video_id}.mp4")

    # 이미 다운로드된 경우 재사용
    if os.path.exists(output_path):
        logger.info(f"Video already downloaded: {output_path}")
        return output_path

    logger.info(f"Downloading video: {video_id}")

    cmd = [
        "yt-dlp",
        "-f", "best[height<=720][ext=mp4]/best[height<=720]/best",
        "--max-filesize", str(settings.MAX_VIDEO_SIZE),
        "--match-filter", f"duration<={settings.MAX_VIDEO_DURATION}",
        "--no-playlist",
        "-o", output_path,
        url,
    ]

    process = subprocess.run(
        cmd, capture_output=True, text=True, timeout=300
    )

    if process.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {process.stderr[:500]}")

    if not os.path.exists(output_path):
        # yt-dlp이 다른 확장자로 저장한 경우 검색
        for f in os.listdir(settings.TEMP_DOWNLOAD_DIR):
            if f.startswith(video_id):
                return os.path.join(settings.TEMP_DOWNLOAD_DIR, f)
        raise RuntimeError("Downloaded file not found")

    file_size = os.path.getsize(output_path)
    logger.info(f"Downloaded: {output_path} ({file_size / 1024 / 1024:.1f}MB)")
    return output_path


def cleanup_temp_file(file_path: str) -> None:
    """임시 파일 삭제"""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Cleaned up: {file_path}")
    except Exception as e:
        logger.warning(f"Failed to cleanup {file_path}: {e}")
