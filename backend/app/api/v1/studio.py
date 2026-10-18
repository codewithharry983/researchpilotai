from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, and_
from app.db.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.note import ResearchNote
from app.models.studio_session import StudioSession
from app.schemas.studio import (
    StudioCreateRequest,
    StudioSessionOut,
    StudioSessionListOut,
    YouTubeInspectRequest,
    YouTubeInspectResponse,
    SaveNotesRequest
)
from app.schemas.note import NoteOut
from app.services.storage import storage_service
from app.services.youtube_service import youtube_service
from app.workers.studio_worker import enqueue_studio_job
from app.api.deps import get_current_user
from app.core.rate_limiter import rate_limit_ai

router = APIRouter(prefix="/studio", tags=["ResearchPilot Studio"])


@router.post("/youtube/inspect", response_model=YouTubeInspectResponse)
def inspect_youtube_video(
    req: YouTubeInspectRequest,
    current_user: User = Depends(get_current_user),
    _: None = Depends(rate_limit_ai)
):
    info = youtube_service.inspect_video(req.url, user_transcript=req.user_provided_transcript)
    words = len(info.transcript_text.split()) if info.transcript_text else 0
    snippet = info.transcript_text[:300] + ("..." if len(info.transcript_text) > 300 else "") if info.transcript_text else None

    return YouTubeInspectResponse(
        video_id=info.video_id,
        url=info.url,
        title=info.title,
        channel_name=info.channel_name,
        thumbnail_url=info.thumbnail_url,
        duration_seconds=info.duration_seconds,
        has_captions=info.has_captions,
        transcript_snippet=snippet,
        transcript_word_count=words,
        error_message=info.error_message
    )


