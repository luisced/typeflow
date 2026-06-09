import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import current_user_id
from app.runs import service
from app.runs.schemas import BatchIn, BatchOut, ProfileStatsOut, RunOut, SummaryPage, SyncPage

router = APIRouter(prefix="/runs", tags=["runs"])


@router.post("/batch", response_model=BatchOut)
async def push_batch(
    body: BatchIn,
    user_id: uuid.UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.push_batch(db, user_id, body.runs)


@router.get("/summary", response_model=SummaryPage, response_model_by_alias=True)
async def pull_summary(
    after: int = Query(default=0, ge=0),
    limit: int = Query(default=500, ge=1, le=1000),
    user_id: uuid.UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.summary_page(db, user_id, after, limit)


@router.get("/profile-stats", response_model=ProfileStatsOut, response_model_by_alias=True)
async def profile_stats(
    user_id: uuid.UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.profile_stats(db, user_id)


@router.get("/{run_id}", response_model=RunOut, response_model_by_alias=True)
async def get_run(
    run_id: str,
    user_id: uuid.UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_run(db, user_id, run_id)


@router.get("", response_model=SyncPage, response_model_by_alias=True)
async def pull(
    after: int = Query(default=0, ge=0),
    limit: int = Query(default=500, ge=1, le=1000),
    user_id: uuid.UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.pull_page(db, user_id, after, limit)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def clear(
    user_id: uuid.UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await service.clear_history(db, user_id)
