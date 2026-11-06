# API reference

The generated reference is at `/api/docs`; OpenAPI JSON is `/api/openapi.json`. Protected requests require `Authorization: Bearer <token>`. Login and registration return a token and public user profile.

Working resource groups: auth, patients, cases and analysis/results/explanations/uncertainty/evidence, agents, clinical document uploads, escalations/assignment, expert reviews/comments, knowledge upload/deletion, analytics, audit logs, notifications/read state and report generation/download. Consult OpenAPI for exact methods and validation schemas.

Files: PDF, DOCX or UTF-8 TXT, at most 5 MB. No OCR. Invalid formats return 422; oversized files return 413. Case consent is mandatory. Review decisions: Approved, Rejected, Additional Information Required, Completed. Reviewed case analysis returns 409 to preserve the human decision basis.
