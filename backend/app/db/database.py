import json
from typing import Generator
from sqlalchemy import create_engine, TypeDecorator, JSON, Text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

# Engine configuration
connect_args = {}
if settings.is_sqlite():
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class VectorType(TypeDecorator):
    """
    Hybrid Vector type:
    - On PostgreSQL: uses pgvector.sqlalchemy.Vector
    - On SQLite: stores as serialized JSON string/array of floats
    """
    impl = Text
    cache_ok = True

    def __init__(self, dimensions: int = 384, **kwargs):
        super().__init__(**kwargs)
        self.dimensions = dimensions

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            try:
                from pgvector.sqlalchemy import Vector
                return dialect.type_descriptor(Vector(self.dimensions))
            except ImportError:
                return dialect.type_descriptor(JSON())
        else:
            return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        # For SQLite / others, store as JSON string
        if isinstance(value, list):
            return json.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        if isinstance(value, str):
            try:
                return json.loads(value)
            except Exception:
                return []
        return value


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
