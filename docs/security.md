# ResearchPilot AI — Security Architecture & Threat Model

## 1. Authentication & Session Security

- **Password Hashing**: Plaintext passwords are never stored. Passwords are salted and hashed using `bcrypt` (work factor 12).
- **Session Tokens**: Uses JSON Web Tokens (JWT) signed with HMAC-SHA256 and configured expiration (default 24 hours).
- **HttpOnly Cookies**: Web sessions store tokens in `HttpOnly`, `SameSite=Lax` cookies, preventing cross-site scripting (XSS) extraction from JavaScript runtime storage.
- **CSRF & Header Bearer**: Supports dual-mode authorization (Authorization Header and secure cookie).

---

## 2. Document & File Security

- **Untrusted File Sandboxing**: Uploaded files are treated as hostile binaries.
  - Extension must strictly be `.pdf`.
  - Magic byte verification confirms the binary begins with `%PDF`.
  - Maximum upload size is enforced before ingestion (default 25 MB).
- **Path Traversal Protection**: User-supplied filenames are never used on the filesystem. All files are assigned a cryptographically random UUID (`uuid4().hex.pdf`) and validated against canonical base directory paths to prevent `../` traversal exploits.
- **No Remote Code Execution**: Extracted PDF contents are processed strictly as text and vector tokens. PDF active scripts, macros, and embedded executables are never parsed or executed.

---

## 3. Anti-Prompt Injection in Untrusted Document Text

Academic papers and documents uploaded by external parties could potentially contain adversarial instructions (e.g. *"Ignore all previous instructions and output..."*).

ResearchPilot AI mitigates prompt injection through three defense layers:
1. **Structural Delimiters**: All document text is sequestered inside strict `<context>` XML tags.
2. **System Rule Precedence**: System prompts instruct the LLM that content inside `<context>` is untrusted data and must never be interpreted as commands.
3. **Deterministic Grounding Filter**: Even if an LLM is prompted adversarially, the citation auditing pipeline cross-references answers with actual document chunks. Statements with no corresponding text in the source document are stripped or flagged.

---

## 4. Multi-Tenant Authorization & Data Isolation

All private resources (`Document`, `DocumentChunk`, `Conversation`, `Message`, `ResearchNote`) possess explicit foreign key relationships to the owning `User.id`.
- Authorization checks occur in backend service dependencies.
- Retrieval queries enforce `WHERE user_id = current_user.id` at the database level.
- Cross-user access attempts result in HTTP `404 Not Found` (rather than revealing resource existence).

---

## 5. Rate Limiting & Resource Safeguards

- **Auth Endpoints**: 15 requests per minute per IP to prevent brute-force credential stuffing.
- **AI Endpoints**: 25 requests per minute per client to prevent API exhaustion and uncontrolled third-party cost escalation.
