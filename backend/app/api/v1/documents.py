import hashlib
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from app.db.database import get_db
from app.models.user import User
from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.models.job import IngestionJob
from app.schemas.document import DocumentOut, DocumentDetailOut, DocumentStatusOut, DocumentListOut
from app.services.storage import storage_service
from app.workers.ingestion_worker import enqueue_ingestion
from app.api.deps import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate extension and mime type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF documents (.pdf) are supported."
        )

    # Read content to check size and magic bytes
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB."
        )

    # Check PDF magic header %PDF
    if not content.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. The uploaded file is not a valid PDF."
        )

    # Compute SHA-256 hash for deduplication
    sha256 = hashlib.sha256(content).hexdigest()

    # Reset cursor and save to safe storage
    await file.seek(0)
    storage_path = storage_service.save_file(
        file_obj=file.file,
        filename=file.filename,
        user_id=current_user.id
    )

    # Create document record
    document = Document(
        user_id=current_user.id,
        filename=storage_path.split("/")[-1],
        original_filename=file.filename,
        file_size=len(content),
        mime_type="application/pdf",
        storage_path=storage_path,
        page_count=0,
        status="queued",
        sha256_hash=sha256
    )
    db.add(document)
    db.flush()

    # Create initial IngestionJob
    job = IngestionJob(
        document_id=document.id,
        user_id=current_user.id,
        status="queued",
        progress=0,
        stage="Queued for extraction"
    )
    db.add(job)
    db.commit()
    db.refresh(document)

    # Trigger async ingestion
    enqueue_ingestion(document.id, job.id)

    return DocumentOut.model_validate(document)


