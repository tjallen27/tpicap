# Spec: Trade Blotter Table

## Requirements

- Display all trades in a table with clearly labelled columns
- Each row presents a single trade with all relevant fields visible
- Rows for active trades expose Amend and Cancel actions
- A quick search input filters the visible rows across key string fields in real time
- Each sortable column header toggles between ascending and descending order on click
- Numeric columns sort by value; string columns sort alphabetically; date columns sort chronologically
- The table remains responsive and usable as the trade list grows
- The connection status indicator from the live updates spec is anchored to the blotter header

See: [live-updates.md](live-updates.md) for WebSocket integration and fallback states.

## Table Structure

### Columns

| # | Column Header | Field | Type | Sortable | Notes |
|---|---|---|---|---|---|
| 1 | Trade ID | `id` | string | Yes | e.g. `TRD-100001` |
| 2 | Symbol | `symbol` | string | Yes | Equity ticker, e.g. `AAPL` |
| 3 | Side | `side` | enum | Yes | `BUY` or `SELL` — colour coded |
| 4 | Quantity | `quantity` | number | Yes | Integer, formatted with thousands separator |
| 5 | Price | `price` | number | Yes | Decimal, formatted as currency (USD) |
| 6 | Trader | `trader` | string | Yes | |
| 7 | Book | `book` | string | Yes | |
| 8 | Counterparty | `counterparty` | string | Yes | |
| 9 | Timestamp | `tradeTimestamp` | datetime | Yes | Formatted: `DD MMM YYYY HH:mm:ss` |
| 10 | Status | `status` | enum | Yes | `ACTIVE` or `CANCELLED` — colour coded |
| 11 | P&L | derived | number | Yes | `(currentPrice - price) × quantity`; colour coded; see [data-fetching.md](data-fetching.md) |
| 12 | Actions | — | — | No | Amend / Cancel buttons |

### Row Visual Treatment

- `ACTIVE` rows render at full opacity
- `CANCELLED` rows render at reduced opacity with muted text to indicate they are terminal
- `side: "BUY"` is styled in green; `side: "SELL"` is styled in red
- `status: "ACTIVE"` is styled in green; `status: "CANCELLED"` is styled in grey

### Actions Column

The Actions column is always the last column.

| Trade Status | Amend | Cancel |
|---|---|---|
| `ACTIVE` | Visible and enabled | Visible and enabled |
| `CANCELLED` | Not rendered | Not rendered |

Clicking Amend opens the amend form pre-populated with the trade's current values (see [amend-trade.md](amend-trade.md)).

Clicking Cancel shows a confirmation prompt before dispatching the cancel request (see [cancel-trade.md](cancel-trade.md)).

## Blotter Header

The area above the table contains:

1. **Page title** — "Trade Blotter"
2. **Connection status indicator** — live/reconnecting/disconnected (see [live-updates.md](live-updates.md))
3. **Quick search input** — described below
4. **Filter controls** — described below
5. **Refresh button** — described below
6. **New Trade button** — opens the create trade form (see [create-trade.md](create-trade.md))

## Quick Search

A single text input at the top of the blotter filters the visible rows in real time as the user types. No submit action is required.

### Searched Fields

The search term is matched case-insensitively against the following fields:

- `id`
- `symbol`
- `trader`
- `book`
- `counterparty`

Numeric fields (`quantity`, `price`) and enum fields (`side`, `status`) are not included in the quick search — these are handled by the filter controls.

### Behaviour

- Filtering is applied client-side against the data already in the TanStack Query cache — no additional API requests are made
- An empty search string shows all trades
- If the search yields no matching rows, an inline empty message is shown: `"No trades match your search"`
- The search input includes a clear (×) button when a value is present

## Filter Controls

Dedicated filter controls sit alongside the quick search and narrow the trade list by categorical fields.

| Filter | Type | Options |
|---|---|---|
| Side | Multi-select | `BUY`, `SELL` |
| Status | Multi-select | `ACTIVE`, `CANCELLED` |

Filters are applied client-side in combination with the quick search. All active filters are AND-ed together.

A "Clear filters" action resets all filter controls and the search input simultaneously.

## Manual Refresh

A "Refresh" button in the blotter header triggers a fresh `GET /trades` request via TanStack Query's `refetch`. This is distinct from the WebSocket reconciliation that occurs on reconnect — it is an explicit, user-initiated action.

### Behaviour

- Clicking Refresh calls `refetch()` on the trades query
- While the refetch is in progress, the button shows a loading state (spinner or disabled) to indicate activity
- Existing rows remain visible during the refetch — the table does not revert to a loading skeleton for a manual refresh, only for the initial load
- On success, the cache is updated and the table reflects the latest server state
- On failure, an error notification is shown; the existing data remains in the table

## Sorting

Clicking a sortable column header cycles through three states:

```
Unsorted → Ascending → Descending → Unsorted
```

A visual indicator (↑ / ↓) on the active column header shows the current sort direction. Only one column may be sorted at a time.

### Sort Behaviour by Type

