# Spec: Live Updates via WebSocket

## Requirements

- The frontend maintains a persistent WebSocket connection to the backend for the lifetime of the session
- Trade mutations (create, amend, cancel) broadcast events to all connected clients
- The frontend handles each event type and updates the blotter without a page refresh
- Connection failures are surfaced to the user with a visible status indicator
- The frontend attempts to reconnect automatically after a disconnection
- On reconnect, the trade list is reconciled against the server to recover any missed events
- Distinct fallback states are rendered when data is unavailable — loading, error, and empty are handled separately

## Functionality

### Backend — WebSocket Server

The backend runs a WebSocket server alongside the HTTP API. On connection:

1. Accept the connection and register the client
2. On disconnection, deregister the client

The server does not send an initial snapshot over WebSocket. The client fetches the initial trade list via `GET /trades` (HTTP). WebSocket is used exclusively for delta events after the initial load.

#### Outbound Events (server → client)

| Event | Trigger | Payload |
|---|---|---|
| `trade:created` | A trade is successfully persisted via `POST /trades` | Full `Trade` object |
| `trade:amended` | A trade is successfully updated via `PATCH /trades/:id` | Full `Trade` object |
| `trade:cancelled` | A trade is successfully cancelled via `PATCH /trades/:id/cancel` | Full `Trade` object |

All events broadcast to **all** connected clients, including the originating client.

#### Inbound Events (client → server)

The client does not send application-level messages over WebSocket in this version. The connection is effectively unidirectional for trade events.

### Frontend — WebSocket Client

A single WebSocket connection is established when the application mounts. It is managed outside of the component tree (e.g. a custom hook or a context provider) so it persists across route changes and re-renders.

#### Connection Lifecycle

```
mount → connect → [connected]
                      │
              event received → update cache via setQueryData
                      │
              connection lost → show "Disconnected" status indicator
                                → begin reconnect with exponential backoff
                                → on reconnect: invalidate trades query once
                                             → resume setQueryData on events
```

#### Reconnect Strategy

Reconnection uses exponential backoff with jitter to avoid thundering herd on backend restart:

| Attempt | Delay |
|---|---|
| 1 | 1s |
| 2 | 2s |
| 3 | 4s |
| 4+ | 8s (capped) |

After a successful reconnect, the trades query is invalidated once to fetch the full current state and recover any events missed during the disconnection window. Once the fresh data is loaded, subsequent updates resume via `setQueryData`.

#### Cache Update Handlers

See [ADR 003](../decisions/003-data-fetching-tanstack-query-websockets.md) for the rationale on `setQueryData` over query invalidation.

```typescript
trade:created  → queryClient.setQueryData(["trades"], (prev) => [...prev, payload])
trade:amended  → queryClient.setQueryData(["trades"], (prev) => prev.map(t => t.id === payload.id ? payload : t))
trade:cancelled → queryClient.setQueryData(["trades"], (prev) => prev.map(t => t.id === payload.id ? payload : t))
```

## Connection Status Indicator

A persistent status indicator is displayed in the UI to reflect the current WebSocket connection state.

| State | Indicator |
|---|---|
| Connected | Green — "Live" |
| Connecting / Reconnecting | Amber — "Reconnecting…" |
| Disconnected (retries exhausted) | Red — "Disconnected" with a manual "Retry" button |

This indicator is always visible while the blotter is open. Users should know at a glance whether the data they are viewing is live.

## Fallback States

The blotter must handle three distinct states when data is unavailable. These are separate conditions and must not be conflated.

### 1. Loading (Initial Fetch In Progress)

The `GET /trades` request has been dispatched but has not yet resolved. The WebSocket connection may or may not be established yet.

- Render a loading skeleton in place of the trade table
- Do not render an empty state or error message during this window

### 2. Fetch Error (API Request Failed)

The `GET /trades` request returned an error response or failed due to a network issue.

- Render an error state in place of the trade table
- Display a message: `"Failed to load trades"`
- Provide a "Retry" button that re-triggers the query
- Do not render a loading skeleton or empty state

