"""Hearth brain: local-only AI orchestration service (bind to the private Docker network)."""
from __future__ import annotations

import hmac
import json
import logging
import os

from fastapi import FastAPI, Header, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from fastapi.responses import Response

from .extract import extract_text
from .voice import VoiceUnavailable, available_voices, speak, transcribe
from .orchestrator import run_turn

logging.basicConfig(level=logging.INFO, format='{"t":"%(asctime)s","level":"%(levelname)s","msg":"%(message)s"}')
log = logging.getLogger("brain")
app = FastAPI(title="Hearth brain", docs_url=None, redoc_url=None)


def authorize(token: str | None):
    expected = os.environ.get("HEARTH_SERVICE_TOKEN", "")
    if not expected or not token or not hmac.compare_digest(token, expected):
        raise HTTPException(403, "forbidden")


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/chat")
async def chat(req: Request, x_hearth_token: str | None = Header(default=None)):
    authorize(x_hearth_token)
    payload = await req.json()

    async def gen():
        try:
            async for ev in run_turn(payload):
                yield json.dumps(ev) + "\n"
        except Exception as e:  # surface a readable message to the UI
            log.warning("turn failed: %s", e)
            yield json.dumps({"type": "token", "text": f"I couldn't reach a local model: {e}"}) + "\n"
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(gen(), media_type="application/x-ndjson")


@app.post("/extract")
async def extract(file: UploadFile, x_hearth_token: str | None = Header(default=None)):
    authorize(x_hearth_token)
    data = await file.read()
    text = extract_text(data, file.content_type or "")
    if text is None:
        raise HTTPException(415, "no extractable text")
    return {"text": text}


@app.get("/voices")
async def voices(x_hearth_token: str | None = Header(default=None)):
    authorize(x_hearth_token)
    return {"voices": available_voices()}


@app.post("/stt")
async def stt(file: UploadFile, x_hearth_token: str | None = Header(default=None)):
    authorize(x_hearth_token)
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(413, "recording too long")
    try:
        from starlette.concurrency import run_in_threadpool
        return {"text": await run_in_threadpool(transcribe, data)}
    except VoiceUnavailable as e:
        raise HTTPException(503, str(e))


@app.post("/tts")
async def tts(req: Request, x_hearth_token: str | None = Header(default=None)):
    authorize(x_hearth_token)
    body = await req.json()
    try:
        from starlette.concurrency import run_in_threadpool
        audio = await run_in_threadpool(speak, str(body.get("text", "")), str(body.get("voice", "en_US-amy-medium")))
    except VoiceUnavailable as e:
        raise HTTPException(503, str(e))
    return Response(audio, media_type="audio/wav")
