# PROJECT.md

Evidence-based project summary. Items not found in the repo are marked **Not detected.**

## Project name

- Root `README.md`: `lms_system`
- Deployment guide / schema comments: **Workians LMS**
- Public landing branding in UI: Daniel G / sales training (marketing surface)
- Default DB name in config examples: `workians_lms`

If a single canonical product name is required for branding, treat **Workians LMS** as the documented SaaS name; repo folder/README also use `lms_system` / `LMS`.

## Project purpose

Learning Management System (LMS) with community features for a sales-training organization. Supports:

- Multi-tenant orgs/businesses (schema: `businesses` / org scoping in controllers)
- Course and video content for students, trainers, and admins
- Community feed, wall of wins, gallery, document center
- Messaging (DMs), FAQs, Ask Ryan Q&A, Sell It Snacks short videos
- Onboarding (“Start Here”), welcome video, monthly challenges, upcoming events
- Admin/super-admin moderation (reports, nav visibility, member management)
- Public marketing landing page (`DanielGLandingPage`) and auth/register flows

## Project type

**Full-stack application** with a **two-package monorepo layout** (`frontend/` + `backend/`). Not a published library or CLI.

Also present: optional **Docker Compose** microservices stack for the backend; monolith fallback entrypoint.

## Technology stack

### Definitely detected

| Area | Technology | Evidence |
|------|------------|----------|
| Frontend UI | React 19 | `frontend/package.json` |
| Frontend routing | react-router-dom 7 | `frontend/src/App.jsx` |
| Frontend build | Vite 8 | `frontend/vite.config.js` |
| Frontend CSS/UI | Bootstrap 5, custom CSS | `frontend/package.json`, `index.css` |
| Video (client) | hls.js | `frontend/package.json`, player components |
| Icons | react-icons | `frontend/package.json` |
| Backend runtime | Node.js (CommonJS) | `backend/package.json` `"type": "commonjs"` |
| HTTP API | Express 5 | `backend/server.monolith.js`, services |
| DB client | mysql2 (promise pool) | `backend/config/db.js` |
| Database | MySQL 8 | `schema.sql`, `docker-compose.yml` `mysql:8.0` |
| Auth | JWT (`jsonwebtoken`), bcrypt | auth middleware/controller |
| Uploads | multer → local `backend/uploads` | route files |
| Email | nodemailer | `backend/shared/mailer.js` |
| Video processing | ffmpeg-static | feed/snacks/course video variant code |
| API composition | http-proxy-middleware gateway | `backend/services/gateway/server.js` |
| Security headers | helmet, cors, morgan | monolith / bootstrap |
| Payments dependency | razorpay | `backend/package.json` (handler currently stubbed) |
| S3 dependency | `@aws-sdk/client-s3` | listed in package.json; `backend/utils/s3.js` is empty |

### Probably present / planned (docs only or incomplete)

| Item | Notes |
|------|--------|
| AWS EC2 / RDS / S3 / PM2 / nginx | Described in `Deployment_Guide.md`; not fully implemented in app code |
| Vercel / Amplify / Next.js / subdomain multi-tenant routing | Mentioned in `Deployment_Guide.md`; **frontend is Vite SPA, not Next.js** — treat guide claims as needs verification |

### Not detected

- ORM (Prisma/Sequelize/Mongoose): **Not detected** (raw SQL via mysql2)
- GraphQL: **Not detected**
- Redis / message queue: **Not detected**
- Automated test suite: **Not detected**
- CI/CD configs (GitHub Actions, etc.): **Not detected**
- Shared root workspace (npm/pnpm/yarn workspaces): **Not detected** (root `package.json` only hosts `ai:context`)

## Languages

- JavaScript (JSX on frontend; CommonJS on backend)
- SQL (`schema.sql` + runtime `CREATE TABLE IF NOT EXISTS` in controllers)
- CSS
- Markdown documentation
- Dockerfile / YAML (Docker Compose)

## Frameworks / libraries (important)

**Frontend:** react, react-dom, react-router-dom, bootstrap, hls.js, react-icons, vite, eslint  

**Backend:** express, mysql2, jsonwebtoken, bcrypt, multer, dotenv, cors, helmet, morgan, nodemailer, http-proxy-middleware, ffmpeg-static, razorpay, @aws-sdk/client-s3, joi (dependency present; usage in controllers **Not detected**), nodemon (dev)

## Runtime

- Node.js (Docker image: `node:20-alpine`)
- Browser SPA served by Vite in development

## Build tools

- Frontend: `vite build` / `vite preview`
- Backend: no bundler; Node runs source directly
- Docker: `backend/Dockerfile`, `backend/docker-compose.yml`

## Main features / modules

| Module | Location (approx.) |
|--------|-------------------|
| Auth / register / password reset / email verify | `backend/controllers/auth.controller.js`, `/api/auth`, `/api/register` |
| Users / members / org stats | `users`, `org` routes/controllers |
| Courses, videos, bookmarks, progress | `courses` + `courseVideoVariants.service.js` |
| Payments (stub) | `payments` |
| Community feed + reports | `feed` |
| Messages (DM) | `messages` |
| Wall of Wins | `wallOfWins` |
| Sell It Snacks | `snacks` |
| Ask Ryan | `askRyan` |
| Document Center | `documentCenter` |
| Gallery | `gallery` |
| FAQs, welcome video, start-here, nav visibility, monthly challenges, upcoming events | matching routes/controllers |
| Admin / Student / Trainer UI | `frontend/src/pages/{admin,student,trainer}` |
| Public landing | `frontend/src/pages/public` |

## User roles

From `schema.sql` roles seed and `authorizeRole` usage:

- **CEO**
- **Admin**
- **Instructor** (trainer-facing UI under `/dashboard/trainer-*`)
- **Student**

## Authentication

- **Detected:** JWT Bearer token in `Authorization` header; `verifyToken` / `authorizeRole` middleware
- Frontend stores `token` and `user` in **localStorage**
- Email verification and password reset flows exist in auth controller + mailer
- Env vars (names only): `JWT_SECRET`, `JWT_EXPIRES_IN`, SMTP/MAIL_*, `FRONTEND_URL`

## External services

| Service | Status |
|---------|--------|
| MySQL (local/Docker/Hostinger/RDS per env) | Detected in code/config |
| SMTP email (e.g. Gmail app password pattern in example) | Detected (`mailer.js`) |
| Razorpay | Dependency + schema; create-order handler is a stub |
| AWS S3 | Dependency + deployment guide; active upload code uses local disk; `utils/s3.js` empty |
| Hostinger MySQL SSL hint | Detected in `db.js` (`*.hstgr.io`) |

## Storage

- **Primary (implemented):** local filesystem under `backend/uploads/` (course-media, feed-media, snacks-media, gallery, document-center, ask-ryan, welcome-video, etc.) served via gateway/static `/uploads`
- **Video variants:** generated with ffmpeg to disk
- **S3:** dependency present; implementation **Not detected** as active

## Deployment

- Documented: AWS EC2 + RDS + S3 + PM2 + nginx; frontend via Vercel/Amplify (`Deployment_Guide.md`) — **partially mismatched** with actual Vite app
- Docker Compose microservices + MySQL in `backend/`
- Scripts: `npm start` (all services), `npm run start:monolith`, `npm run dev`

## Important dependencies

See `frontend/package.json` and `backend/package.json`. Prefer adding packages only when existing utilities cannot cover the need.
