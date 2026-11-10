# Care Guide BD Backend Assignment — Master Architecture & AI Agent Specification (`AGENTS.md`)

> **DEPLOYMENT & HARNESS NOTICE:** This specification governs both **Antigravity** (`.idx/airules.md` / `AGENTS.md`) and **OpenCode** (`.opencode.json` / `AGENTS.md` / `CLAUDE.md`). Copy or symlink this file into the workspace root, `careguide-backend/AGENTS.md`, and `careguide-frontend/AGENTS.md`.

---

## 🛑 1. HARD STOP INITIALIZATION GATE (MANDATORY PRE-FLIGHT)

**CRITICAL AGENT INSTRUCTION:** You are strictly forbidden from generating, planning, or modifying any application code until the following three tools are verified as installed and active in the workspace. If any tool is missing, **HALT IMMEDIATELY**, execute the installation steps below, and verify before proceeding.

### 1.1 `thedotmack/claude-mem` (Persistent Cross-Session Memory)
* **Verification & Install:**
  * Run `npx claude-mem status` or verify the MCP server entry in Antigravity (`mcp_config.json`) / OpenCode (`.opencode.json`).
  * If missing, run: `npx claude-mem install` (NEVER use `npm i -g claude-mem` alone, as it omits the background worker daemon and lifecycle hooks).
* **Execution Protocol:**
  * Use the 3-step MCP `mem-search` workflow (`search` index $\rightarrow$ `timeline` context $\rightarrow$ `get_observations` for specific IDs) before starting any task or after context resets.
  * **Privacy Guardrail:** Always wrap `.env` values (`MONGODB_URI`, `JWT_SECRET`, VPS IPs) inside `<private>...</private>` tags so secrets are never persisted into the SQLite/Chroma memory store.

### 1.2 `DietrichGebert/ponytail` (Ponytail v5 — Anti-Slop & Code Minimization)
* **Verification & Install:**
  * Ensure `.agents/skills/ponytail` (and `.claude/skills/ponytail`) is loaded in **`full`** mode.
* **The Ladder (Mandatory Order of Operations):**
  1. **YAGNI:** Does the assignment PDF explicitly ask for this? If no, do not build it.
  2. **Reuse:** Use existing middleware, models, or helpers already in the repo.
  3. **Stdlib / Native Runtime:** Use **Bun native APIs** (`Bun.password.hash`, `Bun.password.verify`, `crypto.randomUUID()`) and **Hono built-ins** (`hono/jwt`, `hono/cors`, `hono/client`).
  4. **One-liner:** Inline simple operations rather than creating single-use helper files.
  5. **New Code:** Write minimum viable, high-clarity TypeScript.
* **CRITICAL OVERRIDE TO PONYTAIL DEFAULT:** Ponytail v5 normally enforces shipping tests for risky logic. **FOR THIS PROJECT, TEST GENERATION IS STRICTLY DISABLED.** Do not generate `*.test.ts`, `*.spec.ts`, or test runners under any circumstances.
* **Debt Tracking:** If taking a deliberate architectural shortcut, annotate with `// shortcut: <reason>` so `/ponytail-debt` can track it. Run `/ponytail-review` before finishing any task to strip diff bloat.

### 1.3 `pbakaus/impeccable` (Deterministic UI Linter — Restricted Mode)
* **Verification & Install:**
  * Inside `careguide-frontend`, verify `npx impeccable --version` and ensure the **automatic design hook** is enabled (`npx impeccable install`).
  * Initialize minimal context via `/impeccable init` (`PRODUCT.md`).
* **Assignment-Specific Restriction:**
  * The Care Guide BD instructions explicitly state: *"The visual style of the frontend is not a priority... DO NOT waste time improving the frontend. This is a backend task."*
  * Therefore, rely **ONLY** on Impeccable's deterministic binary hook to catch broken HTML, missing form labels, cramped padding, or P0 layout bugs.
  * **FORBIDDEN:** Do not run iterative aesthetic loops (`/impeccable polish`, `/impeccable bolder`, `/impeccable critique`). Build clean, functional Tailwind CSS tables, forms, and tabs on the first pass and move on.

---

## 📂 2. DUAL-REPO WORKSPACE & ATOMIC TYPE-SYNC PROTOCOL

