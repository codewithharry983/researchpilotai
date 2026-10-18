import asyncio
import io
import time
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
import httpx
from app.core.config import settings


class BaseTTSProvider(ABC):
    @abstractmethod
    def synthesize_podcast(self, script_segments: List[Dict[str, Any]], style: str) -> bytes:
        """Synthesizes dialogue segments into complete MP3 audio bytes."""
        pass


class EdgeTTSProvider(BaseTTSProvider):
    """
    High-quality Microsoft Edge Neural TTS provider.
    Zero-config, completely free, and natively supports distinct multi-speaker neural voices.
    """
    VOICE_HOST_1 = "en-US-GuyNeural"          # Alex - articulate, warm academic voice
    VOICE_HOST_2 = "en-US-JennyNeural"        # Taylor - curious, dynamic researcher voice
    VOICE_NARRATOR = "en-US-ChristopherNeural" # Narrator - clear, authoritative narrator

    def _get_voice_for_speaker(self, speaker: str, style: str) -> str:
        s_lower = speaker.lower()
        if "taylor" in s_lower or "host 2" in s_lower:
            return self.VOICE_HOST_2
        elif "alex" in s_lower or "host 1" in s_lower:
            return self.VOICE_HOST_1
        elif style == "single_host":
            return self.VOICE_NARRATOR
        else:
            return self.VOICE_HOST_1

    async def _generate_segment_audio(self, text: str, voice: str) -> bytes:
        import edge_tts
        communicate = edge_tts.Communicate(text, voice)
        chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        return b"".join(chunks)

    async def _synthesize_async(self, script_segments: List[Dict[str, Any]], style: str) -> bytes:
        audio_parts = []
        for segment in script_segments:
            text = segment.get("text", "").strip()
            if not text:
                continue
            speaker = segment.get("speaker", "")
            voice = self._get_voice_for_speaker(speaker, style)
            try:
                segment_bytes = await self._generate_segment_audio(text, voice)
                if segment_bytes:
                    audio_parts.append(segment_bytes)
            except Exception as e:
                # If a specific voice errors, retry with default narrator
                try:
                    fallback_bytes = await self._generate_segment_audio(text, self.VOICE_NARRATOR)
                    if fallback_bytes:
                        audio_parts.append(fallback_bytes)
                except Exception:
                    pass

        return b"".join(audio_parts)

    def synthesize_podcast(self, script_segments: List[Dict[str, Any]], style: str) -> bytes:
        try:
            return asyncio.run(self._synthesize_async(script_segments, style))
        except RuntimeError:
            # Handle case where an asyncio event loop is already running in current thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(self._synthesize_async(script_segments, style))
            finally:
                loop.close()


class OpenAITTSProvider(BaseTTSProvider):
    """
    OpenAI TTS API provider (tts-1 / tts-1-hd).
    """
    VOICE_HOST_1 = "alloy"
    VOICE_HOST_2 = "nova"
    VOICE_NARRATOR = "onyx"

    def __init__(self, api_key: str, model: str = "tts-1"):
        self.api_key = api_key
        self.model = model

    def _get_voice(self, speaker: str, style: str) -> str:
        s_lower = speaker.lower()
        if "taylor" in s_lower or "host 2" in s_lower:
            return self.VOICE_HOST_2
        elif "alex" in s_lower or "host 1" in s_lower:
            return self.VOICE_HOST_1
        elif style == "single_host":
            return self.VOICE_NARRATOR
        return self.VOICE_HOST_1

    def synthesize_podcast(self, script_segments: List[Dict[str, Any]], style: str) -> bytes:
        url = "https://api.openai.com/v1/audio/speech"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        audio_parts = []
        with httpx.Client(timeout=60.0) as client:
            for segment in script_segments:
                text = segment.get("text", "").strip()
                if not text:
                    continue
                speaker = segment.get("speaker", "")
                voice = self._get_voice(speaker, style)
                payload = {
                    "model": self.model,
                    "input": text,
                    "voice": voice,
                    "response_format": "mp3"
                }
                resp = client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    audio_parts.append(resp.content)
        return b"".join(audio_parts)


class FallbackTTSProvider(BaseTTSProvider):
    """
    Lightweight fallback provider when network TTS is completely unavailable.
    """
    def synthesize_podcast(self, script_segments: List[Dict[str, Any]], style: str) -> bytes:
        # Create minimal valid MP3 container frames
        return b"\xff\xfb\x90\x00" * 200


def get_tts_provider() -> BaseTTSProvider:
    openai_key = settings.OPENAI_API_KEY or settings.LLM_API_KEY
    if openai_key and openai_key.startswith("sk-") and settings.TTS_PROVIDER == "openai":
        return OpenAITTSProvider(api_key=openai_key)
    try:
        import edge_tts
        return EdgeTTSProvider()
    except ImportError:
        return FallbackTTSProvider()


tts_service = get_tts_provider()
