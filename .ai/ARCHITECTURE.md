# ARCHITECTURE.md

Architecture as implemented in this repository.

## High-level shape

```
┌─────────────────────┐         ┌──────────────────────────────────────────┐
│  frontend (Vite SPA)│  /api/* │  API Gateway :5000                       │
│  React + RRDOM      │────────►│  http-proxy-middleware                   │
│  Bootstrap / CSS    │ /uploads│  + static /uploads                       │
└─────────────────────┘         └──────┬───────────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼              ▼               ▼               ▼              ▼
   identity:5001  user:5002     course:5003   community:5004  content:5005
   /api/auth      /api/users    /api/courses  /api/feed       /api/gallery
   /api/register  /api/org      /api/monthly… /api/messages   /api/snacks …
                                                        payment:5006
                                                        /api/payments
                                       │
                                       ▼
                              Shared MySQL (mysql2 pool)
```

**Monolith fallback:** `backend/server.monolith.js` mounts the same `/api/*` routes in one process (port `PORT` or 5000).

Default entry `backend/server.js` → `scripts/start-all.js` (gateway + all services).

## Application layers

### Frontend

- **Entry:** `frontend/src/main.jsx` → `App.jsx`
- **Routing:** React Router `BrowserRouter` / `Routes` (client-side)
- **Pages:** `pages/admin`, `pages/student`, `pages/trainer`, `pages/public`
- **Shared UI:** `components/`, `layouts/`, `contexts/`
- **Utils:** `utils/apiBaseUrl.js`, `mediaUrl.js`, nav/session helpers
- **State:** Mostly React local state + `localStorage` (`token`, `user`); one context: `StudentHeaderSearchContext`
- **Global store (Redux/Zustand/etc.):** Not detected

### Backend

- **Routes** → **Controllers** → **mysql2 pool** (`config/db.js`)
- Some shared helpers: `shared/mailer.js`, `shared/bootstrap.js`, `shared/publicUrl.js`, `shared/gateway-config.js`
- Video variant service: `services/courseVideoVariants.service.js`
- Microservices under `services/{gateway,identity,user,course,community,content,payment}/server.js` share the same controllers/routes code

### Data access

- No ORM
- Controllers run SQL strings; many feature tables are created at runtime with `CREATE TABLE IF NOT EXISTS`
- Baseline LMS tables also defined in root `schema.sql`

## Data flow (typical authenticated request)

```
UI page
  → fetch(`${getApiBaseUrl()}/api/...`, { Authorization: Bearer <token> })
  → Vite proxy (dev) OR direct gateway URL (prod)
  → Gateway proxies path to owning service
  → Route + middleware (verifyToken / authorizeRole / multer)
  → Controller SQL via mysql2
  → JSON { status, data|message }
```

Dev proxy: `frontend/vite.config.js` proxies `/api` and `/uploads` to `VITE_DEV_PROXY_TARGET` (default `http://127.0.0.1:5000`).

## Frontend routing

Public: `/`, `/coming-soon`, `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`

Authenticated app under `/dashboard/*` for admin, student, and trainer surfaces (see `App.jsx`).

## Backend API mounting

Gateway route map: `backend/shared/gateway-config.js`  
Monolith mounts: `backend/server.monolith.js`

Health: `GET /health` on gateway and services.

## Authentication & authorization

```
Login → JWT signed with JWT_SECRET → client stores token
Request → Authorization: Bearer <jwt>
verifyToken → req.user
authorizeRole(['CEO','Admin',...]) on sensitive routes
```

## Storage

- Uploads written under `backend/uploads/<feature>/`
- Gateway/monolith serve `/uploads` as static files (feed media has special protected streaming paths under `/api/feed/media/...`)

## External integrations

- **Email:** nodemailer (verification / password reset)
- **Payments:** Razorpay package present; `createOrder` currently returns a success stub
- **S3:** SDK dependency present; no active implementation in `utils/s3.js`

## Build / deployment

| Piece | Mechanism |
|-------|-----------|
| Frontend build | `npm run build` in `frontend/` (Vite) |
| Backend run | Node scripts / nodemon / Docker Compose |
| DB | MySQL; apply `schema.sql` + allow runtime table bootstrap |
| Documented prod | `Deployment_Guide.md` (AWS-oriented; verify against actual Vite frontend) |

## Tests / CI

Not detected in repository.
