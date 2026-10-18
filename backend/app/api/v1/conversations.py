from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from app.db.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.chat import (
    ConversationCreate,
    ConversationUpdate,
    ConversationOut,
    ConversationDetailOut,
    MessageCreate,
    MessageOut,
    CitationOut
)
from app.services.rag_service import rag_service
from app.api.deps import get_current_user
from app.core.rate_limiter import rate_limit_ai

router = APIRouter(prefix="/conversations", tags=["Research Chat"])


@router.get("", response_model=List[ConversationOut])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    convs = db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    ).scalars().all()

    results = []
    for c in convs:
        msg_count = db.scalar(
            select(func.count(Message.id)).where(Message.conversation_id == c.id)
        ) or 0
        out = ConversationOut(
            id=c.id,
            title=c.title,
            selected_document_ids=c.selected_document_ids,
            created_at=c.created_at,
            updated_at=c.updated_at,
            message_count=msg_count
        )
        results.append(out)

    return results


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_conversation(
    conv_in: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate selected documents if provided
    if conv_in.selected_document_ids:
        docs = db.execute(
            select(Document.id)
            .where(and_(
                Document.id.in_(conv_in.selected_document_ids),
                Document.user_id == current_user.id
            ))
        ).scalars().all()
        if len(docs) != len(conv_in.selected_document_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more selected documents do not belong to you or do not exist."
            )

    conv = Conversation(
        user_id=current_user.id,
        title=conv_in.title or "New Research Chat",
        selected_document_ids=conv_in.selected_document_ids
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    return ConversationOut(
        id=conv.id,
        title=conv.title,
        selected_document_ids=conv.selected_document_ids,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=0
    )


@router.get("/{conversation_id}", response_model=ConversationDetailOut)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    messages = db.execute(
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
    ).scalars().all()

    msg_outs = []
    for m in messages:
        cits = [CitationOut.model_validate(c) for c in m.citations]
        msg_outs.append(MessageOut(
            id=m.id,
            conversation_id=m.conversation_id,
            role=m.role,
            content=m.content,
            latency_ms=m.latency_ms,
            token_count=m.token_count,
            citations=cits,
            created_at=m.created_at
        ))

    return ConversationDetailOut(
        id=conv.id,
        title=conv.title,
        selected_document_ids=conv.selected_document_ids,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=len(messages),
        messages=msg_outs
    )


@router.patch("/{conversation_id}", response_model=ConversationOut)
def update_conversation(
    conversation_id: str,
    conv_update: ConversationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    if conv_update.title is not None:
        conv.title = conv_update.title
    if conv_update.selected_document_ids is not None:
        # Validate ownership
        if conv_update.selected_document_ids:
            docs = db.execute(
                select(Document.id)
                .where(and_(
                    Document.id.in_(conv_update.selected_document_ids),
                    Document.user_id == current_user.id
                ))
            ).scalars().all()
            if len(docs) != len(conv_update.selected_document_ids):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="One or more selected documents do not belong to you or do not exist."
                )
        conv.selected_document_ids = conv_update.selected_document_ids

    db.commit()
    db.refresh(conv)

    msg_count = db.scalar(
        select(func.count(Message.id)).where(Message.conversation_id == conv.id)
    ) or 0

    return ConversationOut(
        id=conv.id,
        title=conv.title,
        selected_document_ids=conv.selected_document_ids,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=msg_count
    )


@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted successfully."}


@router.post("/{conversation_id}/messages", response_model=MessageOut)
def send_message(
    conversation_id: str,
    msg_in: MessageCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(rate_limit_ai)
):
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    # 1. Persist User Message
    user_msg = Message(
        conversation_id=conv.id,
        user_id=current_user.id,
        role="user",
        content=msg_in.content
    )
    db.add(user_msg)
    db.commit()

    # If first message and default title, dynamically auto-title conversation
    if conv.title == "New Research Chat":
        words = msg_in.content.strip().split()
        summary_title = " ".join(words[:6])
        if len(words) > 6:
            summary_title += "..."
        conv.title = summary_title
        db.commit()

    # Determine document scope
    doc_ids = msg_in.selected_document_ids if msg_in.selected_document_ids is not None else conv.selected_document_ids

    # 2. Run Grounded RAG
    assistant_msg, citations = rag_service.answer_question(
        db=db,
        user_id=current_user.id,
        conversation_id=conv.id,
        question=msg_in.content,
        document_ids=doc_ids
    )

    cits_out = [CitationOut.model_validate(c) for c in citations]
    return MessageOut(
        id=assistant_msg.id,
        conversation_id=assistant_msg.conversation_id,
        role=assistant_msg.role,
        content=assistant_msg.content,
        latency_ms=assistant_msg.latency_ms,
        token_count=assistant_msg.token_count,
        citations=cits_out,
        created_at=assistant_msg.created_at
    )
