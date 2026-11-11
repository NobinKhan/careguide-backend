# Care Guide BD — Backend API (`careguide-backend`)

Role-based REST & RPC API built with **Bun**, **Hono**, and **Mongoose 8** (tested against **MongoDB 9.0** and **Mongoose 8**), implementing strict ESR-compliant indexing and single-pipeline aggregations.

## Tech Stack & Versions
- **Runtime:** Bun 1.4.x (`Bun.password.hash` / `Bun.password.verify` with native bcrypt)
- **Framework:** Hono ^4.7.4 (`hono`, `hono/jwt`, `hono/cors`, `hono/secure-headers`, `hono/body-limit`, `@hono/zod-validator`, `zod`)
- **Database:** MongoDB 9.0 (tested with mongod 9.0.8) + Mongoose 8 (`InferSchemaType<typeof schema>`, `globalThis` connection singleton)
- **Containerization:** Multi-stage Docker build using **Chainguard** (`cgr.dev/chainguard/bun:latest-dev` builder $\rightarrow$ `cgr.dev/chainguard/glibc-dynamic:latest` minimal non-root runtime)

## MongoDB Indexing Strategy (Strictly 4 Custom Indexes)
1. **`users` (`{ email: 1 }`, unique):** Powers $O(\log N)$ user lookup on `POST /api/auth/login` and enforces unique email addresses.
2. **`users` (`{ interests: 1 }`, multikey):** Powers Scenario 1 Aggregation (`$match` non-empty interests + `$unwind`).
3. **`notes` (`{ userId: 1, _id: -1 }`, compound ESR):** Powers paginated user notes (`GET /api/notes`) with zero in-memory sort, plus left-prefix `{ userId: 1 }` ownership check on `PATCH`/`DELETE /api/notes/:id` and user deletion cascade.
4. **`posts` (`{ userId: 1, _id: -1 }`, compound ESR):** Powers Scenario 2 Aggregation (`$lookup` from `users._id` to `posts.userId` sorted by `_id: -1`) and user deletion cascade.
- **Built-in `_id_` Index Reuse:** All global chronological queries (`GET /api/users`, `GET /api/notes/all`, `GET /api/posts`) sort by `{ _id: -1 }`, reusing MongoDB's default `_id_` index with zero extra index overhead.

## API Reference

Every endpoint returns JSON. Error responses follow `{ error: string, fields?: Record<string, string> }`. Requests exceeding 100 KB return HTTP 413 `{"error":"Request too large"}`.

