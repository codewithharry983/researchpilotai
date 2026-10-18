import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.database import Base


class MessageCitation(Base):
    __tablename__ = "message_citations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    message_id = Column(String(36), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_id = Column(String(36), ForeignKey("document_chunks.id", ondelete="SET NULL"), nullable=True, index=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    document_title = Column(String(255), nullable=False)
    page_number = Column(Integer, nullable=False, default=1)
    excerpt = Column(Text, nullable=False)
    relevance_score = Column(Float, nullable=False, default=1.0)
    is_exact_quote = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    message = relationship("Message", back_populates="citations")
    chunk = relationship("DocumentChunk", back_populates="citations")
