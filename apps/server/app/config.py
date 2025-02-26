from pydantic import BaseModel


class Settings(BaseModel):
    APP_NAME: str = "Navigator AI API"
    DEBUG: bool = True
    API_PREFIX: str = ""
    SNAPSHOTS_DIR: str = "dom_snapshots"

    # CORS settings
    CORS_ORIGINS: list[str] = ["*"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list[str] = ["*"]
    CORS_ALLOW_HEADERS: list[str] = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
