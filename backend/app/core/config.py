import os
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Application
    APP_NAME: str = "ResearchPilot AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # URLs & CORS
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    # Security
    SECRET_KEY: str = "supersecret-researchpilot-change-in-production-min32chars!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    COOKIE_NAME: str = "rp_access_token"
    COOKIE_SECURE: bool = False  # Set to True in HTTPS production
    COOKIE_SAMESITE: str = "lax"

    # Database
    # Default to sqlite for seamless out-of-the-box local development/testing; postgresql+psycopg in docker/production
    DATABASE_URL: str = "sqlite:///./researchpilot.db"

    # Storage
    UPLOAD_DIR: str = "./storage/uploads"
    MAX_UPLOAD_SIZE_MB: int = 25  # 25 MB max per PDF
    ALLOWED_MIME_TYPES: List[str] = ["application/pdf"]

    # Ingestion & Chunking
    CHUNK_SIZE: int = 800  # Target characters or subwords
    CHUNK_OVERLAP: int = 150
    EMBEDDING_PROVIDER: str = "auto"  # "auto", "openai", "gemini", or "offline"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 384  # 384 for compact/fast embeddings, 1536 for OpenAI ada/small-1536

    # Retrieval & RAG
    TOP_K: int = 5
    SIMILARITY_THRESHOLD: float = 0.35  # Minimum relevance for grounded answers
    KEYWORD_SEARCH_WEIGHT: float = 0.4
    VECTOR_SEARCH_WEIGHT: float = 0.6
    ENABLE_RERANKING: bool = False

    # LLM Settings
    LLM_PROVIDER: str = "auto"  # "auto", "openai", "gemini", "offline"
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    LLM_TEMPERATURE: float = 0.1  # Strict grounded temperature
    LLM_MAX_TOKENS: int = 2000

    # Studio & TTS Audio
    TTS_PROVIDER: str = "edge-tts"  # "edge-tts" (free neural voices) or "openai"

    # Rate Limiting
    RATE_LIMIT_AUTH_PER_MINUTE: int = 15
    RATE_LIMIT_AI_PER_MINUTE: int = 25

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")


settings = Settings()
