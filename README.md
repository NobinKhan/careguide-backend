# Care Guide BD — Backend API (`careguide-backend`)

Role-based REST & RPC API built with **Bun**, **Hono**, and **Mongoose (MongoDB)** implementing strict ESR-compliant indexing and single-pipeline aggregations.

## Tech Stack
- **Runtime:** Bun (`Bun.password.hash` / `Bun.password.verify` with `bcrypt`)
- **Framework:** Hono (`hono`, `hono/jwt`, `hono/cors`, `@hono/zod-validator`, `zod`)
- **Database:** MongoDB + Mongoose (`InferSchemaType<typeof schema>`, `globalThis` connection singleton)

## MongoDB Indexing Strategy (Strictly 4 Custom Indexes)
1. **`users` (`{ email: 1 }`, unique):** Powers $O(\log N)$ user lookup on `POST /api/auth/login` and enforces unique email addresses.
2. **`users` (`{ interests: 1 }`, multikey):** Powers Scenario 1 Aggregation (`$match` non-empty interests + `$unwind`).
3. **`notes` (`{ userId: 1, _id: -1 }`, compound ESR):** Powers paginated user notes (`GET /api/notes`) with zero in-memory sort, plus left-prefix `{ userId: 1 }` ownership check on `PATCH`/`DELETE /api/notes/:id` and user deletion cascade.
4. **`posts` (`{ userId: 1, _id: -1 }`, compound ESR):** Powers Scenario 2 Aggregation (`$lookup` from `users._id` to `posts.userId` sorted by `_id: -1`) and user deletion cascade.
- **Built-in `_id_` Index Reuse:** All global chronological queries (`GET /api/users`, `GET /api/notes/all`, `GET /api/posts`) sort by `{ _id: -1 }`, reusing MongoDB's default `_id_` index with zero extra index overhead.

## Quick Start

```bash
cp .env.example .env
bun install
bun run seed
bun run dev
```

## Scripts
- `bun run dev` — Start development server with hot reload (`http://localhost:3000`)
- `bun run start` — Start production server
- `bun run seed` — Reset database, sync indexes via `mongoose.connection.syncIndexes()`, print active indexes, and populate deterministic demo data
- `bun run sync:types` — Emit TypeScript contract declarations into `../careguide-frontend/src/types/api-contract.d.ts`
- `bun run typecheck` — Run `tsc --noEmit`
