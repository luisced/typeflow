import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.keyboards import repository as repo
from app.keyboards.models import Keyboard
from app.keyboards.schemas import KeyboardCreateIn, KeyboardOut, KeyboardUpdateIn


async def list_keyboards(db: AsyncSession, user_id: uuid.UUID) -> list[KeyboardOut]:
    rows = await repo.list_for_user(db, user_id)
    return [KeyboardOut.model_validate(k) for k in rows]


async def create_keyboard(
    db: AsyncSession, user_id: uuid.UUID, body: KeyboardCreateIn
) -> KeyboardOut:
    count = await repo.count_for_user(db, user_id)
    is_first = count == 0

    keyboard = Keyboard(
        user_id=user_id,
        name=body.name,
        layout=body.layout,
        is_active=is_first,
    )
    db.add(keyboard)
    await db.commit()
    await db.refresh(keyboard)
    return KeyboardOut.model_validate(keyboard)


async def update_keyboard(
    db: AsyncSession,
    user_id: uuid.UUID,
    keyboard_id: uuid.UUID,
    body: KeyboardUpdateIn,
) -> KeyboardOut:
    keyboard = await repo.get_by_id(db, user_id, keyboard_id)
    if keyboard is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Keyboard not found"
        )

    if body.name is not None:
        keyboard.name = body.name
    if body.layout is not None:
        keyboard.layout = body.layout
    if body.is_active is True:
        await repo.deactivate_all(db, user_id)
        keyboard.is_active = True
    elif body.is_active is False and keyboard.is_active:
        keyboard.is_active = False

    await db.commit()
    await db.refresh(keyboard)
    return KeyboardOut.model_validate(keyboard)


async def delete_keyboard(
    db: AsyncSession, user_id: uuid.UUID, keyboard_id: uuid.UUID
) -> None:
    keyboard = await repo.get_by_id(db, user_id, keyboard_id)
    if keyboard is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Keyboard not found"
        )

    was_active = keyboard.is_active
    await db.delete(keyboard)
    await db.flush()

    if was_active:
        next_kb = await repo.get_most_recent(db, user_id)
        if next_kb is not None:
            next_kb.is_active = True

    await db.commit()


async def resolve_for_run(
    db: AsyncSession,
    user_id: uuid.UUID,
    keyboard_id: uuid.UUID | None,
) -> Keyboard | None:
    if keyboard_id is not None:
        keyboard = await repo.get_by_id(db, user_id, keyboard_id)
        if keyboard is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid keyboardId",
            )
        return keyboard
    return await repo.get_active(db, user_id)
