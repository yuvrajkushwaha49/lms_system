# RULES.md

AI coding rules for this repository. Derived from the actual project layout and conventions.

## Universal

1. **Inspect before modifying** — read the target files and related routes/controllers/UI before editing.
2. **Reuse existing implementation** — prefer extending current controllers, routes, components, and utils.
3. **Avoid duplicate functionality** — check for an existing endpoint, page, or helper first.
4. **Follow existing conventions** — naming, folder layout, response `{ status, data|message }` shapes, JWT via `Authorization: Bearer`.
5. **Avoid unnecessary dependencies** — do not add packages if existing code or Node built-ins suffice.
6. **Avoid unnecessary refactoring** — no drive-by renames, framework migrations, or architecture rewrites.
7. **Do not delete functionality without approval** — including routes, tables, or UI flows.
8. **Do not expose secrets** — never print or commit `.env` values, keys, tokens, or passwords.
9. **Do not change architecture unnecessarily** — keep gateway + microservices (or monolith) patterns as-is unless explicitly requested.
10. **Update AI docs** when architecture, APIs, or database structure changes meaningfully; append `.ai/CHANGELOG.md`.

## Project-specific rules

### Monorepo layout

- Frontend work lives in `frontend/`; backend in `backend/`.
- Root `npm run ai:context` only regenerates `.ai/FILE_STRUCTURE.md`.
- There is no shared TypeScript monorepo toolchain — do not assume one.

### Frontend

- Stack is **React + Vite + react-router-dom + Bootstrap**, not Next.js (despite some deployment guide wording).
- Use `getApiBaseUrl()` from `utils/apiBaseUrl.js` for API origin behavior.
- Auth token/user are in **localStorage** keys `token` and `user`.
- Match existing page structure under `pages/admin|student|trainer|public`.
- Prefer existing CSS in `index.css` / page CSS over introducing a new design system.
- HLS/adaptive playback: reuse `CommunityVideoPlayer`, `CourseAdaptiveVideo`, etc.

### Backend

- Prefer adding routes in the correct `routes/*.routes.js` and logic in matching `controllers/*.controller.js`.
- If introducing tables, follow the existing **`CREATE TABLE IF NOT EXISTS`** pattern **or** update `schema.sql` and document both — do not invent an ORM.
- Mount new `/api/...` paths in **both** `server.monolith.js` and `shared/gateway-config.js` (+ owning microservice) when applicable.
- Use `verifyToken` / `authorizeRole` consistently; roles are `CEO`, `Admin`, `Instructor`, `Student`.
- File uploads: multer disk storage under `backend/uploads/<feature>/`, same pattern as existing routes.
- Video processing: reuse `ffmpeg-static` helpers already used in feed/snacks/course variants.
- Do not assume Razorpay or S3 are fully wired — verify code before building on them (`payments.controller` is stubbed; `utils/s3.js` empty).
- Keep `DB_CONNECTION_LIMIT` concerns in mind when adding services that open pools.

### Database

- MySQL only in this project. Do not introduce another database without explicit request.
- Tenant scoping via `org_id` / `business_id` is common — preserve it.
- Never commit real credentials; use `.env.microservices.example` as the name template only.

### Documentation accuracy

- Prefer code evidence over `Deployment_Guide.md` when they conflict (e.g. Vite vs Next.js).
- Mark unknowns as **Not detected** / **Needs verification**.

### Testing

- No automated test suite was detected — do not claim coverage exists; if adding tests, place them consistently and document the approach.