### 3. Empty State (Fetch Succeeded, No Trades Returned)

The `GET /trades` request returned `200 OK` with an empty array. This should not occur in practice if seed data is generated on startup, but it must be handled.

- Render an empty state message: `"No trades found"`
- Do not render a loading skeleton or error message

### Fallback Hierarchy

```
isFetching (first load) → <LoadingSkeleton />
isError                 → <FetchError onRetry={refetch} />
data.length === 0       → <EmptyState />
data.length > 0         → <TradeBlotter trades={data} />
```

A React error boundary wraps the entire blotter region. If the blotter component throws during render (distinct from a fetch failure), the boundary catches it and renders a recovery fallback.

## Error Messages

| Condition | Message | Treatment |
|---|---|---|
| Initial fetch failed | "Failed to load trades" | Inline error state with retry button |
| WebSocket disconnected | "Disconnected — trying to reconnect" | Status indicator, amber |
| WebSocket reconnect failed (retries exhausted) | "Connection lost. Click to retry." | Status indicator, red with manual retry |
| Missed events on reconnect (reconciling) | "Syncing…" | Brief status indicator while invalidated query refetches |

Errors are not thrown to the console in production. All expected failure modes are caught and surfaced through the UI.

## Dependencies and Blockers

- **Blocked by:** [data-model.md](data-model.md) — `Trade` type required for typed cache updates
- **Blocked by:** [create-trade.md](create-trade.md), [amend-trade.md](amend-trade.md), [cancel-trade.md](cancel-trade.md) — backend must broadcast events from each mutation endpoint
- **Requires:** TanStack Query configured with a `QueryClient` accessible to the WebSocket event handlers ([ADR 003](../decisions/003-data-fetching-tanstack-query-websockets.md))

## Acceptance Criteria

- [ ] A WebSocket connection is established on application mount
- [ ] A trade created by one client appears in the blotter of all other connected clients without a page refresh
- [ ] A trade amended by one client is updated in the blotter of all other connected clients without a page refresh
- [ ] A trade cancelled by one client is updated in the blotter of all other connected clients without a page refresh
- [ ] The connection status indicator shows "Live" when connected
- [ ] The connection status indicator shows "Reconnecting…" during reconnect attempts
- [ ] The connection status indicator shows "Disconnected" after retries are exhausted, with a manual retry button
- [ ] On reconnect, the trade list is reconciled with the server before resuming live updates
- [ ] A loading skeleton is shown during the initial fetch
- [ ] An error state with a retry button is shown if the initial fetch fails
- [ ] An empty state message is shown if the fetch succeeds but returns no trades
- [ ] The blotter renders correctly once data loads after a failed-then-recovered fetch

## Testing

### Unit Tests
- Cache update logic for each event type (`trade:created`, `trade:amended`, `trade:cancelled`) — correct item added, replaced, or updated
- Reconnect backoff timing — correct delays for attempts 1–4+
- Fallback state logic — correct component rendered for each of: loading, error, empty, populated

### Integration Tests
- WebSocket connection is accepted by the backend on connect
- `POST /trades` broadcasts `trade:created` to all connected clients
- `PATCH /trades/:id` broadcasts `trade:amended` to all connected clients
- `PATCH /trades/:id/cancel` broadcasts `trade:cancelled` to all connected clients
- Disconnecting and reconnecting a client triggers a query reconciliation

### Component Tests
- Status indicator renders "Live" when WebSocket `readyState` is `OPEN`
- Status indicator renders "Reconnecting…" when attempting to reconnect
- Status indicator renders "Disconnected" with retry button after retries exhausted
- `<LoadingSkeleton />` renders when `isFetching` is true and no cached data exists
- `<FetchError />` renders when `isError` is true; retry button triggers `refetch`
- `<EmptyState />` renders when fetch succeeds with an empty array
- `<TradeBlotter />` renders when fetch succeeds with trade data
