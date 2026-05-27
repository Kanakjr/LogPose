"""logpose-backend FastAPI entry.

Single-Captain pirate-RPG habit tracker. Internal-only behind X-LOGPOSE-KEY
when LOGPOSE_API_KEY is set. The Next.js UI injects the header in middleware.
"""

from __future__ import annotations

import logging
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.cron import daily_rollover, start_scheduler
from app.db import init_db
from app.routers import admin, captain, grand_line, health, journal, treasure, voyages
from app.seed import seed_voyages

log = logging.getLogger("logpose")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


_scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler
    init_db()
    inserted = seed_voyages(force_reset=False)
    if inserted:
        log.info("Seeded %d Straw Hat voyages on startup", inserted)
    if not settings.logpose_api_key:
        log.warning(
            "LOGPOSE_API_KEY is empty - /api routes are wide open. "
            "Set LOGPOSE_API_KEY in the environment for any real deployment."
        )
    if not settings.gemini_api_key:
        log.warning(
            "GEMINI_API_KEY is empty - the Marine Verifier will auto-reject every photo."
        )
    _scheduler = start_scheduler()
    yield
    if _scheduler:
        _scheduler.shutdown(wait=False)


app = FastAPI(title="logpose-backend", version="1.0.0", lifespan=lifespan)


# CORS for direct browser access in dev. Production runs behind the UI proxy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list() or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


_AUTH_SKIP_PATHS = {"/api/health"}


@app.middleware("http")
async def verify_key(request: Request, call_next):
    path = request.url.path
    if request.method == "OPTIONS":
        return await call_next(request)
    if not path.startswith("/api/"):
        return await call_next(request)
    if path in _AUTH_SKIP_PATHS:
        return await call_next(request)

    expected = settings.logpose_api_key
    if not expected:
        return await call_next(request)
    presented = request.headers.get("x-logpose-key", "")
    if not presented or not secrets.compare_digest(expected, presented):
        return JSONResponse(
            status_code=401,
            content={"detail": "invalid or missing X-LOGPOSE-KEY"},
        )
    return await call_next(request)


app.include_router(health.router, prefix="/api")
app.include_router(captain.router, prefix="/api")
app.include_router(voyages.router, prefix="/api")
app.include_router(treasure.router, prefix="/api")
app.include_router(journal.router, prefix="/api")
app.include_router(grand_line.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


# Serve uploaded voyage photos so the UI can show them back in the journal.
media_root = Path(settings.media_dir).parent
if media_root.exists():
    app.mount("/media", StaticFiles(directory=str(media_root)), name="media")


@app.get("/")
async def root() -> dict:
    return {"service": "logpose-backend", "version": "1.0.0"}


# Expose the rollover so we can invoke it via /api/admin/run_rollover for tests.
@app.post("/api/admin/run_rollover")
async def run_rollover() -> dict:
    return await daily_rollover()
