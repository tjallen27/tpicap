# ADR 001 — Frontend Framework: Vite over Next.js

## Status

Accepted

## Context

The assessment requires a React + TypeScript frontend. Next.js is the conventional default for new React applications, but it is primarily designed around server-side rendering, server components, and hybrid rendering strategies.

This application is a trade blotter — a client-side, data-intensive dashboard. It has no pages that benefit from server rendering:

- All trade data is fetched from the backend API at runtime
- Real-time updates are delivered via WebSockets or SSE directly to the browser
- There is no public-facing content, SEO requirement, or static generation use case
- All interactions (create, amend, cancel) are driven by authenticated client state

Using Next.js in this context would mean opting every route and component out of its default rendering model (via `"use client"`) throughout the entire application, gaining none of its benefits while inheriting its conventions and build complexity.

## Decision

Use **Vite** as the build tool and dev server, with **React + TypeScript** as the application layer.

| Field | Detail |
|---|---|
| Name | Vite |
| Package | `vite` |
| Reason | Lightweight, fast build tool purpose-built for client-only SPAs — no server rendering overhead or Next.js conventions to work around |

| Field | Detail |
|---|---|
| Name | React |
| Package | `react`, `react-dom` |
| Reason | Required by the assessment |

| Field | Detail |
|---|---|
| Name | TypeScript plugin for Vite |
| Package | `@vitejs/plugin-react` |
| Reason | Official Vite plugin for React — enables JSX transform and Fast Refresh |

## Consequences

- The frontend is a plain SPA served as static assets. Routing is handled client-side (via a router library — to be decided separately).
- No server components, no API routes in the frontend layer. All data access goes through the backend API.
- Build output is a static `dist/` directory, straightforward to serve via Docker or any static host.
- Removes the need to annotate components with `"use client"` throughout the codebase.
