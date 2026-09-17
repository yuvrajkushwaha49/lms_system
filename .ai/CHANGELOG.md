# CHANGELOG.md

Record of important AI-context / architecture documentation changes (not every code edit).

### 2026-09-17

- **Change:** Created AI context system (`AI.md`, `.ai/*`, `scripts/generate-ai-context.cjs`, root `package.json` script `ai:context`).
- **Reason:** Give AI assistants accurate, evidence-based project guidance after a full read-only audit of `frontend/`, `backend/`, `schema.sql`, and docs.
- **Affected areas:** Repository root documentation; `.ai/` knowledge base; root npm script only (no application runtime behavior change).
- **Migration/API impact:** None.
