# Architecture

The Next.js client calls FastAPI REST endpoints. JWT authentication and role authorization run server-side. The LangGraph graph uses a shared typed state and conditional safety routing; its nine nodes implement deterministic data processing, observations, retrieval, considerations, explanation, uncertainty, safety, escalation and report generation. Executions and node-completion checkpoints are stored. These checkpoints are audit records, not resumable LangGraph execution checkpoints. Failed requests can be retried; reviewed cases reject re-analysis.

SQLAlchemy supports SQLite and PostgreSQL. The compact schema stores typed JSON records with indexed kind and owner fields. Patient relationships are validated in application code; a full foreign-key-normalized model is a future migration. Analysis is synchronous. Every generated observation remains unverified pending a human decision; no agent approves its own output.
