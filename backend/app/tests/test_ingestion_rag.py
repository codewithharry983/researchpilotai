import os
import pymupdf
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.services.pdf_extractor import pdf_extractor
from app.services.chunker import chunker_service
from app.services.embeddings import embedding_service
from app.services.retrieval import retriever_service
from app.services.rag_service import rag_service
from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.models.conversation import Conversation


@pytest.fixture
def sample_pdf_path(tmp_path: Path) -> Path:
    pdf_file = tmp_path / "quantum_computing.pdf"
    doc = pymupdf.open()
    p1 = doc.new_page()
    p1.insert_textbox(
        pymupdf.Rect(50, 50, 550, 750),
        "Title: Fault-Tolerant Quantum Computation with Surface Codes.\n\n"
        "Abstract: Surface codes provide a promising architecture for fault-tolerant quantum computing. "
        "The error threshold is estimated at approximately 1% under depolarizing noise models."
    )
    p2 = doc.new_page()
    p2.insert_textbox(
        pymupdf.Rect(50, 50, 550, 750),
        "Methodology: We simulate a square rotated surface code with code distance d = 5 and d = 7.\n"
        "The minimum-weight perfect matching (MWPM) decoder was utilized to identify syndrome graphs."
    )
    doc.save(str(pdf_file))
    doc.close()
    return pdf_file


def test_pdf_extraction_page_by_page(sample_pdf_path: Path):
    result = pdf_extractor.extract(sample_pdf_path)
    assert result.total_pages == 2
    assert not result.requires_ocr
    assert "Fault-Tolerant Quantum Computation" in result.pages[0].text
    assert "MWPM" in result.pages[1].text


def test_chunking_preserves_page_numbers_and_metadata(sample_pdf_path: Path):
    ext_result = pdf_extractor.extract(sample_pdf_path)
    chunks = chunker_service.chunk_document(ext_result.pages)
    assert len(chunks) >= 2
    assert chunks[0].page_number == 1
    assert any(c.page_number == 2 for c in chunks)
    assert chunks[0].token_count > 0


def test_hybrid_retrieval_and_rrf(db_session: Session, test_user):
    # Setup document and chunks in DB
    doc = Document(
        user_id=test_user.id,
        filename="qc.pdf",
        original_filename="quantum_computing.pdf",
        file_size=1024,
        storage_path="qc.pdf",
        status="completed"
    )
    db_session.add(doc)
    db_session.flush()

    c1_text = "Surface codes provide an error threshold of approximately 1% under depolarizing noise."
    c2_text = "We use the minimum-weight perfect matching decoder to track error syndromes."

    emb1 = embedding_service.get_embedding(c1_text)
    emb2 = embedding_service.get_embedding(c2_text)

    chunk1 = DocumentChunk(
        document_id=doc.id,
        user_id=test_user.id,
        page_number=1,
        chunk_index=0,
        content=c1_text,
        embedding=emb1
    )
    chunk2 = DocumentChunk(
        document_id=doc.id,
        user_id=test_user.id,
        page_number=2,
        chunk_index=1,
        content=c2_text,
        embedding=emb2
    )
    db_session.add_all([chunk1, chunk2])
    db_session.commit()

    # Retrieve with query related to chunk 1
    results = retriever_service.retrieve(
        db=db_session,
        query="What is the error threshold of surface codes?",
        user_id=test_user.id,
        top_k=2
    )
    assert len(results) > 0
    assert results[0].chunk_id == chunk1.id
    assert "1%" in results[0].content


def test_grounded_rag_with_citations(db_session: Session, test_user):
    # Create conversation
    conv = Conversation(user_id=test_user.id, title="Quantum Discussion")
    db_session.add(conv)
    db_session.commit()

    # Create chunk
    doc = Document(
        user_id=test_user.id,
        filename="qc.pdf",
        original_filename="Quantum Paper",
        file_size=2048,
        storage_path="qc.pdf",
        status="completed"
    )
    db_session.add(doc)
    db_session.flush()

    text = "The experimental threshold achieved was 0.95% using rotated surface codes with distance 7."
    emb = embedding_service.get_embedding(text)
    chunk = DocumentChunk(
        document_id=doc.id,
        user_id=test_user.id,
        page_number=3,
        chunk_index=0,
        content=text,
        embedding=emb
    )
    db_session.add(chunk)
    db_session.commit()

    # Ask answerable question
    msg, citations = rag_service.answer_question(
        db=db_session,
        user_id=test_user.id,
        conversation_id=conv.id,
        question="What experimental threshold was achieved?",
        top_k=3
    )

    assert msg.role == "assistant"
    assert "insufficient evidence" not in msg.content.lower()
    assert len(citations) > 0
    assert citations[0].page_number == 3
    assert citations[0].document_title == "Quantum Paper"


def test_rag_handles_unanswerable_question_without_hallucination(db_session: Session, test_user):
    conv = Conversation(user_id=test_user.id, title="Unanswerable Chat")
    db_session.add(conv)
    db_session.commit()

    # Empty doc chunks or completely unrelated
    doc = Document(
        user_id=test_user.id,
        filename="med.pdf",
        original_filename="Cardiology Paper",
        file_size=2048,
        storage_path="med.pdf",
        status="completed"
    )
    db_session.add(doc)
    db_session.flush()

    text = "The cardiovascular study enrolled 500 patients over a 3-year randomized clinical trial."
    emb = embedding_service.get_embedding(text)
    chunk = DocumentChunk(
        document_id=doc.id,
        user_id=test_user.id,
        page_number=1,
        chunk_index=0,
        content=text,
        embedding=emb
    )
    db_session.add(chunk)
    db_session.commit()

    # Question completely unrelated to medicine/cardiology
    msg, citations = rag_service.answer_question(
        db=db_session,
        user_id=test_user.id,
        conversation_id=conv.id,
        question="What is the boiling point of liquid nitrogen in rocket fuel combustion?",
        top_k=3
    )

    assert msg.role == "assistant"
    assert "insufficient evidence" in msg.content.lower()
    # When answer is uncertain, misleading citations should not be attached
    assert len(citations) == 0
