import re
import urllib.parse
from typing import Dict, List, Optional, Tuple, Any
import httpx
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound


class YouTubeVideoInfo:
    def __init__(
        self,
        video_id: str,
        url: str,
        title: str,
        channel_name: str,
        thumbnail_url: str,
        duration_seconds: Optional[int] = None,
        has_captions: bool = False,
        transcript_text: str = "",
        transcript_entries: Optional[List[Dict[str, Any]]] = None,
        error_message: Optional[str] = None
    ):
        self.video_id = video_id
        self.url = url
        self.title = title
        self.channel_name = channel_name
        self.thumbnail_url = thumbnail_url
        self.duration_seconds = duration_seconds
        self.has_captions = has_captions
        self.transcript_text = transcript_text
        self.transcript_entries = transcript_entries or []
        self.error_message = error_message


class YouTubeService:
    @staticmethod
    def extract_video_id(url: str) -> Optional[str]:
        if not url:
            return None
        url = url.strip()
        # Handle youtu.be/<id>
        match = re.search(r'(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})', url)
        if match:
            return match.group(1)
        # Handle plain 11 char ID
        if re.match(r'^[\w-]{11}$', url):
            return url
        return None

    def fetch_oembed_metadata(self, url: str, video_id: str) -> Dict[str, str]:
        canonical_url = f"https://www.youtube.com/watch?v={video_id}"
        oembed_url = f"https://www.youtube.com/oembed?url={urllib.parse.quote(canonical_url)}&format=json"
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(oembed_url)
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "title": data.get("title", f"YouTube Video ({video_id})"),
                        "channel_name": data.get("author_name", "YouTube Creator"),
                        "thumbnail_url": data.get("thumbnail_url", f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg")
                    }
        except Exception:
            pass
        return {
            "title": f"Educational Video ({video_id})",
            "channel_name": "Educational Channel",
            "thumbnail_url": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
        }

    def fetch_transcript(self, video_id: str) -> Tuple[bool, str, List[Dict[str, Any]], Optional[str]]:
        """
        Retrieve authorized transcript/captions using youtube-transcript-api.
        Preserves timestamps and section boundaries.
        """
        try:
            # First try direct retrieval
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['en', 'en-US', 'en-GB'])
        except Exception:
            try:
                # If specific language fails, list available transcripts and take first or generated
                transcript_obj_list = YouTubeTranscriptApi.list_transcripts(video_id)
                transcript_obj = transcript_obj_list.find_transcript(['en', 'en-US', 'en-GB'])
                transcript_list = transcript_obj.fetch()
            except (TranscriptsDisabled, NoTranscriptFound):
                return False, "", [], "Captions are disabled or unavailable for this video. You may paste a transcript below."
            except Exception as e:
                return False, "", [], f"Could not retrieve automated captions: {str(e)}"

        if not transcript_list:
            return False, "", [], "No speech captions found in video."

        # Format transcript with timestamps
        formatted_segments = []
        for entry in transcript_list:
            start_sec = int(entry.get('start', 0))
            minutes = start_sec // 60
            seconds = start_sec % 60
            ts = f"[{minutes:02d}:{seconds:02d}]"
            text = entry.get('text', '').strip()
            if text:
                formatted_segments.append(f"{ts} {text}")

        full_text = "\n".join(formatted_segments)
        return True, full_text, transcript_list, None

    def inspect_video(self, url: str, user_transcript: Optional[str] = None) -> YouTubeVideoInfo:
        video_id = self.extract_video_id(url)
        if not video_id:
            return YouTubeVideoInfo(
                video_id="",
                url=url,
                title="",
                channel_name="",
                thumbnail_url="",
                error_message="Invalid YouTube URL. Please provide a valid watch link (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/...)."
            )

        meta = self.fetch_oembed_metadata(url, video_id)
        
        # Check if user provided manual transcript
        if user_transcript and user_transcript.strip():
            clean_text = user_transcript.strip()
            words = len(clean_text.split())
            return YouTubeVideoInfo(
                video_id=video_id,
                url=f"https://www.youtube.com/watch?v={video_id}",
                title=meta["title"],
                channel_name=meta["channel_name"],
                thumbnail_url=meta["thumbnail_url"],
                has_captions=True,
                transcript_text=clean_text,
                transcript_entries=[{"start": 0, "text": clean_text}],
                error_message=None
            )

        # Retrieve captions from YouTube
        has_caps, text, entries, err = self.fetch_transcript(video_id)
        
        duration_est = None
        if entries:
            last_entry = entries[-1]
            duration_est = int(last_entry.get('start', 0) + last_entry.get('duration', 0))

        return YouTubeVideoInfo(
            video_id=video_id,
            url=f"https://www.youtube.com/watch?v={video_id}",
            title=meta["title"],
            channel_name=meta["channel_name"],
            thumbnail_url=meta["thumbnail_url"],
            duration_seconds=duration_est,
            has_captions=has_caps,
            transcript_text=text,
            transcript_entries=entries,
            error_message=err
        )


youtube_service = YouTubeService()
