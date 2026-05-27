"""logpose-crew FastAPI entry - the Straw Hat Crew AI service."""

from __future__ import annotations

import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db import init_db
from app.routers import chat, health

log = logging.getLogger("crew")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if not settings.gemini_api_key:
        log.warning("GEMINI_API_KEY missing - crew chat will fall back to a static message.")
    if not settings.logpose_crew_key:
        log.warning("LOGPOSE_CREW_KEY missing - /api routes are wide open.")
    yield


app = FastAPI(title="logpose-crew", version="1.0.0", lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list() or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


_PUBLIC_PATHS = {"/api/health"}
_INTERNAL_PREFIXES = ("/api/crew/event",)


@app.middleware("http")
async def verify_key(request: Request, call_next):
    path = request.url.path
    if request.method == "OPTIONS":
        return await call_next(request)
    if not path.startswith("/api/"):
        return await call_next(request)
    if path in _PUBLIC_PATHS:
        return await call_next(request)

    # /api/crew/event is internal-only (game backend -> crew)
    if any(path.startswith(p) for p in _INTERNAL_PREFIXES):
        expected = settings.crew_internal_key or settings.logpose_crew_key
        if not expected:
            return await call_next(request)
        presented = request.headers.get("x-logpose-internal", "") or request.headers.get(
            "x-logpose-crew-key", ""
        )
        if not presented or not secrets.compare_digest(expected, presented):
            return JSONResponse(
                status_code=401,
                content={"detail": "invalid or missing internal key"},
            )
        return await call_next(request)

    expected = settings.logpose_crew_key
    if not expected:
        return await call_next(request)
    presented = request.headers.get("x-logpose-crew-key", "")
    if not presented or not secrets.compare_digest(expected, presented):
        return JSONResponse(
            status_code=401,
            content={"detail": "invalid or missing X-LOGPOSE-CREW-KEY"},
        )
    return await call_next(request)


app.include_router(health.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/")
async def root() -> dict:
    return {"service": "logpose-crew", "version": "1.0.0"}