To satisfy the submission requirement for **two separate GitHub repository links** while preventing Cloudflare Pages build failures, the project uses a **Multi-Root Workspace** containing two independent Git repositories:

```text
careguide-workspace/
├── AGENTS.md                  # Master specification (symlinked into both repos)
├── careguide-backend/         # Repo 1: Hono + Bun + Mongoose (Deployed on VPS)
│   ├── .git/
│   ├── src/
│   │   ├── index.ts           # Main Hono entry + exports AppType
│   │   ├── db.ts              # Bun-safe Mongoose singleton connection
│   │   ├── middleware/
│   │   │   └── auth.ts        # hono/jwt verification + RBAC guard (user vs admin)
│   │   ├── models/
│   │   │   ├── User.ts        # Users schema + explicit schema.index()
│   │   │   ├── Note.ts        # Notes schema + explicit schema.index()
│   │   │   └── Post.ts        # Posts schema + explicit schema.index()
│   │   ├── routes/
│   │   │   ├── auth.ts        # Register, Login, Me
│   │   │   ├── users.ts       # Admin user CRUD + User profile/interests update
│   │   │   ├── notes.ts       # User own notes CRUD + Admin view all notes
│   │   │   ├── posts.ts       # Public posts creation & listing
│   │   │   └── aggregations.ts# Scenario 1 (Interests) & Scenario 2 ($lookup Posts)
│   │   └── seed.ts            # Live-interview deterministic database seeder
│   ├── package.json
│   └── tsconfig.json
└── careguide-frontend/        # Repo 2: SolidJS v2 + Tailwind CSS (Deployed on Cloudflare)
    ├── .git/
    ├── src/
    │   ├── types/
    │   │   └── api-contract.d.ts # Synced automatically from careguide-backend
    │   ├── api/
    │   │   └── client.ts      # Hono hc<AppType>(VITE_API_URL) RPC instance
    │   ├── App.tsx            # Auth state, Role switcher view, Notes, Posts, Aggregations
    │   └── index.tsx
    ├── package.json
    └── tsconfig.json
```

### 2.1 The Cross-Repo Type Sync Rule (MANDATORY)
1. **Never use relative runtime imports across repos:** `careguide-frontend` must NEVER import runtime code from `../../careguide-backend/...` because Cloudflare Pages only clones `careguide-frontend`.
2. **Automated Declaration Sync (`bun run sync:types`):**
   * `careguide-backend/package.json` must define:
     ```json
     "scripts": {
       "dev": "bun --watch src/index.ts",
       "start": "bun src/index.ts",
       "seed": "bun src/seed.ts",
       "sync:types": "tsc --project tsconfig.types.json --declaration --emitDeclarationOnly --outFile ../careguide-frontend/src/types/api-contract.d.ts"
     }
     ```
   * Alternatively, maintain a shared, zero-dependency `src/types/contract.ts` synced via a 5-line Bun script into `../careguide-frontend/src/types/contract.ts`.
3. **Atomic Dual-Repo Commit Mandate:**
   * Whenever the agent adds or modifies ANY backend route, request validator, or response shape in `careguide-backend`, the agent **MUST IMMEDIATELY**:
     1. Run `bun run sync:types` in `careguide-backend`.
     2. Update the corresponding consumer function/view in `careguide-frontend`.
     3. Verify `bun run typecheck` passes in **both** repositories before reporting task completion.

---

## 🛠️ 3. CORE TECHNOLOGY STACK & NATIVE CONSTRAINTS

### 3.1 Runtime & Backend (`careguide-backend`)
* **Runtime:** **Bun** (Native package manager, script runner, HTTP server).
* **Framework:** **Hono** (`hono`, `@hono/zod-validator`, `zod`).
* **Authentication & Security (Zero External NPM Bloat):**
  * **Password Hashing:** Use **`Bun.password.hash(plain, { algorithm: "bcrypt", cost: 10 })`** and **`Bun.password.verify(plain, hash)`**. **FORBIDDEN:** Do not install `bcrypt`, `bcryptjs`, or `argon2` from npm.
  * **JWT Signing & Verification:** Use **`sign` and `verify` from `hono/jwt`**. **FORBIDDEN:** Do not install `jsonwebtoken` or `jose`.
