# Spec: Create Trade

## Requirements

- A user can submit a new trade via a form in the frontend
- The trade is validated on the frontend before submission
- The backend validates the payload independently before persisting
- On success, the new trade is broadcast to all connected clients via WebSocket
- The creating client's blotter updates without a full page refresh

## Functionality

### Frontend

A "New Trade" form collects the following fields from the user:

| Field | Input Type | Notes |
|---|---|---|
| `symbol` | Text | Uppercase, max 10 chars |
| `side` | Select | `BUY` or `SELL` |
| `quantity` | Number | Positive integer |
| `price` | Number | Positive decimal |
| `trader` | Text | |
| `book` | Text | |
| `counterparty` | Text | |

`id`, `tradeTimestamp`, and `status` are not collected from the user. The backend generates `id` and `tradeTimestamp`; `status` defaults to `ACTIVE`.

The form validates against `CreateTradeSchema` (from `shared/`) on submit. Invalid fields display inline error messages. The form does not submit while validation errors are present.

On successful submission the form closes/resets and the new trade appears in the blotter.

### Backend

`POST /trades`

1. Parse and validate the request body against `CreateTradeSchema`
2. Generate a unique `id` (`TRD-XXXXXX` format) and set `tradeTimestamp` to the current UTC time
3. Set `status` to `ACTIVE`
4. Persist the document to MongoDB
5. Broadcast a `trade:created` WebSocket event to all connected clients with the full trade payload
6. Return `201 Created` with the persisted trade

### WebSocket Event

```typescript
{
  event: "trade:created",
  payload: Trade  // full trade object
}
```

The frontend appends the received trade to the TanStack Query cache directly via `setQueryData`. See [ADR 003](../decisions/003-data-fetching-tanstack-query-websockets.md).

## Error Boundaries

### Validation Errors (Frontend)

Zod parses the form values against `CreateTradeSchema` before the request is dispatched. Errors are surfaced inline per field. The request is never sent if validation fails.

### Validation Errors (Backend)

The backend parses the request body with `CreateTradeSchema`. If parsing fails, it returns `400 Bad Request` with a structured error body:

```typescript
{
  error: "Validation failed",
  issues: ZodIssue[]  // one entry per failing field
}
```

This is a defence-in-depth layer — the frontend should have caught these first, but the backend does not trust the client.

### Network / Server Errors

If the `POST /trades` request fails (network error, `5xx` response), the frontend displays a non-blocking error notification to the user. The form remains open with the entered values intact so the user can retry.

TanStack Query's `onError` callback handles this — the mutation error state is used to trigger the notification.

### React Error Boundary

A React error boundary wraps the trade form component. If the component throws during render (e.g. unexpected data shape), the boundary catches it and renders a fallback UI with an option to reset. This prevents a form render error from crashing the entire blotter.

```
<ErrorBoundary fallback={<FormErrorFallback />}>
  <CreateTradeForm />
</ErrorBoundary>
```

## Expected Outcomes

- A valid submission results in a new trade with `status: "ACTIVE"` persisted in MongoDB
- The new trade appears in the blotter of the creating client and all other connected clients within one WebSocket round-trip
- An invalid submission does not reach the backend
- A backend error does not lose the user's form input

## Dependencies and Blockers

- **Blocked by:** [data-model.md](data-model.md) — `CreateTradeSchema` must be exported from `shared/` before this spec can be implemented
- **Blocked by:** WebSocket infrastructure being in place on both backend and frontend
- **Requires:** TanStack Query mutation setup ([ADR 003](../decisions/003-data-fetching-tanstack-query-websockets.md))

## Acceptance Criteria

- [ ] Form renders all required fields with appropriate input types
- [ ] Submitting an empty form shows validation errors on all required fields
- [ ] `quantity: 0` and `price: -1` are rejected with field-level errors
- [ ] A valid submission calls `POST /trades` exactly once
- [ ] The backend rejects a payload missing required fields with `400`
- [ ] The backend rejects a payload containing `id` or `status` with `400`
- [ ] A `201` response closes the form and adds the trade to the blotter
- [ ] The new trade appears on all other connected clients without a page refresh
- [ ] A `500` response shows an error notification and preserves form values
- [ ] A network failure shows an error notification and preserves form values

## Testing

### Unit Tests
- `CreateTradeSchema` validation — valid payload, missing fields, invalid field values, disallowed fields (`id`, `status`)
- Form validation logic — each field in isolation, full valid submission, full invalid submission

### Integration Tests
- `POST /trades` with a valid body returns `201` and the persisted trade
- `POST /trades` with a missing field returns `400` with the correct `issues` array
- `POST /trades` with `quantity: 0` returns `400`
- `POST /trades` broadcasts `trade:created` to connected WebSocket clients

### Component Tests
- Form submits correctly shaped data to the mutation
- Inline errors render when Zod validation fails
- Error notification renders on mutation failure
- Form values are preserved after a failed submission
