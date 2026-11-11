# ADR 003 — Data Fetching: TanStack Query with WebSocket Cache Updates

## Status

Accepted

## Context

The blotter needs to display a live list of trades that reflects changes made by any connected client without a page refresh. This requires two concerns to be solved together:

1. **Initial and on-demand data fetching** — loading the trade list from the backend REST API
2. **Real-time updates** — applying changes pushed by the backend over WebSockets

TanStack Query is the standard for server-state management in React applications. It handles caching, background refetching, loading and error states, and provides a clean separation between server state and UI state.

WebSocket events arrive from the backend whenever a trade is created, amended, or cancelled. When an event arrives, the frontend cache must reflect the change. There are two ways to do this:

### Option A — Invalidate the Query

When a WebSocket event arrives, call `queryClient.invalidateQueries()` for the trades query. TanStack Query marks the cache as stale and immediately triggers a fresh `GET /trades` request.

**Pros:**
- Simple to implement — one line per event type
- Cache is always reconciled against the server's full state
- Handles any edge cases where the WebSocket payload and server state could diverge

**Cons:**
- Adds a round-trip on every event — the client fetches data it has just been told about
- Under high trade volume, this generates unnecessary API requests
- Causes a loading state flicker if the query is treated as loading during the refetch

### Option B — Update the Cache Directly with `setQueryData`

When a WebSocket event arrives, apply the change directly to the cached trade list using `queryClient.setQueryData()`. The event payload contains the full updated trade, so no additional fetch is needed.

**Pros:**
- Zero additional round-trips — the WebSocket payload is the update
- Instant reflection of changes with no loading state
- Lower backend load under high event volume
- Appropriate for a blotter where low latency and smooth updates matter

**Cons:**
- Requires the WebSocket payload to carry enough data to update the cache correctly (full trade object, not just an ID)
- Cache can theoretically drift from server state if an event is missed — mitigated by an initial full fetch on connect/reconnect

## Decision

Use **Option B — `setQueryData`** as the primary strategy.

The backend WebSocket events will carry the full trade payload. The frontend will apply changes directly to the TanStack Query cache:

- **Trade created** → append the new trade to the cached list
- **Trade amended** → replace the matching trade in the cached list by `id`
- **Trade cancelled** → update the matching trade's `status` field in the cached list

On WebSocket reconnect, the trades query will be invalidated once to reconcile any missed events during the disconnection window.

### Dependencies

| Field | Detail |
|---|---|
| Name | TanStack Query |
| Package | `@tanstack/react-query` |
| Reason | Server-state management for React — caching, background sync, loading/error states |

| Field | Detail |
|---|---|
| Name | TanStack Query DevTools |
| Package | `@tanstack/react-query-devtools` |
| Reason | Dev-only cache inspector — useful for verifying WebSocket cache updates behave correctly |

## Consequences

- WebSocket event payloads must include the full trade object, not just an ID or diff. The backend must be designed accordingly.
- The frontend WebSocket handler is the single place responsible for all cache mutations triggered by real-time events.
- If a WebSocket connection drops and reconnects, one query invalidation brings the cache back in sync — after that, `setQueryData` resumes.
- TanStack Query's REST fetching and the WebSocket layer are complementary: Query owns the initial load and reconnect reconciliation; WebSockets own the live delta updates.
