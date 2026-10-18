import io
import pymupdf
import pytest
from fastapi.testclient import TestClient


def create_sample_pdf_bytes(title: str = "Test Research Paper", content: str = "This is a sample research text.") -> bytes:
    doc = pymupdf.open()
    page1 = doc.new_page()
    page1.insert_text((50, 72), f"Title: {title}\n\nAbstract: {content}")
    page2 = doc.new_page()
    page2.insert_text((50, 72), "Methodology: We trained neural networks using Adam optimizer with learning rate 1e-4.")
    data = doc.tobytes()
    doc.close()
    return data


def test_upload_non_pdf(client: TestClient, test_user_token):
    response = client.post(
        "/api/v1/documents",
        headers={"Authorization": f"Bearer {test_user_token}"},
        files={"file": ("test.txt", b"plain text", "text/plain")}
    )
    assert response.status_code == 400
    assert "Only PDF documents" in response.json()["detail"]


def test_upload_fake_pdf(client: TestClient, test_user_token):
    response = client.post(
        "/api/v1/documents",
        headers={"Authorization": f"Bearer {test_user_token}"},
        files={"file": ("fake.pdf", b"Not a real PDF header", "application/pdf")}
    )
    assert response.status_code == 400
    assert "not a valid PDF" in response.json()["detail"]


def test_upload_valid_pdf_and_list(client: TestClient, test_user_token):
    pdf_bytes = create_sample_pdf_bytes()
    response = client.post(
        "/api/v1/documents",
        headers={"Authorization": f"Bearer {test_user_token}"},
        files={"file": ("attention.pdf", pdf_bytes, "application/pdf")}
    )
    assert response.status_code == 201
    doc_data = response.json()
    assert doc_data["original_filename"] == "attention.pdf"
    assert doc_data["status"] == "queued"
    doc_id = doc_data["id"]

    # Verify listing
    list_res = client.get(
        "/api/v1/documents",
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert any(d["id"] == doc_id for d in items)

    # Verify detail
    detail_res = client.get(
        f"/api/v1/documents/{doc_id}",
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    assert detail_res.status_code == 200
    assert detail_res.json()["original_filename"] == "attention.pdf"


def test_delete_document(client: TestClient, test_user_token):
    pdf_bytes = create_sample_pdf_bytes()
    upload_res = client.post(
        "/api/v1/documents",
        headers={"Authorization": f"Bearer {test_user_token}"},
        files={"file": ("delete_me.pdf", pdf_bytes, "application/pdf")}
    )
    doc_id = upload_res.json()["id"]

    del_res = client.delete(
        f"/api/v1/documents/{doc_id}",
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    assert del_res.status_code == 200

    # Verify 404 after deletion
    get_res = client.get(
        f"/api/v1/documents/{doc_id}",
        headers={"Authorization": f"Bearer {test_user_token}"}
    )
    assert get_res.status_code == 404
