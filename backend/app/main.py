import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.core.config import settings
from app.db.database import engine, Base
import app.models  # Ensure all models are registered on Base.metadata

from app.api.v1.auth import router as auth_router
from app.api.v1.documents import router as documents_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.research import router as research_router
from app.api.v1.notes import router as notes_router
from app.api.v1.usage import router as usage_router
from app.api.v1.health import router as health_router
from app.api.v1.studio import router as studio_router

# Setup logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("researchpilot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database tables exist
    logger.info("Initializing ResearchPilot AI database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialized successfully.")
    yield
    # Shutdown
    logger.info("ResearchPilot AI backend shutting down.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Intelligent Research Assistant — Evidence-based RAG application for academic and technical research.",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS Middleware (with credentials support for HttpOnly cookies)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handlers for structured client responses
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err["loc"])
        errors.append({"field": field, "message": err["msg"]})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Request validation failed", "errors": errors}
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception processing {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again later."}
    )


# Register Routers
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(conversations_router, prefix="/api/v1")
app.include_router(research_router, prefix="/api/v1")
app.include_router(notes_router, prefix="/api/v1")
app.include_router(usage_router, prefix="/api/v1")
app.include_router(studio_router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "api_docs": "/api/docs"
    }
