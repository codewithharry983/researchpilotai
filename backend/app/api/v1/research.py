from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.db.database import get_db
from app.models.user import User
from app.models.document import Document
from app.schemas.research import (
    SummarizeRequest,
    SummarizeResponse,
    CompareRequest,
    CompareResponse,
    SemanticSearchRequest,
    SearchResultOut
)
from app.services.summarizer_service import summarizer_service
from app.services.comparison_service import comparison_service
from app.services.retrieval import retriever_service
from app.api.deps import get_current_user
from app.core.rate_limiter import rate_limit_ai

router = APIRouter(prefix="/research", tags=["Research Tools"])


@router.post("/summarize", response_model=SummarizeResponse)
def summarize_paper(
    req: SummarizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(rate_limit_ai)
):
    doc = db.get(Document, req.document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    if doc.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document is in status '{doc.status}'. It must be fully completed before summarization."
        )

    return summarizer_service.summarize(db, doc, current_user.id, regenerate=req.regenerate)


@router.post("/compare", response_model=CompareResponse)
def compare_papers(
    req: CompareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(rate_limit_ai)
):
    docs = db.execute(
        select(Document)
        .where(and_(
            Document.id.in_(req.document_ids),
            Document.user_id == current_user.id
        ))
    ).scalars().all()

    if len(docs) != len(req.document_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more selected documents do not belong to you or do not exist."
        )

    for d in docs:
        if d.status != "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Paper '{d.original_filename}' is not yet completed. Only processed papers can be compared."
            )

    return comparison_service.compare_papers(db, docs, current_user.id)


@router.post("/search", response_model=List[SearchResultOut])
def semantic_search(
    req: SemanticSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(rate_limit_ai)
):
    scored_chunks = retriever_service.retrieve(
        db=db,
        query=req.query,
        user_id=current_user.id,
        document_ids=req.document_ids,
        top_k=req.top_k
    )

    results = []
    for sc in scored_chunks:
        results.append(SearchResultOut(
            chunk_id=sc.chunk_id,
            document_id=sc.document_id,
            document_title=sc.document_title,
            page_number=sc.page_number,
            content=sc.content,
            similarity_score=float(round(sc.rrf_score, 4)),
            retrieval_type=sc.retrieval_type
        ))

    return results
