# CLINIXAI — Explainable Clinical Intelligence

A working research demonstration with Next.js, TypeScript, React, Recharts, FastAPI, SQLAlchemy, LangGraph, JWT authentication, document retrieval, transparent uncertainty, expert review and PDF reports. Use synthetic data only. This application does not diagnose, prescribe, or replace medical professionals.

## Local setup

Requirements: Node.js 22+ and Python 3.12+.

```powershell
npm ci
python -m pip install -r requirements.txt
python -m backend.scripts.migrate
python -m backend.scripts.seed
python -m uvicorn backend.app.main:app --reload --port 8000
# In another terminal:
npm run dev
```

Open http://localhost:3000. Development `/api` requests proxy to FastAPI on port 8000. Interactive API documentation: http://localhost:8000/api/docs. Export environment settings in your shell; `.env` is not automatically loaded by Python.

## Demo access

| Role | Email | Password |
| --- | --- | --- |
| Clinician | clinician@clinixai.demo | ClinixDemo!2026 |
| Expert reviewer | expert@clinixai.demo | ClinixDemo!2026 |
| Administrator | admin@clinixai.demo | ClinixDemo!2026 |

Public demo users are seeded only with `DEMO_MODE=true`. Synthetic records are intentionally shared in demo mode. Registration always creates clinicians; privileged operations are checked on the server. Use a new database, `DEMO_MODE=false`, and a private `JWT_SECRET` for private operation. Administrators must then be provisioned by a controlled database process.

## Features

The expanded demo seeds 16 reproducible synthetic patient scenarios, completed and pending review examples, and seven downloadable report snapshots. Seeded review notes are labeled synthetic examples. UUIDs for these demo patients and cases are stable across server instances.

Session fixes: valid signed clinician demo sessions can recover their identity after temporary SQLite loss; recovery never grants an expert/admin role. The frontend discards invalid sessions, returns to sign-in and renews active sessions every 30 minutes. Real account/password persistence and user-created clinical records still require durable PostgreSQL; session recovery is not a substitute for a durable database.

- Patient registration, searching, case creation, validated vital signs and consent.
- Nine real deterministic LangGraph agent nodes and conditional escalation.
- Actual timestamped execution traces and database checkpoint records.
- Reference-library PDF, DOCX and TXT extraction and passage retrieval.
- Patient document attachments at `POST /api/cases/{id}/documents`.
- Input-based explanations, contradiction detection and missing-information analysis.
- Transparent five-component uncertainty and separate deterministic safety routing.
- Expert assignment, human-authored decisions, review history and audit records.
- Database-derived analytics, in-app notifications and downloadable snapshot PDF reports.
- Responsive landing page and connected clinical workspace with loading/error states.

## Workflow

```mermaid
flowchart TD
  UI[Next.js interface] --> API[FastAPI: JWT and roles]
  API --> DB[(SQLAlchemy database)]
  API --> P[Patient data]
  P --> C[Clinical analysis]
  C --> K[Knowledge retrieval]
  K --> D[Differential considerations]
  D --> E[Explainability]
  E --> U[Uncertainty]
  U --> S[Safety review]
  S -->|Review required| X[Expert escalation]
  S -->|No escalation| R[Report generation]
  X --> R
  R --> H[Human review gate]
  H --> PDF[Snapshot PDF]
```

Agent responsibilities are deterministic rules and retrieval operations, not trained independent clinical models. No paid AI API or remote LLM is required. Analysis is synchronous; the UI displays the actual completed execution trace and periodically refreshes stored data. It does not simulate live execution.

## Database and deployment

Local default: persistent SQLite in `clinixai.db`. For durable PostgreSQL set `DATABASE_URL=postgresql+psycopg://user:password@host/database?sslmode=require`. The version-one schema uses `users`, indexed typed JSON `records`, and `audit_logs`. Record kinds represent patients, cases, knowledge/chunks, clinical documents, agent executions, checkpoints, escalations, reviews/comments, reports and notifications. This compact implementation is not the proposed normalized 27-table schema. The initialization script is idempotent, not a complete future migration framework.

`docker-compose.yml` starts PostgreSQL and FastAPI; set `POSTGRES_PASSWORD` and `JWT_SECRET` first. Run the frontend separately with `npm run dev`.

Vercel: run `vercel --prod` from the repository root. Next.js serves the interface; `api/index.py` exposes FastAPI through `vercel.json`. Configure `DATABASE_URL` for durable storage. **Without PostgreSQL, Vercel uses temporary `/tmp` SQLite; demo records may reset or differ between server instances.** This is disclosed in the interface. Never use demo mode for private patient data. A persistent FastAPI service can also run on Render/Railway with a frontend API rewrite to it.

## Transparent uncertainty

For each component, quality runs from 0 (worst) to 100 (best). Contribution = `(100 - quality) × weight`.

| Quality component | Weight | Method |
| --- | --- | --- |
| Data completeness | 20% | Fraction of nine fields recorded |
| Evidence quality | 25% | Retrieved-passage-count proxy, capped at 80 |
| Agent agreement | 20% | Configured contradiction penalty |
| Calibration quality | 20% | Zero: no clinical calibration available |
| Input reliability | 15% | Basic age support check |

Scores: 0–25 lower, 26–50 moderate, 51–75 high, 76–100 very high. These are educational heuristics, not validated clinical cutoffs or probabilities. Expert escalation occurs for scores above 50, safety flags, missing critical vitals, contradictions, absent evidence or explicit requests. Clinical risk and uncertainty are independent. Evidence quantity and cosine similarity do not establish clinical validity. Calibration's unavailable status is explicitly retained as 20 uncertainty points.

## Testing

```powershell
python -m pip install pytest httpx
python -m pytest backend/tests -q
npm run build
npm run typecheck
```

Tests exercise authentication, role permissions, registration privilege protection, inputs and consent, uncertainty direction, safety precedence, contradictions, retrieval provenance, expert assignment/review, report PDF extraction, upload validation and audit history. GitHub Actions repeats the production build and tests.

## Honest scope and limitations

This is an executable academic demonstration, not a validated production healthcare service. Bundled teaching passages are synthetic, explicitly labeled, and never presented as external medical citations. No diagnoses, prescriptions, SHAP values, predictive model metrics or clinical accuracy claims are generated.

Not implemented: trained predictive models and calibration, pgvector/sentence-transformer embeddings, external LLM integration, WebSocket streaming, OCR, email password reset, advanced user/role editing, organization tenancy, distributed rate limiting, cryptographically immutable audits and the full normalized schema. Review/assignment and knowledge-management controls are functional; read-only settings describe the implemented runtime.

Production healthcare deployment requires independent clinical validation, private identity, durable encrypted storage, backup and retention policies, monitoring, security testing and applicable legal, privacy and regulatory review, including relevant Indian requirements. No compliance certification is claimed.
