from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import get_db
from app.core.config import settings
from pathlib import Path

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    # Database readiness check
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    # Storage readiness check
    storage_ok = False
    try:
        p = Path(settings.UPLOAD_DIR)
        p.mkdir(parents=True, exist_ok=True)
        storage_ok = p.exists() and p.is_dir()
    except Exception:
        storage_ok = False

    status_code = status.HTTP_200_OK if (db_ok and storage_ok) else status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "healthy" if (db_ok and storage_ok) else "degraded",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "checks": {
            "database": "connected" if db_ok else "disconnected",
            "storage": "accessible" if storage_ok else "inaccessible",
            "database_driver": "sqlite" if settings.is_sqlite() else "postgresql",
            "embedding_provider": settings.EMBEDDING_PROVIDER,
            "llm_provider": settings.LLM_PROVIDER
        }
    }
