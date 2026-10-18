# ResearchPilot AI — API Documentation

All API routes are versioned under `/api/v1`. Interactive OpenAPI documentation is available at `http://localhost:8000/api/docs`.

---

## 1. Authentication Endpoints

### `POST /api/v1/auth/register`
Creates a new user account. Returns a JWT access token and sets a secure HttpOnly cookie.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "full_name": "Dr. Alex Rivera"
}
```

**Response (201 Created):**
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "user": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "user@example.com",
    "full_name": "Dr. Alex Rivera",
    "is_active": true,
    "created_at": "2026-10-18T10:00:00Z"
  }
}
```

### `POST /api/v1/auth/login`
Authenticates existing user and issues session token and HttpOnly cookie.

### `POST /api/v1/auth/logout`
Revokes session and clears access token cookies.

### `GET /api/v1/auth/me`
Retrieves current authenticated user's profile.

---

## 2. Document Management

### `POST /api/v1/documents`
Uploads a research PDF document. Automatically triggers asynchronous background extraction and vector indexing.

- **Content-Type**: `multipart/form-data`
- **Field**: `file` (PDF file, max 25MB)

### `GET /api/v1/documents`
Lists documents owned by the current user. Supports pagination and filtering.

**Query Parameters:**
- `query`: String filter matching document filename.
- `status`: `queued`, `processing`, `completed`, or `failed`.
- `page`: Integer page number (default 1).
- `page_size`: Results per page (default 10, max 100).

### `GET /api/v1/documents/{document_id}`
Returns metadata, page count, indexed chunk count, and structured summary for a document.

### `GET /api/v1/documents/{document_id}/file`
Streams the PDF binary for inline display within the document reader.

### `DELETE /api/v1/documents/{document_id}`
Permanently deletes the document file, database record, and cascades deletions across all child chunks, embeddings, and citations.

### `POST /api/v1/documents/{document_id}/reprocess`
Re-queues document for text extraction, chunking, and embedding generation.

---

## 3. Research Chat & Grounded RAG

### `GET /api/v1/conversations`
Lists all conversations belonging to the user.

### `POST /api/v1/conversations`
Creates a new conversation thread with optional document scope.

```json
{
  "title": "Quantum Computing Analysis",
  "selected_document_ids": ["doc-id-1", "doc-id-2"]
}
```

### `POST /api/v1/conversations/{conversation_id}/messages`
Sends a question, runs hybrid vector + keyword retrieval, synthesizes a grounded answer, and emits citations.

**Request Body:**
```json
{
  "content": "What is the fault-tolerance threshold reported in the paper?",
  "selected_document_ids": null
}
```

**Response (200 OK):**
```json
{
  "id": "msg-uuid",
  "conversation_id": "conv-uuid",
  "role": "assistant",
  "content": "Based on the provided research documents:\n\nSurface codes provide an error threshold of approximately 1% under depolarizing noise.",
  "latency_ms": 350,
  "token_count": 142,
  "citations": [
    {
      "id": "cit-uuid",
      "document_id": "doc-uuid",
      "document_title": "Quantum Error Correction.pdf",
      "page_number": 1,
      "excerpt": "Topological quantum error correction codes provide high fault-tolerance thresholds estimated at approximately 1.0%...",
      "relevance_score": 0.0164,
      "is_exact_quote": false
    }
  ],
  "created_at": "2026-10-18T10:15:00Z"
}
```

---

## 4. Research Tools

### `POST /api/v1/research/summarize`
Generates a structured, evidence-grounded summary of a processed paper.
- Extracted sections: Problem, Abstract, Objectives, Methodology, Dataset, Algorithms, Results, Limitations, Future Directions.

### `POST /api/v1/research/compare`
Produces a multi-paper comparison matrix across 2 to 4 papers with an objective synthesis.

### `POST /api/v1/research/search`
Executes semantic and lexical search directly across user documents and returns ranked excerpts.

---

## 5. Notes & Usage

### `GET /api/v1/notes` & `POST /api/v1/notes`
CRUD operations for research notes linked to documents.

### `GET /api/v1/notes/export/markdown`
Exports all research notes as a consolidated Markdown document.

### `GET /api/v1/usage`
Telemetry analytics: total documents, tokens consumed by model, average latency, and estimated costs.
