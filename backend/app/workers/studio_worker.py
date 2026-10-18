import logging
import traceback
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.studio_session import StudioSession
from app.services.studio_service import studio_service
from app.services.youtube_service import youtube_service

logger = logging.getLogger("researchpilot.studio")
executor = ThreadPoolExecutor(max_workers=2)


def process_studio_session_pipeline(session_id: str, db_override: Session = None) -> None:
    db: Session = db_override if db_override is not None else SessionLocal()
    try:
        session = db.get(StudioSession, session_id)
        if not session:
            logger.error(f"Studio worker: Session {session_id} not found.")
            return

        # Stage 1: Content Extraction (15%)
        session.status = "extracting"
        session.progress = 15
        session.stage = "Extracting source content and page/timestamp metadata"
        db.commit()

        source_text = ""
        source_title = session.session_title

        if session.source_type == "documents":
            doc_ids = session.source_metadata.get("document_ids", [])
            source_text, meta = studio_service.extract_document_source_text(db, doc_ids, session.user_id)
            if not source_text.strip():
                raise ValueError("No text could be extracted from the selected documents. Please verify documents are processed.")
            # Update source metadata with resolved document titles
            session.source_metadata["documents"] = meta
            if len(meta) == 1:
                source_title = meta[0]["title"]
            else:
                source_title = f"{len(meta)} Research Documents ({', '.join(d['title'][:25] + '...' for d in meta[:2])})"

        elif session.source_type == "youtube":
            video_url = session.source_metadata.get("youtube_url", "")
            user_transcript = session.source_metadata.get("user_provided_transcript")
            video_info = youtube_service.inspect_video(video_url, user_transcript=user_transcript)
            
            if video_info.error_message and not video_info.transcript_text:
                raise ValueError(video_info.error_message)

            source_text = video_info.transcript_text
            source_title = video_info.title or session.session_title
            session.source_metadata.update({
                "video_id": video_info.video_id,
                "video_title": video_info.title,
                "channel_name": video_info.channel_name,
                "thumbnail_url": video_info.thumbnail_url,
                "duration_seconds": video_info.duration_seconds
            })

        if not source_text or len(source_text.strip()) < 20:
            raise ValueError("Insufficient textual content found to generate a research podcast and summary.")

        # Stage 2: Evidence Summarization (35%)
        session.status = "summarizing"
        session.progress = 35
        session.stage = "Analyzing source evidence and generating structured summary"
        db.commit()

        summary_data = studio_service.generate_structured_summary(
            source_text=source_text,
            source_title=source_title,
            summary_length=session.summary_length
        )
        session.summary_data = summary_data
        db.commit()

        # Stage 3: Podcast Scripting (55%)
        session.status = "scripting"
        session.progress = 55
        session.stage = "Drafting and validating conversational podcast script"
        db.commit()

        script_segments = studio_service.generate_podcast_script(
            source_text=source_text,
            source_title=source_title,
            style=session.podcast_style,
            target_duration=session.target_duration
        )
        session.podcast_script = script_segments
        db.commit()

        # Stage 4: Smart Notes (70% or skipped)
        if session.generate_notes:
            session.progress = 70
            session.stage = "Extracting high-yield study notes, definitions, and self-testing questions"
            db.commit()

            notes_data = studio_service.generate_smart_notes(
                source_text=source_text,
                source_title=source_title
            )
            session.notes_data = notes_data
            db.commit()

        # Stage 5: Audio Generation via TTS (85%)
        session.status = "generating_audio"
        session.progress = 85
        session.stage = "Synthesizing multi-speaker natural audio and combining segments"
        db.commit()

        audio_path, duration_sec = studio_service.synthesize_audio(
            script_segments=script_segments,
            style=session.podcast_style,
            user_id=session.user_id,
            session_id=session.id
        )

        session.audio_storage_path = audio_path
        session.audio_duration_seconds = duration_sec

        # Stage 6: Completed (100%)
        session.status = "completed"
        session.progress = 100
        session.stage = "Podcast, summary, and smart notes are ready"
        session.error_message = None
        db.commit()
        logger.info(f"Studio pipeline completed successfully for session {session_id}")

    except Exception as e:
        logger.error(f"Studio worker failure for session {session_id}: {e}\n{traceback.format_exc()}")
        try:
            session = db.get(StudioSession, session_id)
            if session:
                session.status = "failed"
                session.stage = "Failed to produce podcast session"
                session.error_message = str(e)
                db.commit()
        except Exception:
            pass
    finally:
        if db_override is None:
            db.close()


def enqueue_studio_job(session_id: str) -> None:
    executor.submit(process_studio_session_pipeline, session_id)
