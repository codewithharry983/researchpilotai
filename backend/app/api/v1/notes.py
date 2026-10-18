from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.db.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.note import ResearchNote
from app.schemas.note import NoteCreate, NoteUpdate, NoteOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/notes", tags=["Research Notes"])


@router.get("", response_model=List[NoteOut])
def list_notes(
    document_id: Optional[str] = None,
    query: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    filters = [ResearchNote.user_id == current_user.id]
    if document_id:
        filters.append(ResearchNote.document_id == document_id)
    if query:
        filters.append(ResearchNote.title.ilike(f"%{query}%") | ResearchNote.content.ilike(f"%{query}%"))

    notes = db.execute(
        select(ResearchNote, Document.original_filename)
        .outerjoin(Document, ResearchNote.document_id == Document.id)
        .where(and_(*filters))
        .order_by(ResearchNote.updated_at.desc())
    ).all()

    results = []
    for note, doc_title in notes:
        results.append(NoteOut(
            id=note.id,
            user_id=note.user_id,
            document_id=note.document_id,
            document_title=doc_title,
            title=note.title,
            content=note.content,
            tags=note.tags or [],
            created_at=note.created_at,
            updated_at=note.updated_at
        ))

    return results


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(
    note_in: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc_title = None
    if note_in.document_id:
        doc = db.get(Document, note_in.document_id)
        if not doc or doc.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document ID.")
        doc_title = doc.original_filename

    note = ResearchNote(
        user_id=current_user.id,
        document_id=note_in.document_id,
        title=note_in.title,
        content=note_in.content,
        tags=note_in.tags or []
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return NoteOut(
        id=note.id,
        user_id=note.user_id,
        document_id=note.document_id,
        document_title=doc_title,
        title=note.title,
        content=note.content,
        tags=note.tags or [],
        created_at=note.created_at,
        updated_at=note.updated_at
    )


@router.patch("/{note_id}", response_model=NoteOut)
def update_note(
    note_id: str,
    note_update: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = db.get(ResearchNote, note_id)
    if not note or note.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found.")

    if note_update.title is not None:
        note.title = note_update.title
    if note_update.content is not None:
        note.content = note_update.content
    if note_update.tags is not None:
        note.tags = note_update.tags

    db.commit()
    db.refresh(note)

    doc_title = note.document.original_filename if note.document else None
    return NoteOut(
        id=note.id,
        user_id=note.user_id,
        document_id=note.document_id,
        document_title=doc_title,
        title=note.title,
        content=note.content,
        tags=note.tags or [],
        created_at=note.created_at,
        updated_at=note.updated_at
    )


@router.delete("/{note_id}")
def delete_note(
    note_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    note = db.get(ResearchNote, note_id)
    if not note or note.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found.")

    db.delete(note)
    db.commit()
    return {"message": "Note deleted successfully."}


@router.get("/export/markdown")
def export_notes_markdown(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notes = db.execute(
        select(ResearchNote, Document.original_filename)
        .outerjoin(Document, ResearchNote.document_id == Document.id)
        .where(ResearchNote.user_id == current_user.id)
        .order_by(ResearchNote.created_at.desc())
    ).all()

    md_lines = [
        f"# ResearchPilot AI — Exported Notes",
        f"*User: {current_user.email}*",
        f"\n---\n"
    ]

    for note, doc_title in notes:
        md_lines.append(f"## {note.title}")
        if doc_title:
            md_lines.append(f"**Linked Paper:** {doc_title}")
        if note.tags:
            md_lines.append(f"**Tags:** {', '.join(note.tags)}")
        md_lines.append(f"\n{note.content}\n\n---\n")

    full_text = "\n".join(md_lines)
    return Response(
        content=full_text,
        media_type="text/markdown",
        headers={"Content-Disposition": "attachment; filename=research_notes.md"}
    )
