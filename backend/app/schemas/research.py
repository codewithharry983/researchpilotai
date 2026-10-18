from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class SummarizeRequest(BaseModel):
    document_id: str
    regenerate: bool = False


class SummarySection(BaseModel):
    title: str
    content: str
    page_references: List[int] = []
    is_reported: bool = True


class SummarizeResponse(BaseModel):
    document_id: str
    document_title: str
    sections: Dict[str, SummarySection]
    markdown_content: str
    generated_at: str


class CompareRequest(BaseModel):
    document_ids: List[str] = Field(..., min_length=2, max_length=5)


class ComparisonMatrixRow(BaseModel):
    criterion: str
    documents: Dict[str, str]  # doc_id -> value or summary
    source_pages: Dict[str, List[int]] = {}


class CompareResponse(BaseModel):
    document_ids: List[str]
    document_titles: Dict[str, str]  # doc_id -> original_filename
    matrix: List[ComparisonMatrixRow]
    synthesis_markdown: str


class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    document_ids: Optional[List[str]] = None
    top_k: int = 5


class SearchResultOut(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    page_number: int
    content: str
    similarity_score: float
    retrieval_type: str  # "vector", "keyword", or "hybrid"
