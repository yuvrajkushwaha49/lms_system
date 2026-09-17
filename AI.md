# AI Assistant Entry Point

Read this file first before making changes in this repository.

## Mandatory workflow

1. Read `AI.md` (this file) first.
2. Read only the relevant files under `.ai/` for the task (see guide below).
3. Inspect the actual source code before changing anything.
4. Never assume technologies or architecture — verify from project files.
5. Reuse existing code, patterns, and utilities whenever possible.
6. Make minimal, safe changes that solve the requested problem.
7. Avoid unnecessary dependencies and broad refactoring.
8. Do not break existing functionality.
9. Never expose secrets (`.env` values, keys, tokens, passwords).
10. Update `.ai/` documentation when architecture or important functionality changes; append an entry to `.ai/CHANGELOG.md`.

## Project snapshot (discovered)

- **Layout:** Two packages — `frontend/` and `backend/` — plus root `schema.sql` and deployment notes.
- **Type:** Full-stack application (SPA + API), effectively a monorepo without a shared workspace tool.
- **Do not invent** APIs, tables, or services that are not present in code.

## When to use each `.ai` file

| File | Use when |
|------|----------|
| `.ai/PROJECT.md` | Need project purpose, stack, roles, modules, dependencies |
| `.ai/ARCHITECTURE.md` | Need layers, data flow, gateway/microservices, routing, auth flow |
| `.ai/FILE_STRUCTURE.md` | Need folder/file orientation (regenerate with `npm run ai:context`) |
| `.ai/API.md` | Adding/changing HTTP endpoints or calling existing APIs |
| `.ai/DATABASE.md` | Schema, tables, queries, or MySQL-related work |
| `.ai/RULES.md` | Coding conventions and project-specific constraints |
| `.ai/CHANGELOG.md` | Checking recent documented architecture/context changes |

## Regenerating the file tree

```bash
npm run ai:context
```

This updates **only** `.ai/FILE_STRUCTURE.md` via `scripts/generate-ai-context.cjs`.

## Secret safety

Never copy values from `.env`, `.env.local`, credentials files, or private keys into docs, commits, or chat. Document variable **names** only when needed.
