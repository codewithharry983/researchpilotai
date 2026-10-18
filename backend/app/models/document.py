import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), default="application/pdf", nullable=False)
    storage_path = Column(String(500), nullable=False)
    page_count = Column(Integer, default=0, nullable=False)
    status = Column(String(50), default="queued", index=True, nullable=False)  # queued, processing, completed, failed
    error_message = Column(Text, nullable=True)
    sha256_hash = Column(String(64), nullable=True, index=True)
    summary_markdown = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    owner = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    jobs = relationship("IngestionJob", back_populates="document", cascade="all, delete-orphan")
    notes = relationship("ResearchNote", back_populates="document", cascade="all, delete-orphan")
