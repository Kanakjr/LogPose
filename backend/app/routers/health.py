"""Liveness + version probe."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "logpose-backend"}
