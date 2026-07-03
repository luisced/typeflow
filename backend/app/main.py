import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.auth.router import auth_router, me_router
from app.core.config import settings
from app.core.db import engine
from app.core.logging import setup_logging
from app.core.middleware import RequestIdMiddleware, RequestLoggingMiddleware
from app.core.ratelimit import limiter
from app.core.startup import run_shutdown, run_startup
from app.keyboards.router import router as keyboards_router
from app.runs.router import router as runs_router

error_logger = logging.getLogger("app.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await run_startup(version=app.version)
    yield
    await run_shutdown()


def create_app() -> FastAPI:
    setup_logging(level=settings.log_level, color=settings.log_color)

    app = FastAPI(
        title="TypeFlow Sync API",
        version="0.2.0",
        lifespan=lifespan,
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    @app.exception_handler(Exception)
    async def unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", "-")
        error_logger.exception(
            "unhandled error request_id=%s %s %s",
            request_id,
            request.method,
            request.url.path,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
            headers={"X-Request-ID": request_id} if request_id != "-" else {},
        )

    if settings.log_access:
        app.add_middleware(
            RequestLoggingMiddleware,
            exclude_paths=frozenset(settings.log_exclude_paths),
        )

    app.add_middleware(RequestIdMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)
    app.include_router(me_router)
    app.include_router(keyboards_router)
    app.include_router(runs_router)

    @app.get("/healthz", tags=["ops"])
    async def healthz():
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ok"}

    return app


app = create_app()