| Method | Path | Role | Body / Query | Success Response | Error Codes |
|:---|:---|:---|:---|:---|:---|
| `GET` | `/api/health` | Public | None | `{ status: "ok", service: "careguide-backend" }` | — |
| `POST` | `/api/auth/register` | Public | JSON `{ name, email, password, interests? }` | `201 { token, user }` | 400 (validation), 409 (duplicate email), 413 |
| `POST` | `/api/auth/login` | Public | JSON `{ email, password }` | `200 { token, user }` | 400 (validation), 401 (invalid creds), 413, 429 (throttled after 5 failed attempts) |
| `GET` | `/api/auth/me` | `user`, `admin` | Bearer token | `200 { user }` | 401 (invalid/expired or deleted user) |
| `PATCH` | `/api/users/me/interests` | `user`, `admin` | JSON `{ interests: string[] }` | `200 { user }` | 400 (validation), 401, 413 |
| `GET` | `/api/notes` | `user`, `admin` | Query `?page=1&limit=10` | `200 { items, page, limit, total, totalPages }` | 400 (validation), 401 |
| `POST` | `/api/notes` | `user`, `admin` | JSON `{ title, content }` | `201 { note }` | 400 (validation), 401, 413 |
| `PATCH` | `/api/notes/:id` | `user` (own), `admin` (any) | JSON `{ title?, content? }` | `200 { note }` | 400 (invalid id/validation), 401, 404 (not found or not owner), 413 |
| `DELETE` | `/api/notes/:id` | `user` (own), `admin` (any) | None | `200 { deletedId }` | 400 (invalid id), 401, 404 (not found or not owner) |
| `GET` | `/api/notes/all` | `admin` only | Query `?page=1&limit=10` | `200 { items, page, limit, total, totalPages }` | 400 (validation), 401, 403 (non-admin) |
| `GET` | `/api/posts` | `user`, `admin` | Query `?page=1&limit=10` | `200 { items, page, limit, total, totalPages }` | 400 (validation), 401 |
| `POST` | `/api/posts` | `user`, `admin` | JSON `{ title, body }` | `201 { post }` | 400 (validation), 401, 413 |
| `GET` | `/api/users` | `admin` only | Query `?page=1&limit=10` | `200 { items, page, limit, total, totalPages }` | 400 (validation), 401, 403 |
| `POST` | `/api/users` | `admin` only | JSON `{ name, email, password, role?, interests? }` | `201 { user }` | 400 (validation), 401, 403, 409 (duplicate email), 413 |
| `PATCH` | `/api/users/:id` | `admin` only | JSON `{ name?, email?, password?, role?, interests? }` | `200 { user }` | 400 (invalid id / self-demotion / validation), 401, 403, 404, 409 (duplicate email), 413 |
| `DELETE` | `/api/users/:id` | `admin` only | Query `?keepData=true\|false` | `200 { deletedUserId, keepData, deletedNotesCount, deletedPostsCount }` | 400 (invalid id / self-deletion / validation), 401, 403, 404 |
| `GET` | `/api/aggregations/users-by-interest` | `user`, `admin` | Query `?page=1&limit=10` | `200 { items, page, limit, total, totalPages }` | 400 (validation), 401 |
| `GET` | `/api/aggregations/user-posts/:userId` | `user`, `admin` | Query `?page=1&limit=10` | `200 { user: { ..., posts }, page, limit, total, totalPages }` | 400 (invalid id / validation), 401, 404 |

## Testing
No automated tests by design (`AGENTS.md` strictly prohibits test files for this project). Verify functionality with:
- `bun run typecheck`
- `bun run seed`
- Manual API checks using curl or frontend

## Quick Start (Local Development)

```bash
cp .env.example .env
# Set JWT_SECRET in .env to a secure random string (at least 32 characters, e.g. openssl rand -hex 32)
bun install
bun run seed
bun run dev
```

## Docker & VPS Deployment (MongoDB 9 + Bun)

The project includes an optimized multi-stage `Dockerfile` compiling the Bun server and demo seeder into standalone Linux binaries packaged inside a hardened, zero-CVE **Chainguard** runtime:

```bash
# 1. Clone repository on VPS
git clone https://github.com/NobinKhan/careguide-backend.git
cd careguide-backend

# 2. Automated Build, Start & Deploy
bun run deploy

# To reset demo data explicitly on deployment:
bun run deploy -- --seed
```

> **Security Note:** `JWT_SECRET` is mandatory in `.env` and must be at least 32 characters long. Generate one using `openssl rand -hex 32`. Anyone who deployed with previous default values must rotate their `JWT_SECRET` immediately.

## Available Scripts
- `bun run dev` — Start development server with hot reload (`http://localhost:3000`)
- `bun run start` — Start production server
- `bun run seed` — Reset database, sync indexes via `mongoose.connection.syncIndexes()`, and populate deterministic demo data
- `bun run deploy` — Native Bun script to build containers and start backend (pass `--seed` to seed demo data)
- `bun run build:binary` — Compile backend into standalone binary (`dist/server`)
- `bun run build:seed` — Compile seeder into standalone binary (`dist/seed`)
- `bun run sync:types` — Emit TypeScript contract declarations into `../careguide-frontend/src/types/api-contract.d.ts`
- `bun run typecheck` — Run `tsc --noEmit`
