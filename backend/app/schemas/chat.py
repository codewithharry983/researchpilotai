from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class CitationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    chunk_id: Optional[str] = None
    document_id: str
    document_title: str
    page_number: int
    excerpt: str
    relevance_score: float
    is_exact_quote: bool


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    role: str
    content: str
    latency_ms: Optional[int] = None
    token_count: Optional[int] = None
    citations: List[CitationOut] = []
    created_at: datetime


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)
    selected_document_ids: Optional[List[str]] = None


class ConversationCreate(BaseModel):
    title: Optional[str] = Field("New Research Chat", max_length=255)
    selected_document_ids: Optional[List[str]] = None


class ConversationUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    selected_document_ids: Optional[List[str]] = None


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    selected_document_ids: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class ConversationDetailOut(ConversationOut):
    messages: List[MessageOut] = []
