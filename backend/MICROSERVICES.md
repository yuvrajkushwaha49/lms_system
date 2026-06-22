# LMS Backend — Microservices (shared database)

## Architecture

| Service | Port | Routes |
|---------|------|--------|
| **API Gateway** | 5000 | Proxies all `/api/*`, serves `/uploads` |
| identity-service | 5001 | `/api/auth`, `/api/register` |
| user-service | 5002 | `/api/users`, `/api/org` |
| course-service | 5003 | `/api/courses`, `/api/monthly-challenge-months` |
| community-service | 5004 | `/api/feed`, `/api/messages`, `/api/wall-of-wins` |
| content-service | 5005 | `/api/document-center`, `/api/gallery`, `/api/faqs`, `/api/snacks`, `/api/ask-ryan`, `/api/welcome-video`, `/api/start-here-steps` |
| payment-service | 5006 | `/api/payments` |

All services use the **same MySQL database** (`DB_HOST`, `DB_NAME`, etc. in `.env`).

Controllers and routes remain in `backend/controllers` and `backend/routes` (shared code).

## Run locally

```bash
cd backend
npm install
# copy .env.microservices.example → .env if needed
npm start          # starts all 6 services + gateway (no auto-reload)
npm run dev        # nodemon — restarts all services when code changes
```

Frontend: keep `VITE_API_URL=http://localhost:5000` (gateway).

## Monolith fallback

```bash
npm run start:monolith
```

## Docker

```bash
docker compose up --build
```

Gateway exposed on port 5000.

## Health checks

- Gateway: `GET http://localhost:5000/health`
- Each service: `GET http://localhost:5001/health` (etc.)
