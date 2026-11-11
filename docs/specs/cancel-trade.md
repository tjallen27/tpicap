# Spec: Cancel Trade

## Requirements

- A user can cancel any trade with `status: "ACTIVE"` from the blotter
- Cancellation is a status transition only — no fields other than `status` are modified
- The backend validates the trade exists and is eligible for cancellation
- On success, the updated trade is broadcast to all connected clients via WebSocket
- Cancelled trades remain visible in the blotter with their status reflected

## Functionality

### Frontend

Each row in the blotter exposes a "Cancel" action. The action is only rendered for trades with `status: "ACTIVE"`.

On click, a confirmation prompt is shown before the request is dispatched. This prevents accidental cancellations.

On success, the trade's status updates to `CANCELLED` in the blotter in real time. No page refresh is required.

### Backend

`PATCH /trades/:id/cancel`

1. Look up the trade by `id` in MongoDB
2. If not found, return `404 Not Found`
3. If `status` is already `CANCELLED`, return `409 Conflict`
4. Set `status` to `CANCELLED`
5. Persist the change to MongoDB
6. Broadcast a `trade:cancelled` WebSocket event to all connected clients with the full updated trade payload
7. Return `200 OK` with the updated trade

### WebSocket Event

```typescript
{
  event: "trade:cancelled",
  payload: Trade  // full trade object with status: "CANCELLED"
}
```

The frontend updates the matching trade in the TanStack Query cache directly via `setQueryData`, replacing the entry by `id`. See [ADR 003](../decisions/003-data-fetching-tanstack-query-websockets.md).

## Error Boundaries

### Business Rule Violations (Backend)

| Condition | Response |
|---|---|
| Trade not found | `404 Not Found` |
| Trade already cancelled | `409 Conflict` with message `"Trade is already cancelled"` |

### Stale UI State (Frontend)

A user may attempt to cancel a trade that another client has already cancelled. When the backend returns `409`, the frontend:

1. Displays a non-blocking error notification (`"This trade has already been cancelled"`)
2. Invalidates the trades query to reconcile the stale cache

This ensures the UI corrects itself after a conflict without requiring a manual refresh.

### Network / Server Errors

If the `PATCH` request fails (network error, `5xx` response), the frontend displays an error notification. The trade's status in the blotter is not changed — the UI reflects only confirmed server state.

TanStack Query's mutation `onError` callback handles this. The optimistic update strategy is intentionally **not** used here — a failed cancellation must not visually mark a trade as cancelled.

### React Error Boundary

A React error boundary wraps the blotter row actions. If the action component throws during render, the boundary catches it and renders a safe fallback, preventing a row-level error from crashing the blotter table.

## Expected Outcomes

- A cancelled trade has `status: "CANCELLED"` persisted in MongoDB
- The status change is reflected in the blotter of all connected clients within one WebSocket round-trip
- A trade that is already cancelled cannot be cancelled again
- A failed cancellation request does not alter the trade's displayed status
- Cancelled trades remain visible in the blotter (they are not removed)

## Dependencies and Blockers

- **Blocked by:** [data-model.md](data-model.md) — `Trade` type must be available from `shared/`
- **Blocked by:** WebSocket infrastructure being in place on both backend and frontend
- **Blocked by:** Blotter table rendering trades — the Cancel action lives on a blotter row
- **Requires:** TanStack Query mutation setup ([ADR 003](../decisions/003-data-fetching-tanstack-query-websockets.md))

## Acceptance Criteria

- [ ] The "Cancel" action is only visible on trades with `status: "ACTIVE"`
- [ ] Clicking "Cancel" shows a confirmation step before dispatching the request
- [ ] A confirmed cancellation calls `PATCH /trades/:id/cancel` exactly once
- [ ] A `200` response updates the trade status to `CANCELLED` in the blotter for all connected clients
- [ ] A `404` response shows an error notification
- [ ] A `409` response shows a notification and triggers a cache reconciliation
- [ ] A `500` or network failure shows an error notification and does not change the displayed status
- [ ] No optimistic update is applied — the UI only reflects confirmed server state

## Testing

### Unit Tests
- Backend handler: returns `404` when trade ID does not exist
- Backend handler: returns `409` when trade is already `CANCELLED`
- Backend handler: transitions `ACTIVE` → `CANCELLED` and returns the updated trade

### Integration Tests
- `PATCH /trades/:id/cancel` on an active trade returns `200` with `status: "CANCELLED"`
- `PATCH /trades/:id/cancel` on a non-existent trade returns `404`
- `PATCH /trades/:id/cancel` on a cancelled trade returns `409`
- `PATCH /trades/:id/cancel` broadcasts `trade:cancelled` to connected WebSocket clients

### Component Tests
- "Cancel" action is not rendered for trades with `status: "CANCELLED"`
- Confirmation prompt appears before submission
- Dismissing the confirmation prompt does not dispatch the request
- Error notification renders on `409` response
- Error notification renders on `500` / network failure
- Trade status does not change in the UI on a failed request