* **Database Layer:** **MongoDB via Mongoose ONLY**.
  * **FORBIDDEN:** Do NOT install or configure Prisma, Drizzle, or TypeORM.
  * **Schema Typing:** Derive all TypeScript model types using `InferSchemaType<typeof schema>`. Do not write duplicate manual `interface IUser` definitions.
  * **Bun Hot-Reload Singleton (`src/db.ts`):** Cache the Mongoose connection on `globalThis` so `bun --watch` never spawns duplicate connection pools on the VPS.

### 3.2 Frontend (`careguide-frontend`)
* **Framework:** **SolidJS v2** + **Tailwind CSS** (Deployed to Cloudflare Pages).
* **Strict SolidJS v2 Reactivity Rules:**
  * **No React Mental Models:** Never use `useState`, `useEffect`, `useMemo`, or `useCallback`. Components execute **once**.
  * **Never Destructure Props:** Always access `props.value` directly inside JSX or reactive tracking scopes.
  * **Solid v2 Primitives:** Use `createSignal`, `createMemo` (including first-class async memos where appropriate), `onSettled` (instead of legacy `onMount`), and standard `class="..."` attributes (not `classList`).
* **API Communication:**
  * Use Hono's typed RPC client `hc<AppType>(import.meta.env.VITE_API_URL)` or a strictly typed `apiFetch<T>` wrapper bound to the synced `api-contract.d.ts` with `Authorization: Bearer <token>` header injection.

---

## 🗄️ 4. MONGODB INDEXING & AGGREGATION SPECIFICATION (CRITICAL GRADING AREA)

### 4.1 Strict Indexing Rules from the Assignment PDF
1. **Explicit `schema.index()` Only:**
   * *"You must use the `schema.index` method for defining indexes in your code so they are visible during review."*
   * **AGENT BAN:** You are **STRICTLY FORBIDDEN** from writing `index: true` or `unique: true` inside Mongoose schema field objects (e.g., `email: { type: String, unique: true }` is **BANNED**). Every single index must be declared below the schema using `schema.index(...)`.
2. **Zero Unnecessary Indexes:**
   * *"CRITICAL CONSTRAINT: DO NOT MAKE ANY UNNECESSARY INDEXES. You will be evaluated on the efficiency of your indexing strategy."*
   * **Free `_id_` Index Strategy:** MongoDB automatically maintains a unique B-tree index on `_id`, and `ObjectId` values are naturally chronological (first 4 bytes are a Unix timestamp). Therefore, all global chronological sorts (Admin listing all users, Admin listing all notes, single document lookups by ID) **MUST sort and filter by `_id: -1`** to reuse the built-in `_id_` index with **zero extra index overhead**.
3. **Mandatory Reviewer Justification Comments:**
   * Immediately above each `schema.index()` call, include a clear `// INDEX JUSTIFICATION (ESR Rule): ...` comment explaining the exact query/aggregation it powers.

### 4.2 Exact Mongoose Models & The ONLY 4 Allowed Custom Indexes

#### Model 1: `src/models/User.ts`
```ts
import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
    interests: { type: [String], default: [] },
  },
  { timestamps: true }
);

// INDEX JUSTIFICATION (Index 1 of 4 - Equality + Uniqueness):
// Supports fast O(log N) user lookup by email during POST /api/auth/login and enforces unique emails.
userSchema.index({ email: 1 }, { unique: true });

// INDEX JUSTIFICATION (Index 2 of 4 - Multikey Index for Aggregation Scenario 1):
// Supports Scenario 1 Aggregation (Group Users by Interests) by indexing non-empty array elements in `interests`.
userSchema.index({ interests: 1 });

// NOTE ON ADMIN USER LISTING & USER LOOKUP:
// - Admin paginated user list (`GET /api/users`) sorts by `{ _id: -1 }`, utilizing MongoDB's built-in `_id_` index.
// - Scenario 2 (`$lookup` user posts) matches User by `{ _id }`, utilizing MongoDB's built-in `_id_` index.
// No additional indexes on User are needed.

export type User = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
```

