import re
import os
import shutil
import logging
import subprocess
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

# 백엔드 프로젝트 루트 (backend/ 폴더)
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def _get_temp_dir() -> str:
    """절대 경로로 변환된 temp 디렉토리 반환"""
    d = settings.TEMP_DOWNLOAD_DIR
    if not os.path.isabs(d):
        d = os.path.join(_BACKEND_ROOT, d)
    os.makedirs(d, exist_ok=True)
    return d

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


def _find_ytdlp() -> str:
    """yt-dlp 실행 파일 경로를 찾아 반환"""
    # 1. PATH에서 찾기
    found = shutil.which("yt-dlp")
    if found:
        return found

    # 2. Python -m yt_dlp 로 실행 가능한지 확인 (pip install한 경우)
    # 3. Windows 알려진 경로 확인
    home = os.path.expanduser("~")
    candidates = [
        os.path.join(home, "AppData", "Local", "Python", "pythoncore-3.14-64", "Scripts", "yt-dlp.exe"),
        os.path.join(home, "AppData", "Local", "Programs", "Python", "Python314", "Scripts", "yt-dlp.exe"),
        os.path.join(home, "AppData", "Local", "Programs", "Python", "Python313", "Scripts", "yt-dlp.exe"),
        os.path.join(home, "AppData", "Local", "Programs", "Python", "Python312", "Scripts", "yt-dlp.exe"),
        os.path.join(home, "AppData", "Local", "Programs", "Python", "Python311", "Scripts", "yt-dlp.exe"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c

    raise RuntimeError("yt-dlp를 찾을 수 없습니다. pip install yt-dlp 후 PATH에 추가해주세요.")


async def download_video(url: str) -> str:
    """yt-dlp로 영상 다운로드. 반환: 다운로드된 파일 경로"""
    video_id = extract_video_id(url)
    temp_dir = _get_temp_dir()
    output_path = os.path.join(temp_dir, f"{video_id}.mp4")

    # 이미 다운로드된 경우 재사용
    if os.path.exists(output_path):
        logger.info(f"Video already downloaded: {output_path}")
        return output_path

    logger.info(f"Downloading video: {video_id} → {temp_dir}")

    ytdlp_cmd = _find_ytdlp()
    output_template = os.path.join(temp_dir, f"{video_id}.%(ext)s")

    cmd = [
        ytdlp_cmd,
        "-f", "best[height<=720]/best",
        "--merge-output-format", "mp4",
        "--no-playlist",
        "-o", output_template,
        url,
    ]

    logger.info(f"Running: {ytdlp_cmd} -o {output_template}")

    process = subprocess.run(
        cmd, capture_output=True, text=True, timeout=300
    )

    logger.info(f"yt-dlp exit code: {process.returncode}")
    if process.stdout:
        logger.info(f"yt-dlp stdout:\n{process.stdout[-500:]}")
    if process.stderr:
        logger.warning(f"yt-dlp stderr:\n{process.stderr[-500:]}")

    if process.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {process.stderr[:500]}")

    # 다운로드된 파일 찾기
    if os.path.exists(output_path):
        file_size = os.path.getsize(output_path)
        logger.info(f"Downloaded: {output_path} ({file_size / 1024 / 1024:.1f}MB)")
        return output_path

    # 다른 확장자로 저장된 경우
    logger.info(f"Expected {output_path} not found. Scanning {temp_dir}...")
    for f in os.listdir(temp_dir):
        logger.info(f"  Found file: {f}")
        if f.startswith(video_id):
            found = os.path.join(temp_dir, f)
            logger.info(f"Matched: {found}")
            return found

    raise RuntimeError("Downloaded file not found")


def cleanup_temp_file(file_path: str) -> None:
    """임시 파일 삭제"""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Cleaned up: {file_path}")
    except Exception as e:
        logger.warning(f"Failed to cleanup {file_path}: {e}")
