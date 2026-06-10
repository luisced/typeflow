import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import current_user_id
from app.keyboards import service
from app.keyboards.schemas import KeyboardCreateIn, KeyboardOut, KeyboardUpdateIn

router = APIRouter(prefix="/me/keyboards", tags=["keyboards"])


@router.get("", response_model=list[KeyboardOut], response_model_by_alias=True)
async def list_keyboards(
    user_id: uuid.UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_keyboards(db, user_id)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=KeyboardOut,
    response_model_by_alias=True,
)
async def create_keyboard(
    body: KeyboardCreateIn,
    user_id: uuid.UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_keyboard(db, user_id, body)


@router.patch("/{keyboard_id}", response_model=KeyboardOut, response_model_by_alias=True)
async def update_keyboard(
    keyboard_id: uuid.UUID,
    body: KeyboardUpdateIn,
    user_id: uuid.UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_keyboard(db, user_id, keyboard_id, body)


@router.delete("/{keyboard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_keyboard(
    keyboard_id: uuid.UUID,
    user_id: uuid.UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_keyboard(db, user_id, keyboard_id)
