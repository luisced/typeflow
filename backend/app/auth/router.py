import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service
from app.auth.schemas import (
    AccessOut,
    ForgotPasswordIn,
    LoginIn,
    RegisterIn,
    ResetPasswordIn,
    TokenOut,
    UserOut,
)
from app.core.config import settings
from app.core.db import get_db
from app.core.ratelimit import limiter
from app.core.security import current_user_id

auth_router = APIRouter(prefix="/auth", tags=["auth"])
me_router = APIRouter(tags=["me"])

REFRESH_COOKIE = "typeflow_refresh"


def _set_refresh_cookie(response: Response, raw: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        raw,
        max_age=settings.refresh_token_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path="/auth")


@auth_router.post("/register", status_code=status.HTTP_201_CREATED, response_model=TokenOut)
@limiter.limit("5/minute")
async def register(
    request: Request,
    body: RegisterIn,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    if not settings.registration_open:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is closed on this instance",
        )
    user, access, refresh_raw = await service.register(
        db, body.email, body.username, body.display_name, body.password
    )
    _set_refresh_cookie(response, refresh_raw)
    return TokenOut(access_token=access, user=UserOut.model_validate(user))


@auth_router.post("/login", response_model=TokenOut)
@limiter.limit("5/minute")
async def login(
    request: Request,
    body: LoginIn,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user, access, refresh_raw = await service.login(db, body.identifier, body.password)
    _set_refresh_cookie(response, refresh_raw)
    return TokenOut(access_token=access, user=UserOut.model_validate(user))


@auth_router.post("/refresh", response_model=AccessOut)
@limiter.limit("30/minute")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    raw = request.cookies.get(REFRESH_COOKIE, "")
    access, new_raw = await service.rotate_refresh(db, raw)
    _set_refresh_cookie(response, new_raw)
    # user payload intentionally omitted; client already has it
    return AccessOut(access_token=access)


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    await service.logout(db, request.cookies.get(REFRESH_COOKIE))
    _clear_refresh_cookie(response)


@auth_router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordIn,
    db: AsyncSession = Depends(get_db),
):
    await service.request_password_reset(db, body.email)


@auth_router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    body: ResetPasswordIn,
    db: AsyncSession = Depends(get_db),
):
    await service.reset_password(db, body.token, body.password)


@me_router.get("/me", response_model=UserOut)
async def me(
    user_id: uuid.UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return UserOut.model_validate(await service.get_user(db, user_id))


@me_router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    response: Response,
    user_id: uuid.UUID = Depends(current_user_id),
    db: AsyncSession = Depends(get_db),
):
    await service.delete_account(db, user_id)
    _clear_refresh_cookie(response)
