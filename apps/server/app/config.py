from pydantic import BaseModel


class Settings(BaseModel):
    APP_NAME: str = "Navigator AI API"
    DEBUG: bool = True
    API_PREFIX: str = ""
    SNAPSHOTS_DIR: str = "dom_snapshots"

    # Redis settings
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""
    REDIS_PREFIX: str = "navigator:"
    REDIS_TASK_PREFIX: str = "task:"
    REDIS_TASK_HISTORY_PREFIX: str = "task_history:"
    REDIS_TASK_TTL: int = 60 * 60 * 24  # 24 hours

    # CORS settings
    CORS_ORIGINS: list[str] = ["*"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list[str] = ["*"]
    CORS_ALLOW_HEADERS: list[str] = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
