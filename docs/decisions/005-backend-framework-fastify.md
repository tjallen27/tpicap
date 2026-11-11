# ADR 005 — Backend Framework: Fastify

## Status

Accepted

## Context

The assessment requires a TypeScript backend API. The framework choice affects developer ergonomics, type safety, performance, and how naturally the API integrates with the rest of the stack.

The primary requirements are:

- TypeScript support without excessive boilerplate
- Straightforward JSON schema / request validation
- Adequate performance for a real-time trade blotter
- An active ecosystem with good plugin support (WebSockets, CORS, etc.)
- Low operational overhead for a single-service backend

Candidates considered:

| Framework | Notes |
|---|---|
| **Fastify** | First-class TypeScript support, schema-based validation via JSON Schema, strong performance benchmarks, rich plugin ecosystem |
| Express | Ubiquitous but minimal — TypeScript support is bolted on via `@types/express`; no built-in validation; middleware model is loosely typed |
| NestJS | Full-featured but heavyweight; introduces Angular-style decorators and abstractions that add complexity disproportionate to this project's scope |
| Hono | Lightweight and TypeScript-native, but ecosystem is smaller and WebSocket support is less mature |

Express is the most familiar choice but requires significant additional wiring (validation library, typed middleware, etc.) to reach the same level of type safety that Fastify provides out of the box. NestJS is well-suited to large enterprise APIs but is overkill for an assessment project of this scope.

## Decision

Use **Fastify** as the backend HTTP framework.

| Field | Detail |
|---|---|
| Name | Fastify |
| Package | `fastify` |
| Reason | First-class TypeScript support, built-in schema validation, high performance, and a plugin model that covers WebSockets and CORS without ceremony |

| Field | Detail |
|---|---|
| Name | Fastify WebSocket plugin |
| Package | `@fastify/websocket` |
| Reason | Official Fastify plugin for WebSocket support — required for real-time trade updates |

| Field | Detail |
|---|---|
| Name | Fastify CORS plugin |
| Package | `@fastify/cors` |
| Reason | Official Fastify plugin for configuring cross-origin resource sharing between the frontend and backend |

## Consequences

- Route handlers are typed via Fastify's generic schema inference — request bodies, params, and responses can be strongly typed without manual casting.
- JSON Schema is used for input validation at the route level, keeping validation co-located with the route definition rather than scattered across middleware.
- The plugin model keeps concerns (WebSockets, CORS, database) modular and testable in isolation.
- Express muscle memory does not apply — contributors unfamiliar with Fastify will need to consult its documentation for plugin registration and schema patterns.
