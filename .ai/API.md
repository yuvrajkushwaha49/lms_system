# API.md

API layer: **Detected** (Express REST under `/api/*`, proxied by API gateway or served by monolith).

Base URL (dev): gateway `http://localhost:5000` (frontend often uses relative `/api` via Vite proxy).

Common response shape observed: `{ status: 'success'|'error', data?, message? }`.

Auth: many routes use `verifyToken` (JWT Bearer). Role gates use `authorizeRole([...])`.  
Unless noted, assume JWT required when the route file calls `router.use(verifyToken)` or per-route `verifyToken`.

Validation: ad-hoc in controllers; Joi is a dependency but controller usage was **Not detected**.

---

## Gateway / health

| Method | Endpoint | Purpose | Auth | Handler |
|--------|----------|---------|------|---------|
| GET | `/health` | Health check | None | gateway / service bootstrap |
| GET | `/` | Gateway info | None | `services/gateway/server.js` |
| GET | `/json/version` | Version info | None | gateway |

---

## `/api/auth` — identity · `routes/auth.routes.js` · `auth.controller`

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/auth/register-platform` | Platform/org registration | None |
| POST | `/api/auth/register` | Alias of register-platform | None |
| POST | `/api/auth/login` | Login; returns JWT | None |
| GET/POST | `/api/auth/verify-email` | Email verification | None |
| POST | `/api/auth/resend-verification` | Resend verification email | None |
| POST | `/api/auth/forgot-password` | Password reset request | None |
| POST | `/api/auth/reset-password` | Password reset complete | None |
| GET | `/api/auth/me` | Current token payload | JWT |

Also: `POST /api/register/` → same register handler (`register.routes.js`).

---

## `/api/users` — user · `users.controller` · JWT; role checks on CRUD

| Method | Endpoint | Purpose | Auth / roles |
|--------|----------|---------|--------------|
| POST | `/api/users/` | Create user | CEO, Admin |
| GET | `/api/users/members` | Member directory list | JWT |
| GET | `/api/users/members/:id/profile` | Member profile | JWT |
| GET | `/api/users/members/:id/activity-summary` | Activity summary | JWT |
| GET | `/api/users/members/:id/feed-posts` | Member feed posts | JWT |
| GET | `/api/users/members/:id/feed-comments` | Member feed comments | JWT |
| GET | `/api/users/members/:id/posting-spaces` | Posting spaces | JWT |
| GET | `/api/users/members/:id/wall-of-wins` | Member wall entries | JWT |
| GET | `/api/users/` | List users | CEO, Admin, Instructor |
| GET | `/api/users/:id` | User by id | CEO, Admin, Instructor |
| PUT | `/api/users/:id` | Update user | CEO, Admin |
| PATCH | `/api/users/:id/status` | Toggle status | CEO, Admin |
| DELETE | `/api/users/:id` | Delete user | CEO, Admin |

---

## `/api/org` — user · `org.controller`

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/org/dashboard-stats` | Org dashboard stats | JWT + CEO/Admin |

---

## `/api/courses` — course · `courses.controller` · JWT on all

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/courses/` | Create course |
| GET | `/api/courses/` | List courses |
| PUT | `/api/courses/:courseId` | Update course |
| DELETE | `/api/courses/:courseId` | Delete course |
| GET | `/api/courses/reports/video-comments` | Video comment reports |
| GET | `/api/courses/bookmarks` | Course bookmarks |
| GET | `/api/courses/media-bookmarks` | Media bookmarks |
| POST | `/api/courses/upload-media` | Upload media (`multer` field `file`) |
| POST | `/api/courses/:courseId/bookmark/toggle` | Toggle course bookmark |
| POST | `/api/courses/:courseId/videos/:videoId/bookmark/toggle` | Toggle media bookmark |
| POST | `/api/courses/:courseId/lessons` | Create lesson |
| GET | `/api/courses/:courseId/lessons` | List lessons |
| POST | `/api/courses/:courseId/videos` | Create video |
| GET | `/api/courses/:courseId/videos` | List videos |
| GET | `/api/courses/:courseId/videos/engagement` | Engagement stats |
| POST | `/api/courses/:courseId/videos/:videoId/likes/toggle` | Toggle like |
| POST | `/api/courses/:courseId/videos/:videoId/comments` | Add comment |
| PATCH | `/api/courses/:courseId/videos/:videoId/comments/:commentId` | Edit comment |
| POST | `.../comments/:commentId/reports` | Report comment |
| POST | `.../comments/:commentId/reaction` | Comment reaction |
| PATCH | `.../comments/:commentId/block` | Block comment |
| DELETE | `.../comments/:commentId` | Delete comment |
| POST | `/api/courses/:courseId/videos/:videoId/progress` | Upsert watch progress |
| PUT | `/api/courses/:courseId/videos/:videoId` | Update video |
| PATCH | `/api/courses/:courseId/videos/:videoId/status` | Toggle video status |
| DELETE | `/api/courses/:courseId/videos/:videoId` | Delete video |

Service helper: `services/courseVideoVariants.service.js` (ffmpeg variants).

---

## `/api/monthly-challenge-months` — course · `monthlyChallengeMonths.controller` · JWT

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | List labels |
| POST | `/` | Upsert label |
| GET | `/:monthKey/schedule` | Month schedule |
| GET | `/:monthKey/admin-detail` | Admin detail |
| PUT | `/:monthKey/courses/:courseId/placement` | Set course placement |
| DELETE | `/:monthKey/courses/:courseId/placement` | Remove placement |
| DELETE | `/:monthKey` | Delete label |

---

## `/api/feed` — community · `feed.controller`

| Method | Endpoint | Purpose | Notes |
|--------|----------|---------|-------|
| GET | `/media/variants/:variantId` | Stream variant media | Protected media |
| GET | `/media/posts/:postId` | Stream post media | |
| GET | `/media/:attachmentId` | Stream attachment | |
| GET | `/summary` | Feed space summary | |
| GET | `/trending` | Trending posts | |
| GET | `/` | List posts | |
| GET | `/reports/comments` | Comment reports list | |
| GET | `/reports` | Post reports | |
| GET | `/reports/:reportId` | Report detail | |
| PATCH | `/reports/:reportId/block-post` | Block reported post | |
| POST | `/` | Create post | `multer` `media` ≤12 |
| POST | `/:postId/views` | Record view | |
| POST | `/:postId/likes/toggle` | Toggle like | |
| POST | `/:postId/reports` | Report post | |
| POST | `/:postId/comments` | Add comment | |
| PATCH | `/:postId/comments/:commentId` | Edit comment | |
| DELETE | `/:postId/comments/:commentId` | Delete comment | |
| POST | `/:postId/comments/:commentId/reports` | Report comment | |
| POST | `/:postId/comments/:commentId/reaction` | Comment reaction | |

---

## `/api/messages` — community · `messages.controller` · JWT

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/conversations` | List conversations |
| POST | `/conversations/ensure` | Ensure conversation |
| GET | `/conversations/:conversationId/messages` | List messages |
| POST | `/conversations/:conversationId/messages` | Send message |
| PATCH | `/conversations/:conversationId/read` | Mark read |
| PATCH | `/conversations/:conversationId/messages/:messageId` | Edit message |
| DELETE | `/conversations/:conversationId/messages/:messageId` | Delete message |

