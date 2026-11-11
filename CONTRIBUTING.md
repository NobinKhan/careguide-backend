# Contributing to Care Guide BD Backend

Thank you for contributing to `careguide-backend`.

## Local Development Setup

Follow the [Quick Start guide in README.md](./README.md#quick-start-local-development):

1. Copy `.env.example` to `.env` and set a strong `JWT_SECRET` (at least 32 characters).
2. Install dependencies: `bun install`
3. Seed demo data: `bun run seed`
4. Start the development server: `bun run dev`

## Project Guardrails (`AGENTS.md`)

Before submitting changes, ensure you follow the architectural constraints in [`AGENTS.md`](./AGENTS.md):

- **Typecheck:** Always run `bun run typecheck` and ensure zero TypeScript errors.
- **MongoDB Indexes:** Do not add unnecessary indexes or inline `index: true` / `unique: true` field options. Keep strictly the 4 explicit `schema.index()` definitions across `User`, `Note`, and `Post`.
- **No Test Files:** Per `AGENTS.md`, do not add `*.test.ts` or `*.spec.ts` files.
- **Native Runtime:** Use Bun native APIs (`Bun.password`) and Hono built-in middleware (`hono/jwt`, `hono/cors`, `hono/secure-headers`, `hono/body-limit`).

## Opening an Issue or Pull Request

- Use the bug report template in `.github/ISSUE_TEMPLATE/bug_report.md` when reporting issues.
- Complete the checklist in `.github/PULL_REQUEST_TEMPLATE.md` when opening a pull request.
