# ADR 004 — External Data Source: Finnhub

## Status

Accepted

## Context

The assessment requires trade data to be populated with realistic equity information — symbols, company names, and current or reference prices. Rather than seeding the application with fully synthetic, hardcoded data, an external market data API provides credibility to the blotter and allows trades to reflect real instruments.

The key requirements for a data source in this context are:

- Provides equity quote data (price, symbol, company name) for major exchanges
- Has a free tier sufficient for development and assessment use
- Offers a well-documented REST API
- Has a TypeScript-friendly response shape (or a published SDK/type definitions)
- Does not require a brokerage account or institutional access

Candidates considered:

| Provider | Free Tier | Notes |
|---|---|---|
| **Finnhub** | 60 req/min | REST + WebSocket, official `finnhub-ts` SDK, broad symbol coverage |
| Alpha Vantage | 25 req/day | Very restrictive free tier; insufficient for development iteration |
| Polygon.io | Limited | Free tier restricted to previous-day data; no real-time quotes |
| Yahoo Finance (unofficial) | Unofficial | No stable API contract; scraping risk; not suitable for assessed work |

## Decision

Use **Finnhub** as the external data source for fetching market data (quotes and symbol metadata).

The backend will make Finnhub requests server-side — the API key is never exposed to the frontend. Finnhub data is used to seed realistic trade prices and validate that submitted symbols correspond to real instruments.

| Field | Detail |
|---|---|
| Name | Finnhub Node.js client |
| Package | `finnhub` |
| Reason | Official SDK with TypeScript types; wraps the REST API cleanly without manual `fetch` wiring |

## Consequences

- A `FINNHUB_API_KEY` environment variable must be present in the backend runtime. Local setup instructions and Docker configuration will document this.
- All Finnhub calls are made from the backend only; the frontend has no direct dependency on the external API.
- The free tier (60 requests/minute) is more than sufficient for assessment usage but would need a paid plan for production-scale ingestion.
- If Finnhub is unavailable, trade creation that relies on live price lookups will degrade gracefully — the backend should handle API errors without crashing and document the fallback behaviour in the relevant feature spec.
