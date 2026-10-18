import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.db.database import Base, VectorType
from app.core.config import settings


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False, default=1)
    chunk_index = Column(Integer, nullable=False, default=0)
    content = Column(Text, nullable=False)
    token_count = Column(Integer, nullable=False, default=0)
    embedding = Column(VectorType(dimensions=settings.EMBEDDING_DIMENSIONS), nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    document = relationship("Document", back_populates="chunks")
    citations = relationship("MessageCitation", back_populates="chunk", cascade="all, delete-orphan")
