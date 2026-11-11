# Spec: Data Fetching and Price Simulation

## Requirements

- The backend attempts to fetch live market prices for trade symbols from Finnhub on startup
- If Finnhub is unavailable or returns an error, the backend falls back to seeded static data
- The seed dataset contains approximately 100 trades using the trade model defined in [data-model.md](data-model.md)
- Each trade carries both an execution price (`price`) and a simulated current market price (`currentPrice`)
- Current prices are updated at a regular interval and broadcast to all connected clients via the existing WebSocket connection
- The frontend calculates and displays a P&L value per trade row based on the difference between execution price and current market price
- Price updates and trade CRUD events share the same WebSocket connection but use distinct event types

## Concepts

### Execution Price vs Current Market Price

These are two distinct values and must not be conflated:

| Field | Description | Owned by |
|---|---|---|
| `price` | The price at which the trade was executed — set at creation and never changes | Trade record (MongoDB) |
| `currentPrice` | The live market price of the symbol at this moment — ephemeral, not persisted | In-memory on backend; TanStack Query cache on frontend |

`currentPrice` is not stored in MongoDB. It is sourced from Finnhub or the price simulator, held in memory on the backend, and pushed to clients via WebSocket at regular intervals.

### P&L Calculation

P&L per trade is calculated on the frontend from the two prices above:

```typescript
const pnl = (currentPrice - price) * quantity * (side === "BUY" ? 1 : -1);
```

- **BUY trade:** profit when `currentPrice > price`; loss when `currentPrice < price`
- **SELL trade:** profit when `currentPrice < price`; loss when `currentPrice > price`

P&L is a derived display value only. It is never stored or transmitted as a field — it is always recalculated from `currentPrice` and `price`.

---

## GET /trades — Initial Data Load

This is the only read endpoint on the backend. It is called on application mount and again on manual refresh.

`GET /trades`

1. Query all trade documents from MongoDB
2. Return the full array sorted by `tradeTimestamp` descending (most recent first — matches the default blotter sort)
3. Return `200 OK` with the array, even if empty

```typescript
// Response shape
{
  trades: Trade[]
}
```

No server-side filtering, pagination, or search parameters are accepted. All filtering, sorting, and searching are applied client-side against the cached result (see [trade-blotter-table.md](trade-blotter-table.md)).

### Acceptance Criteria

- [ ] `GET /trades` returns `200` with all trades sorted by `tradeTimestamp` descending
- [ ] `GET /trades` returns `200` with an empty array when no trades exist
- [ ] Response conforms to `Trade[]` as defined in `shared/`

### Integration Tests

- `GET /trades` returns all seeded trades in `tradeTimestamp` descending order
- `GET /trades` returns an empty array when the database is empty
- Each item in the response passes `TradeSchema` validation

---

## Finnhub Integration (Primary)

### Dependency

| Field | Detail |
|---|---|
| Name | Finnhub |
| Package | `finnhub` |
| Reason | Official Node.js client for the Finnhub REST and WebSocket API — provides real-time equity quotes for trade symbols |

### Behaviour

On backend startup:

1. Extract the unique set of symbols from the trades currently in MongoDB
2. For each symbol, call the Finnhub `/quote` endpoint to fetch the current market price (`c` — current price field)
3. Store symbol → currentPrice in a backend in-memory price map
4. Begin the price update interval (see [Price Update Interval](#price-update-interval))

If any individual symbol quote fails, that symbol's `currentPrice` defaults to its execution price (`price`), giving a P&L of zero until a valid price arrives. The failure is logged but does not prevent the other symbols from loading.

### Error Handling — Finnhub Failure

If Finnhub is unreachable at startup (network error, auth failure, rate limit), the backend:

1. Logs the error with the failure reason
2. Falls back to the seed price simulator immediately — no retry on startup
3. The price map is populated from the seed data's randomised base prices instead
4. The frontend is unaware of the fallback — it receives `price:updated` events on the same interval regardless of source

A Finnhub failure must not prevent the application from starting or the blotter from loading.

---

## Seed Data and Price Simulation (Fallback)

### Seed Trade Dataset

Approximately 100 trades are generated on first startup if the database is empty (see [data-model.md](data-model.md) — Seed Data section). For this spec, the relevant addition is that each seed trade is assigned a randomised execution price drawn from a realistic base price range per symbol.

#### Symbol Pool and Base Prices

The seed data uses the following symbol pool. Base prices are realistic approximations and are used as the anchor for price simulation:

| Symbol | Base Price (USD) |
|---|---|
| AAPL | 227 |
| MSFT | 534 |
| TSLA | 342 |
| GOOGL | 198 |
| AMZN | 225 |
| NVDA | 875 |
| META | 605 |
| JPM | 248 |
| GS | 582 |
| MS | 134 |

#### Execution Price Randomisation

Each seed trade's `price` field is set to the symbol's base price ± a random spread of up to 8%:

```typescript
const spread = basePrice * (Math.random() * 0.08 - 0.04); // -4% to +4%
const executionPrice = parseFloat((basePrice + spread).toFixed(2));
```

This ensures seed trades have realistic variation around the base price without being implausibly far from market reality.

### Price Simulator

When Finnhub is unavailable, the backend runs a price simulator. The simulator initialises each symbol's `currentPrice` to its base price and applies a random walk on each tick:

```typescript
// Each tick, per symbol:
const drift = currentPrice * (Math.random() * 0.01 - 0.005); // ±0.5%
currentPrice = parseFloat((currentPrice + drift).toFixed(2));
```

This produces realistic-looking price movement — small incremental changes in either direction — without diverging far from the base price over time.

---

## Price Update Interval

Regardless of whether the source is Finnhub or the simulator, the backend broadcasts a `price:updated` WebSocket event at a **fixed interval of 3 seconds**.

### WebSocket Event

This event is new and extends the event set defined in [live-updates.md](live-updates.md):

```typescript
{
  event: "price:updated",
  payload: PriceUpdate[]
}
```

Where:

```typescript
// shared/src/schemas/price.ts

import { z } from "zod";

export const PriceUpdateSchema = z.object({
  symbol: z.string(),
  currentPrice: z.number().positive(),
  timestamp: z.string().datetime(),
});

export const PriceUpdateEventSchema = z.array(PriceUpdateSchema);

export type PriceUpdate = z.infer<typeof PriceUpdateSchema>;
```

Each event contains the full current price for every tracked symbol — not just the ones that changed. This simplifies the frontend: it replaces the whole price map on every event.

### Complete WebSocket Event Reference

| Event | Direction | Trigger | Payload |
|---|---|---|---|
| `trade:created` | Server → Client | `POST /trades` succeeds | `Trade` |
| `trade:amended` | Server → Client | `PATCH /trades/:id` succeeds | `Trade` |
| `trade:cancelled` | Server → Client | `PATCH /trades/:id/cancel` succeeds | `Trade` |
| `price:updated` | Server → Client | Every 3 seconds (Finnhub or simulator) | `PriceUpdate[]` |

---

## Frontend — Price Cache and P&L Display

### Price Map

The frontend maintains a separate TanStack Query entry for the current prices, keyed by symbol:

```typescript
queryClient.setQueryData(["prices"], (prev: Record<string, number>) => ({
  ...prev,
  ...Object.fromEntries(payload.map(p => [p.symbol, p.currentPrice]))
}));
```

When a `price:updated` event arrives via WebSocket, the prices cache is updated via `setQueryData`. The trades cache is not touched — P&L is calculated at render time from the two caches.

### P&L Display

Each blotter row reads `currentPrice` from the prices cache and calculates P&L inline:

```typescript
const currentPrice = prices[trade.symbol] ?? trade.price; // fall back to execution price if no market price yet
const pnl = (currentPrice - trade.price) * trade.quantity * (trade.side === "BUY" ? 1 : -1);
```

P&L is displayed as:
- A formatted currency value (e.g. `+$12,450.00` / `-$3,200.00`)
- Colour coded: positive P&L in green, negative P&L in red, zero in neutral

The P&L column is added to the blotter table (see [trade-blotter-table.md](trade-blotter-table.md)).

### No `currentPrice` Fallback Spinner

If the prices cache has no entry for a symbol yet (before the first `price:updated` event arrives), P&L defaults to `0` using the execution price as a stand-in. No loading state is shown for the P&L column — the value simply shows `$0.00` until the first price event arrives.

---

## Error Boundaries

### Finnhub Auth / Rate Limit

If the Finnhub API key is missing or invalid, the backend logs the error and falls back to the simulator immediately. The API key is read from the `FINNHUB_API_KEY` environment variable. If the variable is not set, the backend skips the Finnhub attempt entirely and starts the simulator directly.

### Symbol Not Found on Finnhub

If Finnhub does not recognise a symbol (e.g. a seed symbol not listed), that symbol's `currentPrice` defaults to its execution price. The remaining symbols are unaffected.

### Price Simulator Consistency

The simulator must not produce negative or zero prices. If a drift calculation would result in a price ≤ 0, the drift is discarded and the price remains unchanged for that tick.

---

## Dependencies and Blockers

- **Blocked by:** [data-model.md](data-model.md) — `Trade` type and seed data generation must be in place
- **Blocked by:** [live-updates.md](live-updates.md) — WebSocket server must exist before `price:updated` can be broadcast
- **Extends:** [live-updates.md](live-updates.md) — adds the `price:updated` event to the WebSocket event set
- **Extends:** [trade-blotter-table.md](trade-blotter-table.md) — adds a P&L column to the table
- **Requires:** `FINNHUB_API_KEY` environment variable to be documented in the README and `.env.example`

## Acceptance Criteria

- [ ] On startup, the backend attempts to fetch current prices from Finnhub for all symbols in the trade list
- [ ] If `FINNHUB_API_KEY` is not set, the backend starts the price simulator without attempting a Finnhub connection
- [ ] If Finnhub is unreachable, the backend falls back to the price simulator without crashing
- [ ] Seed data contains approximately 100 trades across the defined symbol pool
- [ ] Each seed trade's execution price is within ±4% of the symbol's base price
- [ ] The backend broadcasts a `price:updated` event every 3 seconds containing prices for all tracked symbols
- [ ] The frontend updates its prices cache on each `price:updated` event without touching the trades cache
- [ ] The blotter table displays a P&L column calculated from `currentPrice` and `price`
- [ ] Positive P&L is displayed in green; negative P&L in red
- [ ] P&L defaults to `$0.00` when no price has been received for a symbol yet
- [ ] The price simulator never produces a price ≤ 0

## Testing

### Unit Tests
- P&L calculation — BUY profit, BUY loss, SELL profit, SELL loss, zero (currentPrice equals price)
- Price simulator drift — price stays positive after many ticks; tick applies ±0.5% change
- Execution price randomisation — seed prices are within ±4% of base price
- `PriceUpdateSchema` — valid payload, missing fields, negative price rejected

### Integration Tests
- Backend broadcasts `price:updated` every 3 seconds to connected WebSocket clients
- `price:updated` payload contains entries for all tracked symbols
- Finnhub failure causes fallback to simulator without process crash
- Missing `FINNHUB_API_KEY` skips Finnhub attempt and starts simulator directly

### Component Tests
- P&L column renders with correct positive/negative formatting and colour
- P&L updates when the prices cache changes
- P&L shows `$0.00` when no price entry exists for the trade's symbol
