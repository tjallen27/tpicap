# ADR 002 — Database: MongoDB with Zod Schemas over Mongoose

## Status

Accepted

## Context

The assessment permits any database technology. The trade model is document-shaped — each trade is a self-contained record with no relational joins required. MongoDB is a natural fit.

The conventional pairing with MongoDB in a TypeScript project is Mongoose, which provides schema definition, validation, and ODM functionality. However, Mongoose schemas are Node.js-only constructs. They cannot be imported into the frontend, which means validation logic and type definitions would need to be duplicated — or diverge — across the two layers.

Because the frontend is a Vite SPA (see [ADR 001](001-frontend-framework-vite.md)), there are no API routes in the frontend layer. The backend is a separate service. This separation makes a shared package the right place to own the canonical data contracts for the whole system.

## Decision

### Database

Use **MongoDB** as the database.

| Field | Detail |
|---|---|
| Name | MongoDB Node.js Driver |
| Package | `mongodb` |
| Reason | Official driver for MongoDB — lightweight, no ODM overhead, works directly with Zod-validated types |

### Validation and Schema

Use **Zod** for all schema definition and validation instead of Mongoose.

| Field | Detail |
|---|---|
| Name | Zod |
| Package | `zod` |
| Reason | Framework-agnostic schema and validation library — schemas defined once in the shared package are importable by both the backend and the frontend |

### Shared Package

All schemas and TypeScript types live in a `shared/` package at the root of the monorepo. Both the backend and frontend import from it. This is the single source of truth for:

- Trade schema and type
- Request/response shapes
- Validation rules (e.g. quantity must be positive, price must be positive)
- Enums (e.g. `Side`, `Status`)

```
shared/
└── src/
    ├── schemas/
    │   └── trade.ts      # Zod schema + inferred TypeScript type
    └── index.ts          # Public exports
```

Zod's `z.infer<typeof Schema>` produces the TypeScript type directly from the schema, ensuring the runtime validation and the static type are always in sync.

### Separate Backend Service

Because Vite has no API routes, the backend runs as an independent service. The project structure reflects this:

```
frontend/    # Vite SPA
backend/     # TypeScript API server
shared/      # Zod schemas and types — imported by both
```

## Consequences

- Schema changes are made once in `shared/` and are immediately reflected in both layers.
- The frontend can use the same Zod schemas to validate form input before submission, using the same rules that the backend enforces on receipt.
- Mongoose is not used. MongoDB documents are typed via Zod-inferred types rather than Mongoose models.
- The monorepo requires a workspace setup (npm/pnpm workspaces) so that `frontend` and `backend` can both resolve the `shared` package locally.
- A separate backend service means two processes to run locally — addressed in the Docker setup.
