"""Ollama client with local/remote endpoint selection. Local network only — there is no cloud fallback."""
from __future__ import annotations

import json
from typing import AsyncIterator

import httpx


async def reachable(url: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=2.0) as c:
            r = await c.get(f"{url.rstrip('/')}/api/tags")
            return r.status_code == 200
    except httpx.HTTPError:
        return False


async def pick_endpoint(models: dict) -> str:
    """Prefer the GPU computer when configured and awake; otherwise the Pi."""
    remote, local = models.get("remote"), models["local"]
    if remote and models.get("prefer_remote") and await reachable(remote):
        return remote
    if await reachable(local):
        return local
    if remote and await reachable(remote):
        return remote
    raise RuntimeError("No local model server is reachable. Start Ollama on the Pi or your GPU computer.")


async def chat_stream(base: str, model: str, messages: list[dict], tools: list[dict]) -> AsyncIterator[dict]:
    """Yields Ollama /api/chat chunks (streaming, with native tool calling)."""
    # keep_alive keeps the model (and its prompt cache) warm between questions.
    # num_predict caps reply length: Mabel speaks her answers, so they must stay short.
    body = {"model": model, "messages": messages, "tools": tools, "stream": True, "keep_alive": "30m", "options": {"temperature": 0.3, "num_ctx": 8192, "num_predict": 220}}
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=5.0)) as c:
        async with c.stream("POST", f"{base.rstrip('/')}/api/chat", json=body) as r:
            if r.status_code == 404:
                raise RuntimeError(f"Model '{model}' isn't installed. Run: ollama pull {model}")
            r.raise_for_status()
            async for line in r.aiter_lines():
                if line.strip():
                    yield json.loads(line)
