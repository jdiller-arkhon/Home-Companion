"""
Reason → propose → gate → observe loop.

The model only *proposes* tool calls. Every call is sent to the Hearth web app's
tool gateway, which validates arguments, applies permission levels and parks
sensitive actions for human approval. This service holds no credentials for
devices, money or data — it cannot act on its own.
"""
from __future__ import annotations

import json
import os
from typing import AsyncIterator, Awaitable, Callable

import httpx

from .ollama import chat_stream, pick_endpoint
from .prompt import build_system, build_user

MAX_STEPS = 6
WEB_URL = os.environ.get("HEARTH_WEB_URL", "http://127.0.0.1:3000")

ToolCaller = Callable[[str, dict, dict, bool], Awaitable[dict]]


async def call_web_tool(name: str, args: dict, payload: dict, tainted: bool) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as c:
        r = await c.post(
            f"{WEB_URL}/api/internal/tools",
            headers={"X-Hearth-Token": os.environ.get("HEARTH_SERVICE_TOKEN", "")},
            json={"name": name, "args": args, "user_id": payload["user"]["id"], "conversation_id": payload["conversation_id"], "tainted": tainted},
        )
        try:
            return r.json()
        except ValueError:
            return {"status": "error", "error": f"gateway HTTP {r.status_code}"}


async def run_turn(payload: dict, call_tool: ToolCaller = call_web_tool, stream=chat_stream, pick=pick_endpoint) -> AsyncIterator[dict]:
    base = await pick(payload["models"])
    model = payload["models"]["model"]
    messages: list[dict] = [{"role": "system", "content": build_system(payload)}]
    messages += [m for m in payload.get("history", []) if m.get("content")]
    messages.append({"role": "user", "content": build_user(payload)})
    tainted = False  # flips once untrusted text (documents) enters the context

    for _ in range(MAX_STEPS):
        text, calls = "", []
        async for chunk in stream(base, model, messages, payload.get("tools", [])):
            msg = chunk.get("message", {})
            if msg.get("content"):
                text += msg["content"]
                yield {"type": "token", "text": msg["content"]}
            calls += msg.get("tool_calls") or []
        messages.append({"role": "assistant", "content": text, **({"tool_calls": calls} if calls else {})})
        if not calls:
            return
        for call in calls:
            fn = call.get("function", {})
            name, args = fn.get("name", ""), fn.get("arguments") or {}
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except ValueError:
                    args = {}
            yield {"type": "tool", "name": name, "status": "running", "summary": name.replace("_", " ")}
            result = await call_tool(name, args, payload, tainted)
            status = result.get("status")
            yield {"type": "tool", "name": name, "status": status, "summary": result.get("summary"), "actionId": result.get("actionId")}
            if result.get("untrusted"):
                tainted = True
            if status == "ok":
                content = json.dumps(result.get("result"), default=str)[:12000]
            elif status == "needs_confirmation":
                content = f"Held for the person's approval ({result.get('level')}): {result.get('summary')}. It has NOT happened yet."
            else:
                content = f"Error: {result.get('error')}"
            messages.append({"role": "tool", "content": content, "tool_name": name})
    yield {"type": "token", "text": "\n\n(I stopped after several steps to stay safe — ask me to continue if needed.)"}
