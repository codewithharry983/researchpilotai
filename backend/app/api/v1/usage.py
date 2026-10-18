from typing import Dict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from app.db.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.note import ResearchNote
from app.models.usage import UsageRecord
from app.schemas.usage import UsageSummaryOut, UsageRecordOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/usage", tags=["Usage & Analytics"])


@router.get("", response_model=UsageSummaryOut)
def get_usage_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    uid = current_user.id

    # Document stats
    total_docs = db.scalar(select(func.count(Document.id)).where(Document.user_id == uid)) or 0
    completed_docs = db.scalar(select(func.count(Document.id)).where(and_(Document.user_id == uid, Document.status == "completed"))) or 0
    failed_docs = db.scalar(select(func.count(Document.id)).where(and_(Document.user_id == uid, Document.status == "failed"))) or 0

    # Conversation and message stats
    total_convs = db.scalar(select(func.count(Conversation.id)).where(Conversation.user_id == uid)) or 0
    total_msgs = db.scalar(select(func.count(Message.id)).where(Message.user_id == uid)) or 0
    total_notes = db.scalar(select(func.count(ResearchNote.id)).where(ResearchNote.user_id == uid)) or 0

    # Token and latency aggregates
    usage_aggs = db.execute(
        select(
            func.sum(UsageRecord.total_tokens),
            func.sum(UsageRecord.cost_estimate),
            func.avg(UsageRecord.latency_ms),
            func.count(UsageRecord.id)
        ).where(UsageRecord.user_id == uid)
    ).first()

    total_tokens = int(usage_aggs[0] or 0)
    estimated_cost = float(round(usage_aggs[1] or 0.0, 4))
    avg_latency = float(round(usage_aggs[2] or 0.0, 1))
    total_queries = int(usage_aggs[3] or 0)

    # Token usage grouped by model
    model_rows = db.execute(
        select(UsageRecord.model, func.sum(UsageRecord.total_tokens))
        .where(UsageRecord.user_id == uid)
        .group_by(UsageRecord.model)
    ).all()
    token_usage_by_model: Dict[str, int] = {m: int(cnt) for m, cnt in model_rows}

    # Recent activity
    recent_records = db.execute(
        select(UsageRecord)
        .where(UsageRecord.user_id == uid)
        .order_by(UsageRecord.timestamp.desc())
        .limit(10)
    ).scalars().all()

    return UsageSummaryOut(
        total_documents=total_docs,
        completed_documents=completed_docs,
        failed_documents=failed_docs,
        total_conversations=total_convs,
        total_messages=total_msgs,
        total_notes=total_notes,
        total_tokens=total_tokens,
        total_queries=total_queries,
        estimated_cost_usd=estimated_cost,
        avg_latency_ms=avg_latency,
        token_usage_by_model=token_usage_by_model,
        recent_activity=[UsageRecordOut.model_validate(r) for r in recent_records]
    )
