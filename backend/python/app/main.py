from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from pydantic import BaseModel

from inference import GenerationParams, SupraInference


# ── Lifespan: load model once at startup ──────────────────────────────────────

_engine: SupraInference | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    global _engine
    _engine = SupraInference()
    yield


app = FastAPI(title="SupraChat AI Backend", lifespan=lifespan)


# ── Schemas ───────────────────────────────────────────────────────────────────

class Message(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    max_new_tokens: int | None = None
    temperature: float | None = None
    top_p: float | None = None
    repetition_penalty: float | None = None


class ChatResponse(BaseModel):
    response: str


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict[str, object]:
    return {"ok": True, "service": "python-backend", "model_loaded": _engine is not None}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    assert _engine is not None, "Engine not initialized"

    params = GenerationParams(
        max_new_tokens=req.max_new_tokens or GenerationParams().max_new_tokens,
        temperature=req.temperature or GenerationParams().temperature,
        top_p=req.top_p or GenerationParams().top_p,
        repetition_penalty=req.repetition_penalty or GenerationParams().repetition_penalty,
    )

    history = [m.model_dump() for m in req.messages]
    response = _engine.generate(history=history, params=params)
    return ChatResponse(response=response)