| Column Type | Ascending | Descending |
|---|---|---|
| String (`id`, `symbol`, `trader`, `book`, `counterparty`) | A → Z | Z → A |
| Number (`quantity`, `price`) | Lowest → Highest | Highest → Lowest |
| Datetime (`tradeTimestamp`) | Oldest → Newest | Newest → Oldest |
| Enum (`side`, `status`) | Alphabetical (A → Z) | Reverse alphabetical (Z → A) |

Sorting is applied client-side against the cached data. The default sort on initial load is `tradeTimestamp` descending (most recent trades first).

### Sort Interaction with Search and Filters

Sort, search, and filters are composable. The pipeline is:

```
Full trade list
  → apply filters (side, status)
  → apply quick search
  → apply sort
  → render rows
```

## Fallback States

Fallback states are defined in [live-updates.md](live-updates.md). The blotter table is responsible for rendering the correct fallback within its own region:

- **Loading** — skeleton rows in place of the table body
- **Fetch error** — error message and retry button in place of the table
- **Empty (no trades exist)** — `"No trades found"` message
- **Empty (filtered/searched result is empty)** — `"No trades match your search"` inline in the table body, with the table headers still visible

The last case is distinct from a true empty state — the headers and controls remain rendered so the user can clear their search.

## Dependencies and Blockers

- **Blocked by:** [data-model.md](data-model.md) — `Trade` type required to type table rows
- **Blocked by:** [live-updates.md](live-updates.md) — connection status indicator and cache-driven updates must be in place
- **Blocked by:** [data-fetching.md](data-fetching.md) — P&L column depends on the prices cache and `price:updated` events
- **Requires:** [create-trade.md](create-trade.md), [amend-trade.md](amend-trade.md), [cancel-trade.md](cancel-trade.md) — the New Trade, Amend, and Cancel actions trigger flows defined in those specs
- **Decision required:** table library — TanStack Table is a strong candidate given TanStack Query is already in use; an ADR should be written before implementation begins

## Acceptance Criteria

- [ ] All 10 data columns, the P&L column, and the Actions column are rendered with correct headers
- [ ] P&L column displays correctly formatted currency with sign (`+$12,450.00` / `-$3,200.00`)
- [ ] Positive P&L renders in green; negative P&L renders in red; zero renders in neutral
- [ ] P&L updates when a `price:updated` WebSocket event is received
- [ ] P&L shows `$0.00` before the first price event arrives for a symbol
- [ ] P&L column sorts by value (highest positive to highest negative, and vice versa)
- [ ] `CANCELLED` rows are visually distinct from `ACTIVE` rows
- [ ] `BUY` and `SELL` values are colour coded
- [ ] The Actions column renders Amend and Cancel only for `ACTIVE` trades
- [ ] The quick search filters rows in real time without an API call
- [ ] The search matches case-insensitively across `id`, `symbol`, `trader`, `book`, and `counterparty`
- [ ] The clear (×) button on the search input resets the search
- [ ] The Side and Status filters narrow the visible rows correctly
- [ ] Multiple filters applied together AND their results
- [ ] "Clear filters" resets all controls at once
- [ ] Clicking a sortable column header sorts ascending; clicking again sorts descending; clicking a third time clears the sort
- [ ] Only one column can be sorted at a time
- [ ] Numeric columns sort by value, not lexicographically
- [ ] The active sort column shows a directional indicator
- [ ] Default sort on load is `tradeTimestamp` descending
- [ ] Sort, search, and filters compose correctly — all three active simultaneously produces the correct result
- [ ] The Refresh button triggers a `GET /trades` refetch
- [ ] The Refresh button shows a loading state while the refetch is in progress
- [ ] Existing rows remain visible during a manual refetch (no skeleton regression)
- [ ] A failed manual refetch shows an error notification without clearing the table
- [ ] A skeleton is shown while the initial fetch is in progress
- [ ] An error state with a retry button is shown if the fetch fails
- [ ] An empty state is shown if the fetch returns no trades
- [ ] A filtered empty state is shown when search/filters yield no results, with headers still visible
- [ ] The connection status indicator is visible in the blotter header at all times

## Testing

### Unit Tests
- Filter logic — each filter in isolation, combined filters
- Search logic — matching across correct fields, case insensitivity, no match returns empty
- Sort logic — string columns (A→Z, Z→A), numeric columns (value order not lexicographic), datetime columns, enum columns
- Composed pipeline — filter + search + sort applied in correct order

### Component Tests
- All 12 columns render with correct headers
- P&L column renders correct value and colour for positive, negative, and zero cases
- P&L column updates when prices cache changes
- `CANCELLED` row applies correct visual class
- `BUY` / `SELL` apply correct colour classes
- Actions column is absent for `CANCELLED` rows
- Quick search input filters rows as value changes
- Clear button resets search and shows all rows
- Side and Status filter controls update visible rows
- "Clear filters" resets all controls
- Column header click cycles sort state correctly (unsorted → asc → desc → unsorted)
- Sort indicator renders on active column only
- Skeleton renders when `isFetching` is true
- Error state renders when `isError` is true; retry button calls `refetch`
- Empty state renders when data is an empty array
- Filtered empty message renders when filters/search yield no rows (headers remain visible)
- Refresh button shows loading state while `isRefetching` is true
- Refresh button does not revert the table to a skeleton during refetch
- Error notification renders when manual refetch fails
