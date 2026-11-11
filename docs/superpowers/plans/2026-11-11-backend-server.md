# Backend Server — Implementation Plan Index

**Goal:** Build the Fastify backend that persists trades in MongoDB, serves CRUD endpoints, broadcasts real-time events over WebSocket, integrates Finnhub for live market prices (with a price simulator fallback), and seeds the database with 100 realistic trades on first run.

This plan is split into 13 self-contained task files. Each file contains the full Global Constraints section, its own Review Focus items, and all step content needed to implement that task in isolation.

---

## Task Files

| # | File | Description |
|---|------|-------------|
| 1 | [2026-11-11-backend-01-monorepo-shared-package.md](2026-11-11-backend-01-monorepo-shared-package.md) | Scaffold pnpm workspace and create the `@tpicap/shared` package with all Zod schemas and inferred types |
| 2 | [2026-11-11-backend-02-backend-scaffold.md](2026-11-11-backend-02-backend-scaffold.md) | Create the `@tpicap/backend` package with config parser, MongoDB client, Fastify factory, and test infrastructure |
| 3 | [2026-11-11-backend-03-trade-db-queries.md](2026-11-11-backend-03-trade-db-queries.md) | Implement all MongoDB query functions: find all, find by ID, insert, patch, and atomic cancel |
| 4 | [2026-11-11-backend-04-seed-data.md](2026-11-11-backend-04-seed-data.md) | Implement the seed generator producing 100 realistic trades and an idempotent `seedIfEmpty()` |
| 5 | [2026-11-11-backend-05-get-trades-endpoint.md](2026-11-11-backend-05-get-trades-endpoint.md) | Implement `GET /trades` returning all trades sorted by timestamp descending |
| 6 | [2026-11-11-backend-06-websocket-manager.md](2026-11-11-backend-06-websocket-manager.md) | Implement the WebSocket client manager (add/remove/broadcast) and the `/ws` Fastify plugin |
| 7 | [2026-11-11-backend-07-post-trades-endpoint.md](2026-11-11-backend-07-post-trades-endpoint.md) | Implement `POST /trades` with Zod validation, trade ID generation, persistence, and broadcast |
| 8 | [2026-11-11-backend-08-patch-amend-endpoint.md](2026-11-11-backend-08-patch-amend-endpoint.md) | Implement `PATCH /trades/:id` with immutable field guard, cancelled-trade check, and broadcast |
| 9 | [2026-11-11-backend-09-patch-cancel-endpoint.md](2026-11-11-backend-09-patch-cancel-endpoint.md) | Implement `PATCH /trades/:id/cancel` with atomic status transition and concurrent-cancel safety |
| 10 | [2026-11-11-backend-10-price-simulator.md](2026-11-11-backend-10-price-simulator.md) | Extract `BASE_PRICES` to `symbolPool.ts` and implement `PriceSimulator` with zero-floor guard |
| 11 | [2026-11-11-backend-11-finnhub-client.md](2026-11-11-backend-11-finnhub-client.md) | Implement `fetchFinnhubPrices()` with per-symbol error isolation using `Promise.allSettled` |
| 12 | [2026-11-11-backend-12-price-service.md](2026-11-11-backend-12-price-service.md) | Implement `startPriceService()` — the 3-second broadcast interval with Finnhub/simulator orchestration |
| 13 | [2026-11-11-backend-13-entry-point-wiring.md](2026-11-11-backend-13-entry-point-wiring.md) | Wire all modules into the production entry point `backend/src/index.ts` |
