import os
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable overrides."""
    PORTPULSE_ENV: str = "development"
    PORTPULSE_HOST: str = "127.0.0.1"
    PORTPULSE_PORT: int = 8000
    PORTPULSE_CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    
    # SQLite local dev file
    PORTPULSE_DB_URL: str = "sqlite:///./portpulse.db"
    PORTPULSE_DB_ECHO: bool = False
    
    # Security
    PORTPULSE_SECRET_KEY: str = "portpulse-super-secret-key-for-local-dev-2026"
    PORTPULSE_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    PORTPULSE_DEV_AUTH_BYPASS: bool = True
    
    # Ingestion Defaults
    PORTPULSE_SYNTHETIC_VESSELS: int = 50
    PORTPULSE_SYNTHETIC_BERTHS: int = 10
    PORTPULSE_SYNTHETIC_SEED: int = 42

    # Supabase PostgreSQL Migration
    SUPABASE_HOST: str = ""
    SUPABASE_PORT: str = "5432"
    SUPABASE_USER: str = ""
    SUPABASE_PASS: str = ""
    SUPABASE_DB: str = ""
    PORTPULSE_USE_SQLITE: bool = False

    @property
    def effective_db_url(self) -> str:
        if self.PORTPULSE_USE_SQLITE:
            return "sqlite:///./portpulse.db"
        if self.SUPABASE_HOST and self.SUPABASE_USER and self.SUPABASE_PASS and self.SUPABASE_DB:
            return f"postgresql+psycopg2://{self.SUPABASE_USER}:{self.SUPABASE_PASS}@{self.SUPABASE_HOST}:{self.SUPABASE_PORT}/{self.SUPABASE_DB}"
        return self.PORTPULSE_DB_URL

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.PORTPULSE_CORS_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=[
            os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ".env"),
            ".env"
        ],
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