#### Model 2: `src/models/Note.ts`
```ts
import { Schema, model, type InferSchemaType } from 'mongoose';

const noteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

// INDEX JUSTIFICATION (Index 3 of 4 - ESR Rule: Equality on `userId`, Sort on `_id: -1`):
// 1. Supports User viewing their own paginated notes (`find({ userId }).sort({ _id: -1 }).skip().limit()`) with zero in-memory sort.
// 2. Left-prefix `{ userId: 1 }` supports ownership verification on update/delete (`findOne({ _id, userId })`).
noteSchema.index({ userId: 1, _id: -1 });

// NOTE ON ADMIN VIEWING ALL NOTES:
// Admin paginated list of all notes (`GET /api/notes/all`) queries `find({}).sort({ _id: -1 }).skip().limit()`,
// which directly uses MongoDB's built-in `_id_` index. No extra index required.

export type Note = InferSchemaType<typeof noteSchema>;
export const NoteModel = model('Note', noteSchema);
```

#### Model 3: `src/models/Post.ts`
```ts
import { Schema, model, type InferSchemaType } from 'mongoose';

const postSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
  },
  { timestamps: true }
);

// INDEX JUSTIFICATION (Index 4 of 4 - Aggregation Scenario 2 `$lookup` & Chronological Sort):
// Directly accelerates Scenario 2 Aggregation (`$lookup` from `users._id` to `posts.userId` sorted by `_id: -1`).
postSchema.index({ userId: 1, _id: -1 });

export type Post = InferSchemaType<typeof postSchema>;
export const PostModel = model('Post', postSchema);
```

---

## 🔄 5. REQUIRED AGGREGATION PIPELINES & RBAC ENDPOINTS

### 5.1 Role-Based Access Control (RBAC) Matrix
| Feature / Endpoint | Method & Path | Access Role | Pagination & Sorting Strategy |
| :--- | :--- | :--- | :--- |
| Register / Login | `POST /api/auth/register`, `POST /api/auth/login` | Public | Uses `{ email: 1 }` unique index |
| Current User Profile | `GET /api/auth/me`, `PATCH /api/users/me/interests` | `user`, `admin` | Uses built-in `{ _id: 1 }` index |
| User's Own Notes (Paginated) | `GET /api/notes?page=1&limit=10` | `user`, `admin` | `find({ userId })` + `sort({ _id: -1 })` via `{ userId: 1, _id: -1 }` |
| Create / Update / Delete Own Note | `POST /api/notes`, `PATCH /api/notes/:id`, `DELETE /api/notes/:id` | `user` (own), `admin` (any) | Enforces ownership check `{ _id, userId }` for `user` role |
| Admin: View Everyone's Notes | `GET /api/notes/all?page=1&limit=10` | `admin` only | `find({})` + `sort({ _id: -1 })` via built-in `_id_` index |
| Admin: Manage Users (CRUD + List) | `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id` | `admin` only | `find({})` + `sort({ _id: -1 })` via built-in `_id_` index; `DELETE` supports `?keepData=true\|false` |
| Public Posts (Create & View All) | `POST /api/posts`, `GET /api/posts?page=1&limit=10` | `user`, `admin` | `find({})` + `sort({ _id: -1 })` via built-in `_id_` index |
| **Scenario 1: Users by Interest** | `GET /api/aggregations/users-by-interest` | `user`, `admin` | **Single `UserModel.aggregate()` call** |
| **Scenario 2: User Posts via `$lookup`** | `GET /api/aggregations/user-posts/:userId` | `user`, `admin` | **Single `UserModel.aggregate()` call with `$lookup`** |

### 5.2 Scenario 1 Pipeline: Group Users by Interests
Must be executed in **one single `UserModel.aggregate()` call**:
```ts
// GET /api/aggregations/users-by-interest
const groupedByInterest = await UserModel.aggregate([
  // Stage 1: Filter users who have at least one interest (leverages { interests: 1 } multikey index)
  { $match: { interests: { $exists: true, $not: { $size: 0 } } } },
  // Stage 2: Deconstruct the interests array into individual documents
  { $unwind: '$interests' },
  // Stage 3: Group by interest string and collect matching user summaries
  {
    $group: {
      _id: '$interests',
      totalUsers: { $sum: 1 },
      users: {
        $push: {
          _id: '$_id',
          name: '$name',
          email: '$email',
          role: '$role',
        },
      },
    },
  },
  // Stage 4: Sort by most popular interest first, then alphabetically
  { $sort: { totalUsers: -1, _id: 1 } },
  {
    $project: {
      _id: 0,
      interest: '$_id',
      totalUsers: 1,
      users: 1,
    },
  },
]);
```

