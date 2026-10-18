import logging
import traceback
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.models.job import IngestionJob
from app.services.storage import storage_service
from app.services.pdf_extractor import pdf_extractor
from app.services.chunker import chunker_service
from app.services.embeddings import embedding_service

logger = logging.getLogger("researchpilot.ingestion")
executor = ThreadPoolExecutor(max_workers=3)


def process_document_pipeline(document_id: str, job_id: str) -> None:
    """
    Asynchronous end-to-end ingestion pipeline:
    Extraction -> Chunking -> Embedding generation -> Persistence -> Status update
    """
    db: Session = SessionLocal()
    try:
        # Load document and job
        document = db.get(Document, document_id)
        job = db.get(IngestionJob, job_id)
        if not document or not job:
            logger.error(f"Ingestion worker: Document {document_id} or Job {job_id} not found.")
            return

        # Stage 1: Update to Processing & Extracting
        document.status = "processing"
        job.status = "processing"
        job.progress = 10
        job.stage = "Extracting text from PDF pages"
        db.commit()

        file_path = storage_service.get_file_path(document.storage_path)
        extraction_res = pdf_extractor.extract(file_path)

        document.page_count = extraction_res.total_pages
        if extraction_res.requires_ocr:
            document.error_message = "Notice: This document appears to be scanned or image-based. OCR extraction is recommended for complete coverage."

        job.progress = 35
        job.stage = f"Extracted {extraction_res.total_pages} pages. Splitting into semantic chunks."
        db.commit()

        # Stage 2: Chunking
        chunks = chunker_service.chunk_document(extraction_res.pages)
        if not chunks:
            # Handle empty document
            if extraction_res.requires_ocr:
                document.status = "failed"
                document.error_message = "Scanned PDF detected with no selectable text. Optical Character Recognition (OCR) is required."
                job.status = "failed"
                job.stage = "Failed: Scanned PDF without text"
                job.error_message = document.error_message
                db.commit()
                return
            else:
                document.status = "failed"
                document.error_message = "Document contains no readable text content."
                job.status = "failed"
                job.stage = "Failed: Empty document"
                job.error_message = document.error_message
                db.commit()
                return

        job.progress = 55
        job.stage = f"Generated {len(chunks)} chunks. Generating embeddings."
        db.commit()

        # Stage 3: Embedding generation
        chunk_texts = [c.content for c in chunks]
        embeddings = embedding_service.get_embeddings(chunk_texts)

        job.progress = 85
        job.stage = f"Persisting {len(chunks)} chunks and vector indices to database."
        db.commit()

        # Clean existing chunks if reprocessing
        db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete()

        # Stage 4: Persist chunks
        for idx, c in enumerate(chunks):
            emb = embeddings[idx] if idx < len(embeddings) else None
            db_chunk = DocumentChunk(
                document_id=document.id,
                user_id=document.user_id,
                page_number=c.page_number,
                chunk_index=c.chunk_index,
                content=c.content,
                token_count=c.token_count,
                embedding=emb,
                metadata_json=c.metadata
            )
            db.add(db_chunk)

        # Stage 5: Mark Completed
        document.status = "completed"
        job.status = "completed"
        job.progress = 100
        job.stage = f"Processing complete. {len(chunks)} chunks indexed."
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        logger.info(f"Document {document_id} successfully ingested with {len(chunks)} chunks.")

    except Exception as e:
        db.rollback()
        err_msg = str(e)
        logger.error(f"Failed ingestion for document {document_id}: {err_msg}\n{traceback.format_exc()}")
        try:
            doc = db.get(Document, document_id)
            jb = db.get(IngestionJob, job_id)
            if doc:
                doc.status = "failed"
                doc.error_message = f"Ingestion error: {err_msg}"
            if jb:
                jb.status = "failed"
                jb.error_message = err_msg
                jb.stage = "Pipeline failed"
            db.commit()
        except Exception:
            pass
    finally:
        db.close()


def enqueue_ingestion(document_id: str, job_id: str):
    """Enqueue document ingestion to the background thread pool."""
    executor.submit(process_document_pipeline, document_id, job_id)