@router.post("/sessions", response_model=StudioSessionOut, status_code=status.HTTP_201_CREATED)
def create_studio_session(
    req: StudioCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(rate_limit_ai)
):
    source_metadata = {}

    if req.source_type == "documents":
        if not req.document_ids or len(req.document_ids) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one document must be selected to generate a podcast."
            )

        # Validate ownership of all selected documents
        docs = db.execute(
            select(Document).where(
                and_(Document.id.in_(req.document_ids), Document.user_id == current_user.id)
            )
        ).scalars().all()

        if len(docs) != len(req.document_ids):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="One or more selected documents do not exist or belong to another user."
            )

        source_metadata = {
            "document_ids": req.document_ids,
            "document_titles": [d.original_filename for d in docs]
        }
        default_title = docs[0].original_filename if len(docs) == 1 else f"Synthesis of {len(docs)} Research Papers"

    elif req.source_type == "youtube":
        if not req.youtube_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A valid YouTube URL is required."
            )
        video_id = youtube_service.extract_video_id(req.youtube_url)
        if not video_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not parse YouTube video ID from provided URL."
            )
        source_metadata = {
            "youtube_url": req.youtube_url,
            "video_id": video_id,
            "user_provided_transcript": req.user_provided_transcript
        }
        default_title = f"YouTube Educational Podcast ({video_id})"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported source type: {req.source_type}"
        )

    title = req.session_title.strip() if req.session_title and req.session_title.strip() else default_title

    session = StudioSession(
        user_id=current_user.id,
        session_title=title,
        source_type=req.source_type,
        source_metadata=source_metadata,
        podcast_style=req.podcast_style,
        target_duration=req.target_duration,
        summary_length=req.summary_length,
        generate_notes=req.generate_notes,
        status="queued",
        progress=0,
        stage="Queued for podcast generation"
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Launch background job
    enqueue_studio_job(session.id)

    return StudioSessionOut.model_validate(session)


@router.get("/sessions", response_model=StudioSessionListOut)
def list_studio_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    offset = (page - 1) * page_size
    stmt = (
        select(StudioSession)
        .where(StudioSession.user_id == current_user.id)
        .order_by(desc(StudioSession.created_at))
        .offset(offset)
        .limit(page_size)
    )
    items = db.execute(stmt).scalars().all()

    total = db.query(StudioSession).filter(StudioSession.user_id == current_user.id).count()

    return StudioSessionListOut(
        total=total,
        items=[StudioSessionOut.model_validate(s) for s in items]
    )


@router.get("/sessions/{session_id}", response_model=StudioSessionOut)
def get_studio_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.get(StudioSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Studio session not found.")
    return StudioSessionOut.model_validate(session)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_200_OK)
def delete_studio_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.get(StudioSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Studio session not found.")

    # Remove audio asset from storage if present
    if session.audio_storage_path:
        storage_service.delete_file(session.audio_storage_path)

    db.delete(session)
    db.commit()
    return {"message": "Studio session and generated assets deleted successfully."}


@router.get("/sessions/{session_id}/audio")
def get_studio_audio(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.get(StudioSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Studio session not found.")

    if not session.audio_storage_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio has not been generated for this session yet.")

    file_path = storage_service.get_file_path(session.audio_storage_path)
    clean_filename = f"{session.session_title.replace(' ', '_')}.mp3"
    return FileResponse(
        path=str(file_path),
        media_type="audio/mpeg",
        filename=clean_filename,
        content_disposition_type="inline"
    )


@router.post("/sessions/{session_id}/save-notes", response_model=NoteOut)
def save_studio_notes_to_workspace(
    session_id: str,
    req: SaveNotesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.get(StudioSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Studio session not found.")

    if not session.notes_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No notes data exists for this session.")

    # Format notes markdown
    notes = session.notes_data
    md_lines = [f"# Smart Notes: {session.session_title}\n"]
    
    if notes.get("key_concepts"):
        md_lines.append("## Key Concepts")
        for kc in notes["key_concepts"]:
            md_lines.append(f"- **{kc.get('term')}**: {kc.get('explanation')}")
        md_lines.append("")

    if notes.get("definitions"):
        md_lines.append("## Definitions")
        for d in notes["definitions"]:
            md_lines.append(f"- **{d.get('term')}**: {d.get('definition')}")
        md_lines.append("")

    if notes.get("main_findings"):
        md_lines.append("## Main Findings")
        for f in notes["main_findings"]:
            md_lines.append(f"- {f}")
        md_lines.append("")

    if notes.get("revision_points"):
        md_lines.append("## High-Yield Revision Points")
        for rp in notes["revision_points"]:
            md_lines.append(f"- {rp}")
        md_lines.append("")

    if notes.get("self_test_questions"):
        md_lines.append("## Self-Testing Questions")
        for idx, q in enumerate(notes["self_test_questions"], 1):
            md_lines.append(f"**Q{idx}: {q.get('question')}**\n> Answer: {q.get('answer')}\n")

    if notes.get("final_takeaways"):
        md_lines.append("## Final Takeaways")
        for t in notes["final_takeaways"]:
            md_lines.append(f"- {t}")

    note_title = req.title or f"Podcast Notes: {session.session_title}"
    note_content = "\n".join(md_lines)

    first_doc_id = None
    if session.source_type == "documents":
        doc_ids = session.source_metadata.get("document_ids", [])
        if doc_ids:
            first_doc_id = doc_ids[0]

    research_note = ResearchNote(
        user_id=current_user.id,
        document_id=first_doc_id,
        title=note_title,
        content=note_content,
        tags=req.tags or ["studio", "podcast", "ai-notes"]
    )
    db.add(research_note)
    db.commit()
    db.refresh(research_note)

    return NoteOut.model_validate(research_note)


@router.post("/sessions/{session_id}/retry", response_model=StudioSessionOut)
def retry_studio_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.get(StudioSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Studio session not found.")

    session.status = "queued"
    session.progress = 0
    session.stage = "Re-queued for podcast synthesis"
    session.error_message = None
    db.commit()

    enqueue_studio_job(session.id)
    return StudioSessionOut.model_validate(session)
