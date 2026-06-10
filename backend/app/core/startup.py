from urllib.parse import urlparse, urlunparse

from sqlalchemy import text

from app.core.config import settings
from app.core.db import engine
from app.core.logging import log_status


def mask_database_url(url: str) -> str:
    parsed = urlparse(url)
    if not parsed.scheme:
        return url
    if not parsed.password:
        return url
    host = parsed.hostname or ""
    if parsed.port:
        host = f"{host}:{parsed.port}"
    user = parsed.username or ""
    netloc = f"{user}:***@{host}" if user else host
    return urlunparse(parsed._replace(netloc=netloc))


async def _ping_database() -> None:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))


async def _dispose_engine() -> None:
    await engine.dispose()


async def run_startup(*, version: str) -> None:
    log_status("STARTUP", f"TypeFlow Sync API v{version}")

    if settings.env == "production" and settings.jwt_secret_is_weak():
        log_status("CHECK", "jwt_secret", "failed")
        log_status("READY", "", "failed")
        raise RuntimeError("jwt_secret is too weak for production")

    try:
        await _ping_database()
    except Exception as exc:
        log_status("CHECK", mask_database_url(settings.database_url), "failed")
        log_status("READY", "", "failed")
        raise RuntimeError("database unreachable") from exc

    log_status("CHECK", mask_database_url(settings.database_url), "ok")
    log_status(
        "CHECK",
        "rate_limit",
        "on" if settings.rate_limit_enabled else "off",
    )
    log_status(
        "CHECK",
        "access_log",
        "on" if settings.log_access else "off",
    )
    log_status("CHECK", f"cors ({len(settings.cors_origins)} origins)", "ok")
    log_status("READY", "", "ok")


async def run_shutdown() -> None:
    log_status("SHUTDOWN", "TypeFlow Sync API")
    await _dispose_engine()
    log_status("STOPPED", "", "ok")
