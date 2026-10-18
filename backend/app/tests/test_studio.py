import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.document import Document
from app.models.chunk import DocumentChunk
from app.models.studio_session import StudioSession
from app.services.youtube_service import youtube_service
from app.services.studio_service import studio_service
from app.services.tts_service import tts_service
from app.services.storage import storage_service
from app.workers.studio_worker import process_studio_session_pipeline


@pytest.fixture(autouse=True)
def mock_tts_provider(monkeypatch):
    monkeypatch.setattr(
        tts_service,
        "synthesize_podcast",
        lambda script_segments, style: b"\xff\xfb\x90\x00" * 500
    )


def test_youtube_url_parsing():
    valid_urls = [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ]
    for url, expected_id in valid_urls:
        assert youtube_service.extract_video_id(url) == expected_id

    invalid_urls = ["https://example.com/not-youtube", "random string", ""]
    for url in invalid_urls:
        assert youtube_service.extract_video_id(url) is None


def test_youtube_inspect_endpoint(client: TestClient, test_user_token: str):
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Test valid URL with fallback transcript
    resp = client.post(
        "/api/v1/studio/youtube/inspect",
        headers=headers,
        json={
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "user_provided_transcript": "This is an introductory lecture explaining deep neural networks and self-attention."
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["video_id"] == "dQw4w9WgXcQ"
    assert data["has_captions"] is True
    assert data["transcript_word_count"] > 5


def test_studio_session_creation(client: TestClient, test_user: User, test_user_token: str, db_session: Session):
    headers = {"Authorization": f"Bearer {test_user_token}"}

    # Create dummy document for user
    doc = Document(
        user_id=test_user.id,
        filename="quantum_paper.pdf",
        original_filename="Quantum Error Correction Basics.pdf",
        file_size=1024,
        storage_path=f"{test_user.id}/quantum_paper.pdf",
        page_count=3,
        status="completed"
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    # Create studio session
    resp = client.post(
        "/api/v1/studio/sessions",
        headers=headers,
        json={
            "session_title": "Quantum Error Podcast",
            "source_type": "documents",
            "document_ids": [doc.id],
            "podcast_style": "two_host",
            "target_duration": "3-5",
            "summary_length": "detailed",
            "generate_notes": True
        }
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["session_title"] == "Quantum Error Podcast"
    assert data["status"] in ["queued", "extracting", "completed"]
    assert data["podcast_style"] == "two_host"


def test_studio_session_authorization(client: TestClient, test_user: User, test_user_token: str, second_user_token: str, db_session: Session):
    # Create session owned by test_user
    session = StudioSession(
        user_id=test_user.id,
        session_title="Private Session",
        source_type="documents",
        source_metadata={"document_ids": []},
        podcast_style="single_host",
        target_duration="3-5",
        status="queued"
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    # second_user tries to get test_user's session -> 404
    headers2 = {"Authorization": f"Bearer {second_user_token}"}
    resp = client.get(f"/api/v1/studio/sessions/{session.id}", headers=headers2)
    assert resp.status_code == 404

    # second_user tries to delete test_user's session -> 404
    resp_del = client.delete(f"/api/v1/studio/sessions/{session.id}", headers=headers2)
    assert resp_del.status_code == 404

    # test_user can view own session -> 200
    headers1 = {"Authorization": f"Bearer {test_user_token}"}
    resp_own = client.get(f"/api/v1/studio/sessions/{session.id}", headers=headers1)
    assert resp_own.status_code == 200


def test_multi_document_processing_pipeline(db_session: Session, test_user: User):
    # Setup 2 documents with chunks
    doc1 = Document(
        user_id=test_user.id,
        filename="doc1.pdf",
        original_filename="Attention In Transformers.pdf",
        file_size=2048,
        storage_path=f"{test_user.id}/doc1.pdf",
        page_count=2,
        status="completed"
    )
    doc2 = Document(
        user_id=test_user.id,
        filename="doc2.pdf",
        original_filename="Surface Codes Review.pdf",
        file_size=2048,
        storage_path=f"{test_user.id}/doc2.pdf",
        page_count=2,
        status="completed"
    )
    db_session.add_all([doc1, doc2])
    db_session.commit()

    chunk1 = DocumentChunk(
        document_id=doc1.id,
        user_id=test_user.id,
        page_number=1,
        chunk_index=0,
        content="Transformers replace recurrence with multi-head self-attention mechanisms.",
        token_count=10
    )
    chunk2 = DocumentChunk(
        document_id=doc2.id,
        user_id=test_user.id,
        page_number=1,
        chunk_index=0,
        content="Surface codes provide fault tolerance with a 1 percent physical error threshold.",
        token_count=12
    )
    db_session.add_all([chunk1, chunk2])
    db_session.commit()

    # Create StudioSession
    session = StudioSession(
        user_id=test_user.id,
        session_title="Comparative AI and Quantum Study",
        source_type="documents",
        source_metadata={"document_ids": [doc1.id, doc2.id]},
        podcast_style="two_host",
        target_duration="3-5",
        summary_length="detailed",
        generate_notes=True
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    # Run processing pipeline
    process_studio_session_pipeline(session.id, db_override=db_session)

    db_session.refresh(session)
    assert session.status == "completed"
    assert session.progress == 100
    assert session.summary_data is not None
    assert "overview" in session.summary_data
    assert len(session.podcast_script) >= 4
    assert session.notes_data is not None
    assert "key_concepts" in session.notes_data
    assert session.audio_storage_path is not None


def test_optional_notes_disabled(db_session: Session, test_user: User):
    doc = Document(
        user_id=test_user.id,
        filename="doc_nonotes.pdf",
        original_filename="Quick Notes Paper.pdf",
        file_size=1024,
        storage_path=f"{test_user.id}/doc_nonotes.pdf",
        page_count=1,
        status="completed"
    )
    db_session.add(doc)
    db_session.commit()

    chunk = DocumentChunk(
        document_id=doc.id,
        user_id=test_user.id,
        page_number=1,
        chunk_index=0,
        content="Deep learning models can generalize across domains through transfer learning.",
        token_count=10
    )
    db_session.add(chunk)
    db_session.commit()

    session = StudioSession(
        user_id=test_user.id,
        session_title="No Notes Session",
        source_type="documents",
        source_metadata={"document_ids": [doc.id]},
        podcast_style="single_host",
        target_duration="3-5",
        summary_length="quick",
        generate_notes=False  # Disabled!
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    process_studio_session_pipeline(session.id, db_override=db_session)
    db_session.refresh(session)

    assert session.status == "completed"
    assert session.notes_data is None  # Notes generation was skipped!


def test_save_notes_to_workspace(client: TestClient, test_user: User, test_user_token: str, db_session: Session):
    headers = {"Authorization": f"Bearer {test_user_token}"}
    session = StudioSession(
        user_id=test_user.id,
        session_title="Quantum Notes Session",
        source_type="documents",
        source_metadata={"document_ids": []},
        status="completed",
        notes_data={
            "key_concepts": [{"term": "Superposition", "explanation": "Ability to exist in linear combinations of states."}],
            "definitions": [{"term": "Qubit", "definition": "Two-level quantum mechanical system."}],
            "revision_points": ["Review Bloch sphere representation."],
            "self_test_questions": [{"question": "What is decoherence?", "answer": "Loss of quantum coherence."}],
            "final_takeaways": ["Quantum error correction preserves logical quantum states."]
        }
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    resp = client.post(
        f"/api/v1/studio/sessions/{session.id}/save-notes",
        headers=headers,
        json={"title": "My Saved Quantum Notes"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "My Saved Quantum Notes"
    assert "Superposition" in data["content"]
    assert "Qubit" in data["content"]