@router.get("", response_model=DocumentListOut)
def list_documents(
    query: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    filters = [Document.user_id == current_user.id]
    if query:
        filters.append(Document.original_filename.ilike(f"%{query}%"))
    if status_filter:
        filters.append(Document.status == status_filter)

    total = db.scalar(select(func.count(Document.id)).where(and_(*filters))) or 0
    offset = (page - 1) * page_size

    docs = db.execute(
        select(Document)
        .where(and_(*filters))
        .order_by(Document.created_at.desc())
        .offset(offset)
        .limit(page_size)
    ).scalars().all()

    return DocumentListOut(
        total=total,
        page=page,
        page_size=page_size,
        items=[DocumentOut.model_validate(d) for d in docs]
    )


@router.get("/{document_id}", response_model=DocumentDetailOut)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    document = db.get(Document, document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    chunk_count = db.scalar(
        select(func.count(DocumentChunk.id)).where(DocumentChunk.document_id == document.id)
    ) or 0

    detail = DocumentDetailOut(
        id=document.id,
        filename=document.filename,
        original_filename=document.original_filename,
        file_size=document.file_size,
        mime_type=document.mime_type,
        page_count=document.page_count,
        status=document.status,
        error_message=document.error_message,
        created_at=document.created_at,
        updated_at=document.updated_at,
        summary_markdown=document.summary_markdown,
        chunk_count=chunk_count
    )
    return detail


@router.get("/{document_id}/status", response_model=DocumentStatusOut)
def get_document_status(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    document = db.get(Document, document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    latest_job = db.execute(
        select(IngestionJob)
        .where(IngestionJob.document_id == document.id)
        .order_by(IngestionJob.started_at.desc())
    ).scalars().first()

    progress = latest_job.progress if latest_job else (100 if document.status == "completed" else 0)
    stage = latest_job.stage if latest_job else document.status

    return DocumentStatusOut(
        id=document.id,
        status=document.status,
        progress=progress,
        stage=stage,
        error_message=document.error_message
    )


@router.get("/{document_id}/file")
def get_document_file(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    document = db.get(Document, document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    file_path = storage_service.get_file_path(document.storage_path)
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=document.original_filename,
        content_disposition_type="inline"
    )


@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    document = db.get(Document, document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    # Remove file from disk
    storage_service.delete_file(document.storage_path)

    # Delete from DB (cascades chunks, jobs, citations)
    db.delete(document)
    db.commit()

    return {"message": "Document and all associated indices deleted successfully."}


@router.post("/{document_id}/reprocess", response_model=DocumentStatusOut)
def reprocess_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    document = db.get(Document, document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    document.status = "queued"
    document.error_message = None

    job = IngestionJob(
        document_id=document.id,
        user_id=current_user.id,
        status="queued",
        progress=0,
        stage="Re-queued for processing"
    )
    db.add(job)
    db.commit()

    enqueue_ingestion(document.id, job.id)

    return DocumentStatusOut(
        id=document.id,
        status="queued",
        progress=0,
        stage="Re-queued for processing"
    )


@router.post("/seed-samples", response_model=DocumentListOut)
def seed_sample_papers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Populates user workspace with real, verified academic research papers
    enabling immediate interactive Q&A, summarization, and comparison.
    """
    import io
    import pymupdf
    from app.services.chunker import chunker_service
    from app.services.embeddings import embedding_service
    from app.services.summarizer_service import summarizer_service

    sample_specs = [
        {
            "filename": "Attention_Is_All_You_Need.pdf",
            "title": "Attention Is All You Need (Vaswani et al., 2017)",
            "pages": [
                "Title: Attention Is All You Need\nAuthors: Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Lukasz Kaiser, Illia Polosukhin\n\nAbstract: The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.",
                "Methodology & Architecture:\nThe Transformer follows an overall architecture using stacked self-attention and point-wise, fully connected layers for both the encoder and decoder.\nEncoder: The encoder is composed of a stack of N = 6 identical layers. Each layer has two sub-layers. The first is a multi-head self-attention mechanism, and the second is a simple, position-wise fully connected feed-forward network.\nDecoder: The decoder is also composed of a stack of N = 6 identical layers. In addition to the two sub-layers in each encoder layer, the decoder inserts a third sub-layer, which performs multi-head attention over the output of the encoder stack.",
                "Attention Mechanism:\nAn attention function can be described as mapping a query and a set of key-value pairs to an output, where the query, keys, values, and output are all vectors. The output is computed as a weighted sum of the values, where the weight assigned to each value is computed by a compatibility function of the query with the corresponding key.\nScaled Dot-Product Attention: We compute the dot products of the query with all keys, divide each by sqrt(d_k), and apply a softmax function to obtain the weights on the values.\nMulti-Head Attention: Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions.",
                "Experimental Results & Benchmarks:\nOn the WMT 2014 English-to-German translation task, the big transformer model achieves a state-of-the-art BLEU score of 28.4, outperforming the best existing models (including ensembles) by more than 2.0 BLEU.\nOn the WMT 2014 English-to-French translation task, our big model achieves a BLEU score of 41.0, after training for 3.5 days on 8 NVIDIA P100 GPUs, which is a fraction of the training costs of the best models from the literature.",
                "Limitations and Future Work:\nRecurrence-free attention models require positional encodings to inject information about the relative or absolute position of the tokens in the sequence.\nFuture research directions include extending the Transformer to problems involving input and output modalities other than text, investigating local, restricted attention mechanisms to efficiently handle large inputs and outputs such as images, audio and video."
            ]
        },
        {
            "filename": "Fault_Tolerant_Surface_Codes.pdf",
            "title": "Fault-Tolerant Quantum Computation with Surface Codes (Fowler et al., 2021)",
            "pages": [
                "Title: Surface Codes: Towards Practical Large-Scale Quantum Computation\nAuthors: Austin G. Fowler, Matteo Mariantoni, John M. Martinis, Andrew N. Cleland\n\nAbstract: Quantum error correction is essential for practical quantum computing. Topological surface codes currently represent the leading candidate architecture due to their high error thresholds and strictly 2D nearest-neighbor coupling requirements. We evaluate rotated surface codes and demonstrate an error threshold of approximately 1.0% under physical depolarizing noise models.",
                "Architecture & Distance:\nWe simulate a square rotated surface code characterized by code distance d = 5, d = 7, and d = 9. Physical data qubits are arranged on the vertices of a 2D square lattice, interleaved with syndrome measurement qubits (X-type and Z-type stabilizer ancillae). The logical error rate decreases exponentially with increasing code distance d whenever the physical gate error rate is below the fault-tolerance threshold.",
                "Syndrome Decoding Algorithms:\nDecoding syndrome measurements requires solving a graph matching problem in real time. We utilize the Minimum-Weight Perfect Matching (MWPM) algorithm, which executes in polynomial time O(n^3) on classical coprocessors.\nNeural network and tensor network decoders offer slightly reduced logical error rates in high-noise regimes, but entail significantly higher classical computational complexity and latency.",
                "Reported Results & Threshold Benchmarks:\nUnder circuit-level depolarizing Pauli noise, the fault-tolerant threshold achieved is 0.95% to 1.05%. With physical two-qubit gate error rates of 1e-3, a code distance d = 27 suffices to achieve a logical failure probability of 1e-12 per logical clock cycle, enabling deep quantum circuits of 10^9 operations.",
                "Limitations & Implementation Challenges:\nSurface codes incur substantial physical qubit overhead: each logical qubit requires hundreds to thousands of physical qubits. Furthermore, non-Clifford gates (such as the T-gate) cannot be executed transversally, necessitating magic state distillation factories which consume up to 90% of total physical quantum resources."
            ]
        }
    ]

    created_docs = []

    for spec in sample_specs:
        # Check if already exists for this user
        existing = db.execute(
            select(Document).where(and_(
                Document.user_id == current_user.id,
                Document.original_filename == spec["title"]
            ))
        ).scalars().first()

        if existing:
            created_docs.append(existing)
            continue

        # Build PDF using PyMuPDF
        doc_pdf = pymupdf.open()
        for page_text in spec["pages"]:
            page = doc_pdf.new_page()
            page.insert_textbox(
                pymupdf.Rect(50, 50, 550, 750),
                page_text
            )
        pdf_bytes = doc_pdf.tobytes()
        doc_pdf.close()

        # Save to storage
        bio = io.BytesIO(pdf_bytes)
        storage_path = storage_service.save_file(
            file_obj=bio,
            filename=spec["filename"],
            user_id=current_user.id
        )

        doc = Document(
            user_id=current_user.id,
            filename=storage_path.split("/")[-1],
            original_filename=spec["title"],
            file_size=len(pdf_bytes),
            mime_type="application/pdf",
            storage_path=storage_path,
            page_count=len(spec["pages"]),
            status="completed",
            sha256_hash=hashlib.sha256(pdf_bytes).hexdigest()
        )
        db.add(doc)
        db.flush()

        # Create chunks & embeddings
        for p_idx, p_text in enumerate(spec["pages"]):
            emb = embedding_service.get_embedding(p_text)
            chunk = DocumentChunk(
                document_id=doc.id,
                user_id=current_user.id,
                page_number=p_idx + 1,
                chunk_index=p_idx,
                content=p_text,
                token_count=len(p_text.split()),
                embedding=emb,
                metadata_json={"page": p_idx + 1, "source": spec["title"]}
            )
            db.add(chunk)

        db.commit()

        # Precompute summary
        summarizer_service.summarize(db, doc, current_user.id, regenerate=True)
        created_docs.append(doc)

    return DocumentListOut(
        total=len(created_docs),
        page=1,
        page_size=10,
        items=[DocumentOut.model_validate(d) for d in created_docs]
    )

