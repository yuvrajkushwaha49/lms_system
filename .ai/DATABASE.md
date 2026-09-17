# DATABASE.md

Database: **Detected** — MySQL via `mysql2` connection pool (`backend/config/db.js`).

- **ORM:** Not detected (raw SQL).
- **Credentials:** Never document real passwords. Env names: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`, `DB_CONNECTION_LIMIT`, `DB_CONNECT_TIMEOUT`.
- **Default DB name in examples:** `workians_lms` (schema file also references a Hostinger-style database name — treat as environment-specific).

Sources of truth:

1. Root `schema.sql` — baseline multi-tenant LMS tables  
2. Runtime `CREATE TABLE IF NOT EXISTS` inside controllers/services — feature tables used by live features  

Schema in production may be a **superset** of `schema.sql`. Always verify against running DB / controller SQL when changing queries.

---

## Technology

| Item | Value |
|------|--------|
| Engine | MySQL 8.x (Docker image `mysql:8.0`; schema comments say MySQL) |
| Client | `mysql2/promise` pool |
| Migrations framework | Not detected |
| Seeds | Role inserts in `schema.sql`; feature tables self-bootstrap |

---

## Tables from `schema.sql`

### Core tenancy & identity

| Table | Purpose | Key relationships |
|-------|---------|-------------------|
| `businesses` | Orgs/tenants | PK `id` |
| `roles` | CEO, Admin, Instructor, Student | PK `id`, unique `name` |
| `users` | Accounts | FK `business_id` → businesses, FK `role_id` → roles; unique `(business_id, email)` |

Notable `users` fields: `password_hash`, `status`, email verification + password reset token columns, `call_access_scope`.

### Courses & learning

| Table | Purpose |
|-------|---------|
| `courses` | Course catalog (`org_id`, `instructor_id`, pricing/delivery fields) |
| `modules` | Course modules / ordering |
| `lessons` | Lesson content (`video`/`pdf`/`text`, `content_url`) |
| `enrollments` | Student ↔ course |
| `progress_tracking` | Lesson progress / watch time |
| `course_videos` | Course video media |
| `course_video_likes` | Likes |
| `course_video_comments` | Comments |
| `course_video_progress` | Per-video watch status |
| `course_video_comment_reactions` | like/dislike on comments |
| `course_bookmarks` | Saved courses |
| `course_media_bookmarks` | Saved videos |

### Commerce / assessments (schema present; feature depth varies in app)

| Table | Purpose |
|-------|---------|
| `subscriptions` | Plans monthly/yearly |
| `payments` | Razorpay order/payment fields |
| `payouts` | Instructor payouts |
| `quizzes` / `questions` / `options` | Quiz content |
| `quiz_attempts` | Attempts |
| `certificates` | Issued certificates |

---

## Tables created at runtime (controllers/services)

These are **definitely used** by application code even if absent from `schema.sql`:

### Community feed
`member_feed_posts`, `member_feed_views`, `member_feed_likes`, `member_feed_post_attachments`, `member_feed_video_variants`, `member_feed_comments`, `member_feed_comment_reactions`, `member_feed_reports`, `member_feed_comment_reports`

### Messaging
`direct_conversations`, `direct_messages`

### Wall of Wins
`wall_of_wins_entries`, `wall_of_wins_likes`, `wall_of_wins_comments`

### Sell It Snacks
`sell_it_snacks`, `sell_it_snack_video_variants`, `sell_it_snack_likes`, `sell_it_snack_comments`, `sell_it_snack_comment_reactions`, `sell_it_snack_comment_reports`

### Ask Ryan
`org_ask_ryan_questions`, `org_ask_ryan_likes`, `org_ask_ryan_comments`, `org_ask_ryan_comment_likes`, `org_ask_ryan_section_likes`

### Gallery
`gallery_folders`, `gallery_images`, `gallery_likes`, `gallery_comments`, `gallery_comment_likes`, `gallery_comment_reports`

### Document Center
`document_center_items`, `document_center_item_comments`, `document_center_item_likes`, `document_center_comment_likes`

### Other org features
`faqs`, `org_welcome_video`, `upcoming_events`, `org_student_nav_visibility`, `start_here_step_likes`, `org_monthly_challenge_labels`, `org_monthly_challenge_course_placements`, `course_video_variants`, plus course-related IF NOT EXISTS mirrors (`course_lessons`, comment reports, etc. in `courses.controller.js`)

Auth code also references **`organizations`** in some queries — may coexist with `businesses`. Treat as **Needs verification** against the live database.

---

## Relationships (conceptual)

```
businesses (org)
  ├── users (role_id → roles)
  ├── courses → modules → lessons
  ├── courses → course_videos → likes/comments/progress/variants
  ├── member_feed_* / wall_of_wins_* / gallery_* / document_center_*
  ├── sell_it_snacks_* / org_ask_ryan_* / faqs / welcome / events
  └── direct_conversations → direct_messages
```

Most feature tables include `org_id` for tenant scoping.

## Indexes / FKs

Defined extensively in `schema.sql` (unique enrollments, email uniqueness per business, progress uniques, etc.). Runtime-created tables define their own indexes/uniques in the `CREATE TABLE` SQL inside controllers — inspect those strings when altering schema.

## Important query patterns

- Controllers obtain `db` from `require('../config/db')` and use `db.query(...)`.
- Many handlers ensure schema via an `ensure*Tables` helper before CRUD.
- Connection errors mapped via `mapDbError` / `isDbConnectionError` in `config/db.js`.

## Secrets

Do **not** commit or document actual `DB_PASSWORD` or connection strings from `.env`.
