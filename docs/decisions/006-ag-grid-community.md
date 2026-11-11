# ADR 006: AG Grid Community for the Blotter Table

## Context

The blotter spec requires a sortable, filterable table with 12 columns including a custom cell renderer for the Actions column. TanStack Table was listed as a candidate in the spec.

## Options Considered

| Option | Description |
|---|---|
| **TanStack Table** | Headless library — provides logic only; all DOM, styling, sort UI, and virtual scrolling must be hand-built |
| **AG Grid Community** | Feature-complete grid with built-in sort, column sizing, custom cell renderers, and virtual DOM performance for large datasets |

## Decision

AG Grid Community.

It provides sort, cell renderer API, and virtual DOM performance for large trade lists without reimplementing grid infrastructure. The community edition is free and covers all required blotter features.

## Dependency

| Field | Detail |
|---|---|
| Name | AG Grid Community |
| Package | `ag-grid-community`, `ag-grid-react` |
| Reason | Feature-complete data grid with built-in sort, custom cell renderers, and virtual scrolling — covers all blotter table requirements without reimplementing grid infrastructure |

## Consequences

- AG Grid brings its own CSS theme; `ag-theme-alpine` is used for a clean professional look.
- The grid handles sort state internally and exposes `defaultColDef` and `initialState.sort` for the default `tradeTimestamp` descending sort.
- Cell renderers are plain React components registered via the `ModuleRegistry` and the grid's `components` prop.
- AG Grid v36 uses a modular architecture requiring explicit module registration — `AllCommunityModule` is registered at the component level.
