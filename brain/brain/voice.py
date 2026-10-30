"""
Local speech: Whisper (faster-whisper) for speech-to-text and Piper for text-to-speech.
Both run on-device; audio never leaves the home network. Models are downloaded
once into VOICE_DIR (see docs/VOICE.md).
"""
from __future__ import annotations

import io
import os
import tempfile
import wave
from functools import lru_cache

VOICE_DIR = os.environ.get("HEARTH_VOICE_DIR", "/models/voice")
WHISPER_MODEL = os.environ.get("HEARTH_WHISPER_MODEL", "base.en")  # tiny.en is faster on a Pi; small.en more accurate on a GPU box

# Curated Piper voices (female and male). Files: <id>.onnx + <id>.onnx.json in VOICE_DIR.
VOICES = {
    "en_US-amy-medium": "Amy — warm, female (US)",
    "en_US-lessac-medium": "Lessac — clear, female (US)",
    "en_US-ryan-medium": "Ryan — calm, male (US)",
    "en_US-joe-medium": "Joe — friendly, male (US)",
    "en_GB-alba-medium": "Alba — soft, female (UK)",
    "en_GB-northern_english_male-medium": "Northern — relaxed, male (UK)",
}


class VoiceUnavailable(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _whisper():
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        raise VoiceUnavailable("Speech recognition isn't installed (faster-whisper).") from e
    return WhisperModel(WHISPER_MODEL, device="auto", compute_type="int8", download_root=os.path.join(VOICE_DIR, "whisper"))


def transcribe(audio: bytes) -> str:
    model = _whisper()
    with tempfile.NamedTemporaryFile(suffix=".audio") as f:  # ffmpeg (via PyAV) sniffs the container: webm, mp4, wav
        f.write(audio)
        f.flush()
        segments, _ = model.transcribe(f.name, language="en", vad_filter=True, beam_size=1)
        return " ".join(s.text.strip() for s in segments).strip()


@lru_cache(maxsize=4)
def _piper(voice_id: str):
    try:
        from piper import PiperVoice
    except ImportError as e:
        raise VoiceUnavailable("Text-to-speech isn't installed (piper-tts).") from e
    path = os.path.join(VOICE_DIR, f"{voice_id}.onnx")
    if not os.path.exists(path):
        raise VoiceUnavailable(f"Voice '{voice_id}' isn't downloaded yet. Run scripts/fetch-voices.sh.")
    return PiperVoice.load(path)


def available_voices() -> list[dict]:
    return [{"id": k, "label": v, "installed": os.path.exists(os.path.join(VOICE_DIR, f"{k}.onnx"))} for k, v in VOICES.items()]


def speak(text: str, voice_id: str) -> bytes:
    if voice_id not in VOICES:
        raise VoiceUnavailable("Unknown voice")
    voice = _piper(voice_id)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        voice.synthesize_wav(text[:2000], w)
    return buf.getvalue()