---

## `/api/wall-of-wins` — community · `wallOfWins.controller` · JWT

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | List entries |
| GET | `/:entryId/suggestions` | Suggestions |
| GET | `/:entryId/comments` | Comments |
| GET | `/:entryId` | Entry detail |
| POST | `/:entryId/likes/toggle` | Toggle like |
| POST | `/:entryId/comments` | Add comment |
| POST | `/` | Create entry | multipart upload |
| PATCH | `/:entryId/block` | Block/unblock |
| DELETE | `/:entryId` | Delete |

---

## `/api/upcoming-events` — community · `upcomingEvents.controller` · JWT

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | List events |
| POST | `/` | Create event |
| PATCH | `/:eventId` | Update event |

(Additional methods may exist in controller — verify file before extending.)

---

## `/api/document-center` — content · `documentCenter.controller`

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/files` | List files | JWT |
| POST | `/upload` | Upload file | JWT + CEO/Admin/Instructor |
| GET | `/items` | List items | JWT |
| GET | `/items/:id` | Item detail | JWT |
| POST | `/items` | Create item | JWT + CEO/Admin/Instructor |
| PUT | `/items/:id` | Update item | JWT + CEO/Admin/Instructor |
| DELETE | `/items/:id` | Delete item | JWT + CEO/Admin/Instructor |
| GET | `/items/:id/comments` | Comments | JWT |
| POST | `/items/:id/comments` | Add comment | JWT |
| POST | `/items/:id/comments/:commentId/like` | Like comment | JWT |
| GET | `/items/:id/likes` | Likes | JWT |
| POST | `/items/:id/like` | Like item | JWT |
| POST | `/items/:id/comment` | Increment comment counter | JWT |

---

## `/api/gallery` — content · `gallery.controller` · JWT; admin for mutations

Folders, images, likes, comments, comment reports — see `gallery.routes.js` for full list (`/folders`, `/images/:imageId`, `/comments/:commentId`, uploads via multer).

---

## `/api/faqs` — content · `faqs.controller` · JWT

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | List FAQs |
| POST | `/` | Create |
| PATCH | `/:faqId` | Update |
| DELETE | `/:faqId` | Delete |

---

## `/api/snacks` — content · `snacks.controller` · JWT

CRUD for Sell It Snacks, likes, comments, reactions, reports; multipart `video`/`thumbnail` on create/update. See `snacks.routes.js`.

---

## `/api/ask-ryan` — content · `askRyan.controller` · JWT

Questions, likes, comments, published list, admin answer with video/thumbnail upload. See `askRyan.routes.js`.

---

## `/api/welcome-video` — content · `welcomeVideo.controller` · JWT

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Get welcome video config/media |
| PUT | `/` | Upsert (JSON or multipart video/thumbnail) |

---

## `/api/student-nav-visibility` — content · JWT

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Get nav visibility JSON |
| PUT | `/` | Upsert visibility |

---

## `/api/start-here-steps` — content · JWT

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/stats` | Step stats |
| POST | `/:stepKey/toggle-like` | Toggle step like |

---

## `/api/payments` — payment · `payments.controller` · JWT

| Method | Endpoint | Purpose | Notes |
|--------|----------|---------|-------|
| POST | `/create-order` | Create payment order | Currently returns stub success message; Razorpay not wired in handler |

---

## Middleware reference

- `middlewares/auth.middleware.js`: `verifyToken`, `authorizeRole`
- Upload: `multer` disk storage per feature folder under `backend/uploads/`

## Request / response bodies

Not fully standardized in OpenAPI. **Inspect the specific controller** before documenting or changing payloads. Do not invent schemas.
