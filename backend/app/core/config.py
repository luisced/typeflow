from pydantic_settings import BaseSettings

_WEAK_JWT_SECRETS = frozenset({"dev-secret-change-me"})


class Settings(BaseSettings):
    """All config comes from TYPEFLOW_* env vars (or .env in dev)."""

    database_url: str = "sqlite+aiosqlite:///./typeflow.db"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    password_reset_minutes: int = 30
    env: str = "development"
    cors_origins: list[str] = [
        f"http://localhost:{p}" for p in range(3000, 3020)
    ]
    cookie_secure: bool = True
    rate_limit_enabled: bool = True
    log_level: str = "INFO"
    log_color: bool = True
    log_access: bool = True
    log_exclude_paths: list[str] = ["/healthz"]

    model_config = {"env_prefix": "TYPEFLOW_", "env_file": ".env"}

    def jwt_secret_is_weak(self) -> bool:
        return self.jwt_secret in _WEAK_JWT_SECRETS or len(self.jwt_secret) < 32


settings = Settings()
