from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    page_count: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DocumentDetailOut(DocumentOut):
    summary_markdown: Optional[str] = None
    chunk_count: int = 0


class DocumentStatusOut(BaseModel):
    id: str
    status: str
    progress: int = 0
    stage: str
    error_message: Optional[str] = None


class DocumentListOut(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[DocumentOut]
