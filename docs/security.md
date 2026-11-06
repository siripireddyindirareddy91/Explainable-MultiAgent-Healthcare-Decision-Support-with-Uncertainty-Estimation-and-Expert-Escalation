# Security and privacy

Passwords use salted PBKDF2-SHA256 with 260,000 iterations. JWT sessions expire after two hours. Self-registration cannot grant privileged roles. Expert/admin identity is required for review, assignment and audit access; admin identity is required for knowledge-library mutations. Clinical document attachment requires case access. Private-mode clinicians see their own records; experts/admins can review all cases. No tenant/organization isolation is implemented.

Public demo accounts and the public demo signing key intentionally provide no private identity guarantee. Only synthetic information is allowed. Disable DEMO_MODE and set a random JWT_SECRET with a new durable database before any private deployment. Existing demo users must not remain in a private database.

Uploads are limited to 5 MB, supported parsers and a DOCX expanded-size check. React escapes text; PDF paragraphs escape XML. CORS origins are configured, basic response headers are set and per-process rate limits apply. Real healthcare use needs professional clinical, legal, security and privacy review; this software makes no compliance claim.
