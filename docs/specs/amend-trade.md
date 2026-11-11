# Spec: Amend Trade

## Requirements

- A user can amend mutable fields on any trade with `status: "ACTIVE"`
- Cancelled trades cannot be amended
- Only a defined subset of fields may be changed — server-managed and immutable fields are protected
- The backend validates the trade exists, is eligible for amendment, and that the payload is valid
- On success, the updated trade is broadcast to all connected clients via WebSocket
- The amending client's blotter reflects the change without a page refresh

## Functionality

### Amendable Fields

Only the following fields may be changed via an amend request:

| Field | Notes |
|---|---|
| `quantity` | Must remain a positive integer |
| `price` | Must remain a positive number |
| `trader` | Must remain non-empty |
| `book` | Must remain non-empty |
| `counterparty` | Must remain non-empty |

The following fields are **immutable** and cannot be changed after a trade is created:

- `id`
- `symbol`
- `side`
- `tradeTimestamp`
- `status` — managed via the cancel endpoint, not via amend

### Frontend

Each row in the blotter exposes an "Amend" action. The action is only rendered for trades with `status: "ACTIVE"`.

On click, an amend form opens pre-populated with the trade's current values. The user edits one or more fields and submits.

The form validates against `AmendTradeSchema` (from `shared/`) on submit. Invalid fields display inline error messages. The form does not submit if validation fails or if no fields have changed from the current values.

On success, the form closes and the updated trade is reflected in the blotter.

### Backend

`PATCH /trades/:id`

1. Look up the trade by `id` in MongoDB
2. If not found, return `404 Not Found`
3. If `status` is `CANCELLED`, return `409 Conflict` — cancelled trades cannot be amended
4. Parse and validate the request body against `AmendTradeSchema`
5. If validation fails, return `400 Bad Request` with a structured `issues` array
6. If the payload contains any immutable fields (`id`, `symbol`, `side`, `tradeTimestamp`, `status`), return `400 Bad Request`
7. Apply the changes to the trade document in MongoDB
8. Broadcast a `trade:amended` WebSocket event to all connected clients with the full updated trade payload
9. Return `200 OK` with the updated trade

### WebSocket Event

```typescript
{
  event: "trade:amended",
  payload: Trade  // full trade object with updated fields
}
```

The frontend replaces the matching trade in the TanStack Query cache via `setQueryData`, matched by `id`. See [ADR 003](../decisions/003-data-fetching-tanstack-query-websockets.md).

## Error Boundaries

### Validation Errors (Frontend)

Zod parses the form values against `AmendTradeSchema` before the request is dispatched. Errors are surfaced inline per field. The request is never sent if validation fails.

An additional client-side check prevents submission if the form values are identical to the current trade values — there is nothing to amend.

### Validation Errors (Backend)

The backend parses the request body with `AmendTradeSchema`. If parsing fails, it returns `400 Bad Request` with a structured error body:

```typescript
{
  error: "Validation failed",
  issues: ZodIssue[]
}
```

If the payload contains immutable fields, it returns:

```typescript
{
  error: "Invalid fields",
  fields: string[]  // list of field names that cannot be amended
}
```

### Business Rule Violations (Backend)

| Condition | Response |
|---|---|
| Trade not found | `404 Not Found` |
| Trade is cancelled | `409 Conflict` with message `"Cancelled trades cannot be amended"` |

### Stale UI State (Frontend)

A user may attempt to amend a trade that another client has since cancelled. When the backend returns `409`, the frontend:

1. Displays a non-blocking error notification (`"This trade has been cancelled and cannot be amended"`)
2. Invalidates the trades query to reconcile the stale cache
3. Closes the amend form

### Network / Server Errors

If the `PATCH` request fails (network error, `5xx` response), the frontend displays an error notification. The amend form remains open with the entered values intact so the user can retry.

### React Error Boundary

A React error boundary wraps the amend form component. If the component throws during render, the boundary catches it and renders a fallback with an option to dismiss and reset. This prevents a form error from crashing the blotter.

```
<ErrorBoundary fallback={<FormErrorFallback />}>
  <AmendTradeForm />
</ErrorBoundary>
```

## Expected Outcomes

- An amended trade has its updated fields persisted in MongoDB; all other fields are unchanged
- The update is reflected in the blotter of all connected clients within one WebSocket round-trip
- Immutable fields cannot be changed regardless of what the client sends
- A cancelled trade returns a clear error and cannot be amended
- A failed amendment does not alter the trade's displayed values

## Dependencies and Blockers

- **Blocked by:** [data-model.md](data-model.md) — `AmendTradeSchema` must be exported from `shared/`
- **Blocked by:** WebSocket infrastructure being in place on both backend and frontend
- **Blocked by:** Blotter table rendering trades — the Amend action lives on a blotter row
- **Requires:** TanStack Query mutation setup ([ADR 003](../decisions/003-data-fetching-tanstack-query-websockets.md))

## Acceptance Criteria

- [ ] The "Amend" action is only visible on trades with `status: "ACTIVE"`
- [ ] The amend form opens pre-populated with the trade's current values
- [ ] Submitting with no changes does not dispatch a request
- [ ] Submitting `quantity: 0` or `price: -1` shows inline validation errors and does not dispatch a request
- [ ] A valid submission calls `PATCH /trades/:id` exactly once with only the changed fields
- [ ] The backend rejects payloads containing immutable fields with `400`
- [ ] The backend rejects amendments to a cancelled trade with `409`
- [ ] A `200` response closes the form and updates the trade in the blotter for all connected clients
- [ ] A `404` response shows an error notification
- [ ] A `409` response shows a notification, reconciles the cache, and closes the form
- [ ] A `500` or network failure shows an error notification and preserves form values

## Testing

### Unit Tests
- `AmendTradeSchema` — valid partial payload, empty object (no fields), invalid field values, presence of immutable fields
- Backend handler: returns `404` when trade ID does not exist
- Backend handler: returns `409` when trade is `CANCELLED`
- Backend handler: returns `400` when payload contains immutable fields
- Backend handler: applies partial update correctly and returns the full updated trade

### Integration Tests
- `PATCH /trades/:id` with a valid partial payload returns `200` with updated fields and unchanged fields preserved
- `PATCH /trades/:id` with `quantity: 0` returns `400`
- `PATCH /trades/:id` with `symbol` in the payload returns `400`
- `PATCH /trades/:id` on a non-existent trade returns `404`
- `PATCH /trades/:id` on a cancelled trade returns `409`
- `PATCH /trades/:id` broadcasts `trade:amended` to connected WebSocket clients

### Component Tests
- "Amend" action is not rendered for trades with `status: "CANCELLED"`
- Amend form opens pre-populated with current trade values
- Submit button is disabled when form values match the current trade
- Inline errors render when Zod validation fails
- Error notification renders on `409` response and form closes
- Error notification renders on `500` / network failure and form values are preserved
- Updated trade values appear in the blotter after a successful amendment
