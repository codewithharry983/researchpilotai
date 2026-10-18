import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.db.database import Base


class StudioSession(Base):
    __tablename__ = "studio_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    session_title = Column(String(255), nullable=False)
    source_type = Column(String(50), nullable=False, index=True)  # "documents" | "youtube"
    source_metadata = Column(JSON, nullable=False, default=dict)
    
    podcast_style = Column(String(50), default="two_host", nullable=False)
    target_duration = Column(String(50), default="3-5", nullable=False)
    summary_length = Column(String(50), default="detailed", nullable=False)
    generate_notes = Column(Boolean, default=True, nullable=False)
    
    summary_data = Column(JSON, nullable=True)
    podcast_script = Column(JSON, nullable=True)
    notes_data = Column(JSON, nullable=True)
    
    audio_storage_path = Column(String(500), nullable=True)
    audio_duration_seconds = Column(Float, nullable=True)
    
    status = Column(String(50), default="queued", index=True, nullable=False)
    progress = Column(Integer, default=0, nullable=False)
    stage = Column(String(100), default="Queued", nullable=False)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="studio_sessions")
