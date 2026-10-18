import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.document import Document
from app.models.conversation import Conversation
from app.models.note import ResearchNote
from app.services.retrieval import retriever_service


def test_cross_user_document_access_denied(client: TestClient, db_session: Session, test_user, second_user_token):
    # Create doc owned by test_user
    doc = Document(
        user_id=test_user.id,
        filename="private_user1.pdf",
        original_filename="Confidential Research.pdf",
        file_size=1024,
        storage_path="private_user1.pdf",
        status="completed"
    )
    db_session.add(doc)
    db_session.commit()

    # Second user attempts to GET User 1's document
    res_get = client.get(
        f"/api/v1/documents/{doc.id}",
        headers={"Authorization": f"Bearer {second_user_token}"}
    )
    assert res_get.status_code == 404

    # Second user attempts to DELETE User 1's document
    res_del = client.delete(
        f"/api/v1/documents/{doc.id}",
        headers={"Authorization": f"Bearer {second_user_token}"}
    )
    assert res_del.status_code == 404

    # Verify document still exists in DB
    db_session.expire_all()
    assert db_session.get(Document, doc.id) is not None


def test_cross_user_conversation_access_denied(client: TestClient, db_session: Session, test_user, second_user_token):
    conv = Conversation(user_id=test_user.id, title="Secret Strategy")
    db_session.add(conv)
    db_session.commit()

    res = client.get(
        f"/api/v1/conversations/{conv.id}",
        headers={"Authorization": f"Bearer {second_user_token}"}
    )
    assert res.status_code == 404


def test_cross_user_note_access_denied(client: TestClient, db_session: Session, test_user, second_user_token):
    note = ResearchNote(
        user_id=test_user.id,
        title="Classified Finding",
        content="Sensitive analysis notes."
    )
    db_session.add(note)
    db_session.commit()

    res = client.patch(
        f"/api/v1/notes/{note.id}",
        headers={"Authorization": f"Bearer {second_user_token}"},
        json={"title": "Hacked Title"}
    )
    assert res.status_code == 404


def test_cross_user_retrieval_isolation(db_session: Session, test_user, second_user):
    # Chunk owned by test_user
    doc = Document(
        user_id=test_user.id,
        filename="u1.pdf",
        original_filename="User1 doc",
        file_size=512,
        storage_path="u1.pdf",
        status="completed"
    )
    db_session.add(doc)
    db_session.flush()

    # Query matching chunk
    results = retriever_service.retrieve(
        db=db_session,
        query="User1 secret content",
        user_id=second_user.id,  # second user querying
        top_k=5
    )
    # Must retrieve 0 chunks belonging to test_user
    assert len(results) == 0
