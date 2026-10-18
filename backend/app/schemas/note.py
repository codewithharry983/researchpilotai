from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    document_id: Optional[str] = None
    tags: Optional[List[str]] = []


class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    tags: Optional[List[str]] = None


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    document_id: Optional[str] = None
    document_title: Optional[str] = None
    title: str
    content: str
    tags: List[str] = []
    created_at: datetime
    updated_at: datetime
