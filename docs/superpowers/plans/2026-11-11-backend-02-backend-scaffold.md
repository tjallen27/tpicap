# Backend: Backend Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `@tpicap/backend` package with its dependency manifest, TypeScript config, environment config parser, MongoDB client, Fastify factory, and test infrastructure (in-memory MongoDB setup and test app helper).

**Architecture:** `parseConfig()` reads environment variables and returns a typed `Config` object. `connectDb(uri)` establishes a MongoDB connection stored in module scope; `getDb()` retrieves it. `createApp()` constructs a Fastify instance without calling `listen`. The test setup file starts `mongodb-memory-server` in `beforeAll` and stops it in `afterAll`; `buildTestApp()` in `helpers.ts` wires the app for handler tests.

**Tech Stack:** Fastify, MongoDB Node.js driver, TypeScript, tsx, Vitest, mongodb-memory-server, @types/node

**Specs:**
- `docs/specs/data-model.md`

**Dependencies:**
- `2026-11-11-backend-01-monorepo-shared-package.md` (workspace must exist before backend package can reference it)

## Global Constraints

- Trade ID format: `TRD-` followed by 6 digits (e.g. `TRD-100001`); seed trades are sequential from `TRD-100001`; user-created trades use `TRD-${Math.floor(100000 + Math.random() * 900000)}`
- `tradeTimestamp` is always UTC ISO 8601 (e.g. `2026-11-11T09:15:23.000Z`)
- `quantity` must be a positive integer; `price` must be a positive number; `symbol` is 1–10 chars
- Seed dataset: exactly 100 trades across the 10 symbols in `BASE_PRICES`
- Seed execution price formula: `parseFloat((basePrice * (1 + (Math.random() * 0.08 - 0.04))).toFixed(2))`
- Simulator drift formula per tick: `parseFloat((currentPrice + currentPrice * (Math.random() * 0.01 - 0.005)).toFixed(2))`; if result ≤ 0, discard drift and keep current price unchanged
- Price update interval: `3000` ms
- Immutable fields rejected on `PATCH /trades/:id`: `id`, `symbol`, `side`, `tradeTimestamp`, `status`
- `GET /trades` returns `{ trades: Trade[] }` sorted by `tradeTimestamp` descending
- `POST /trades` returns `201`; all `PATCH` endpoints return `200`
- Cancel: `404` if trade not found, `409` if already `CANCELLED`
- Amend: `404` if trade not found, `409` if trade is `CANCELLED`, `400` if immutable field present
- Validation errors return `{ error: "Validation failed", issues: ZodIssue[] }`
- Immutable field errors return `{ error: "Invalid fields", fields: string[] }`
- `FINNHUB_API_KEY` env var is optional; if absent, skip Finnhub and start simulator directly

## Review Focus

No unexercised failure modes identified for this task.

---

### Task 2: Backend Scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/config.ts`
- Create: `backend/src/db/client.ts`
- Create: `backend/src/server.ts`
- Create: `backend/tests/setup.ts`
- Create: `backend/tests/helpers.ts`

**Interfaces:**
- Consumes: nothing yet
- Produces:
  - `parseConfig(): Config` where `Config = { port: number, mongodbUri: string, finnhubApiKey: string | undefined }`
  - `connectDb(uri: string): Promise<Db>`
  - `getDb(): Db`
  - `createApp(): FastifyInstance`

- [ ] **Step 1: Create `backend/package.json`**

  `name: "@tpicap/backend"`. Scripts: `dev: tsx watch src/index.ts`, `build: tsc`, `test: vitest run`. Dependencies: `fastify`, `@fastify/websocket`, `mongodb`, `finnhub`, `zod`, `@tpicap/shared: "workspace:*"`. DevDependencies: `typescript`, `tsx`, `vitest`, `mongodb-memory-server`, `@types/node`.

- [ ] **Step 2: Create `backend/tsconfig.json`**

  `moduleResolution: bundler`, `target: ES2022`, `strict: true`, `outDir: dist`.

- [ ] **Step 3: Write failing test for `parseConfig`**

  ```typescript
  // backend/tests/config.test.ts (inline in helpers or separate)
  it('reads PORT, MONGODB_URI, FINNHUB_API_KEY from env', () => {
    process.env.PORT = '4000'
    process.env.MONGODB_URI = 'mongodb://localhost/test'
    process.env.FINNHUB_API_KEY = 'key123'
    const config = parseConfig()
    expect(config.port).toBe(4000)
    expect(config.mongodbUri).toBe('mongodb://localhost/test')
    expect(config.finnhubApiKey).toBe('key123')
  })
  it('finnhubApiKey is undefined when env var is unset', () => {
    delete process.env.FINNHUB_API_KEY
    expect(parseConfig().finnhubApiKey).toBeUndefined()
  })
  ```

- [ ] **Step 4: Run test to confirm failure**

  Run: `pnpm --filter @tpicap/backend test -- tests/config.test.ts`
  Expected: FAIL — `parseConfig is not defined`

- [ ] **Step 5: Implement `parseConfig(): Config` in `backend/src/config.ts`**

  Reads `process.env.PORT` (default `3000`), `process.env.MONGODB_URI` (throws if absent), `process.env.FINNHUB_API_KEY` (optional, `undefined` if unset).

- [ ] **Step 6: Run test to confirm pass**

  Run: `pnpm --filter @tpicap/backend test -- tests/config.test.ts`
  Expected: PASS

- [ ] **Step 7: Implement `connectDb` and `getDb` in `backend/src/db/client.ts`**

  `connectDb(uri)` creates a `MongoClient`, connects, stores the `Db` instance in module scope. `getDb()` returns the stored instance; throws `"DB not connected"` if called before `connectDb`.

- [ ] **Step 8: Implement `createApp(): FastifyInstance` in `backend/src/server.ts`**

  Creates and returns a Fastify instance with `logger: false`. Does not call `app.listen()`.

- [ ] **Step 9: Create `backend/tests/setup.ts`**

  Uses `mongodb-memory-server` `MongoMemoryServer`. In `beforeAll`: starts the server, calls `connectDb(uri)`. In `afterAll`: stops the server. Export `getTestDb()` that returns the in-memory `Db`.

- [ ] **Step 10: Create `backend/tests/helpers.ts`**

  Exports `buildTestApp(): FastifyInstance` — calls `createApp()`, registers trade routes (once routes exist), returns the instance. Import and call in handler tests.

- [ ] **Step 11: Commit**

  ```bash
  git add backend/
  git commit -m "feat: add backend scaffold with config, MongoDB client, and Fastify factory"
  ```