### 5.3 Scenario 2 Pipeline: Retrieve All Posts Belonging to a Particular User (`$lookup`)
Must be executed in **one single aggregation pipeline using `$lookup`**:
```ts
// GET /api/aggregations/user-posts/:userId?page=1&limit=10
const userWithPosts = await UserModel.aggregate([
  // Stage 1: Match target user by _id (uses built-in _id_ index)
  { $match: { _id: new Types.ObjectId(userId) } },
  // Stage 2: $lookup posts from 'posts' collection (uses postSchema.index({ userId: 1, _id: -1 }))
  {
    $lookup: {
      from: 'posts',
      localField: '_id',
      foreignField: 'userId',
      pipeline: [
        { $sort: { _id: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ],
      as: 'posts',
    },
  },
  // Stage 3: Exclude passwordHash from output
  {
    $project: {
      passwordHash: 0,
    },
  },
]);
```

---

## 🌱 6. LIVE INTERVIEW DEMO SEEDER (`bun run seed`)

Because the submission email states *"ensure that your computer is in good working condition and is capable of running the project in a local development environment during the interview session"*, `careguide-backend/src/seed.ts` **must** be implemented so running `bun run seed` resets and populates deterministic demo data in under 1 second:

1. **Demo Credentials (Displayed on Frontend Login Screen for Reviewer Convenience):**
   * **Admin Account:** `admin@careguide.bd` / `Admin@123` (Role: `admin`, Interests: `['architecture', 'chess', 'reading']`)
   * **User 1 Account:** `nazrul@careguide.bd` / `User@123` (Role: `user`, Interests: `['chess', 'coding', 'motorcycles']`)
   * **User 2 Account:** `rahim@careguide.bd` / `User@123` (Role: `user`, Interests: `['reading', 'coding', 'photography']`)
   * **User 3 Account:** `karim@careguide.bd` / `User@123` (Role: `user`, Interests: `['chess', 'reading', 'travel']`)
2. **Pre-Populated Collections:**
   * **15 Private Notes** distributed across Admin, User 1, User 2, and User 3 (so pagination and RBAC isolation are immediately visible).
   * **12 Public Posts** distributed across users (so Scenario 2 `$lookup` immediately returns rich data when clicking any user in the UI).
   * **Index Sync Verification:** `seed.ts` must call `await mongoose.connection.syncIndexes()` and log the active indexes for `users`, `notes`, and `posts` to the console so you can show the interviewer in real time that only the exact required indexes exist.

---

## 🚫 7. UNIVERSAL ANTI-SLOP & NEGATIVE CONSTRAINTS CHECKLIST

Before completing any prompt, the agent must verify all items below pass:

- [ ] **Zero Unsolicited Test Files:** Are there any `*.test.ts`, `*.spec.ts`, `vitest.config.ts`, or mock fixture files? If yes, **delete them immediately**.
- [ ] **Zero Inline Schema Indexes:** Are there any `unique: true` or `index: true` properties inside Mongoose field definitions? If yes, remove them and use explicit `schema.index()` calls with justification comments.
- [ ] **Exactly 4 Custom Indexes:** Verify `User` has 2 (`{ email: 1 }`, `{ interests: 1 }`), `Note` has 1 (`{ userId: 1, _id: -1 }`), and `Post` has 1 (`{ userId: 1, _id: -1 }`). No extra `createdAt` or redundant single-field indexes exist.
- [ ] **Dual-Repo Sync Verified:** Did any backend change get synced to `careguide-frontend/src/types/` and updated in the SolidJS UI?
- [ ] **Zero React or Solid 1.x Hallucinations:** Confirm `careguide-frontend` uses pure SolidJS v2 semantics (no prop destructuring, no React hooks).
- [ ] **Zero Placeholder Code:** No `// TODO`, no unimplemented buttons, no fake static arrays in the frontend—every view talks to the real Hono + MongoDB backend.
