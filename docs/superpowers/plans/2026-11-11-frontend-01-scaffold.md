# Frontend: Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Vite + React + TypeScript frontend project with QueryClientProvider, an ErrorBoundary, and the Vitest test harness.

**Architecture:** A standard Vite SPA entry point in `frontend/`. `main.tsx` wraps the app in `QueryClientProvider`. `App.tsx` renders a stub `BlotterPage` inside a class-component `ErrorBoundary`. Environment variable types are declared in `env.d.ts` so all subsequent tasks can safely read `import.meta.env.VITE_API_URL` and `import.meta.env.VITE_WS_URL`.

**Tech Stack:** `vite`, `@vitejs/plugin-react`, `react`, `react-dom`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `typescript`, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`

**Specs:**
- `docs/specs/data-fetching.md`

**Dependencies:** None — this is the first task.

## Global Constraints

- Env vars: `VITE_API_URL` (backend base URL, e.g. `http://localhost:3000`) and `VITE_WS_URL` (WebSocket URL, e.g. `ws://localhost:3000`) — read via `import.meta.env`
- WebSocket endpoint: `${VITE_WS_URL}/ws`
- Query keys: `['trades']` for the trade list; `['prices']` for the symbol → currentPrice map
- P&L formula: `(currentPrice - price) × quantity × (side === 'BUY' ? 1 : -1)`
- P&L display: formatted currency with sign (`+$12,450.00` / `-$3,200.00`); positive=green, negative=red, zero=neutral
- Reconnect backoff delays: attempt 1=1000ms, attempt 2=2000ms, attempt 3=4000ms, attempt 4+=8000ms
- WebSocket event names: `trade:created`, `trade:amended`, `trade:cancelled`, `price:updated`
- WS message shape: `{ event: string, payload: unknown }` — JSON.parse on `message.data`
- Timestamp display format: `DD MMM YYYY HH:mm:ss`
- Default sort on load: `tradeTimestamp` descending
- Quick search fields: `id`, `symbol`, `trader`, `book`, `counterparty` (case-insensitive)
- Side filter options: `BUY`, `SELL`; Status filter options: `ACTIVE`, `CANCELLED`
- `CANCELLED` rows render at reduced opacity; `BUY` in green; `SELL` in red
- No optimistic updates on cancel — UI reflects only confirmed server state
- `tradeTimestamp` is not collected from the user — the backend sets it; the form sends only `CreateTradeSchema` fields
- Amend does not submit if form values are identical to current trade values
- 409 on cancel or amend: show notification + call `queryClient.invalidateQueries(['trades'])`

## Review Focus

No unexercised failure modes identified for this task.

---

### Task 1: Frontend Scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/env.d.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/tests/setup.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `QueryClientProvider` wrapping `<App />` in `main.tsx`; `ErrorBoundary` wrapping `<BlotterPage />` in `App.tsx` (BlotterPage is a stub at this stage); `import.meta.env.VITE_API_URL` and `import.meta.env.VITE_WS_URL` typed in `env.d.ts`

- [ ] Step 1: Write the failing test

  `src/tests/setup.ts` — configure `@testing-library/jest-dom`:
  ```ts
  // src/tests/setup.ts
  import '@testing-library/jest-dom';
  ```

  Write a smoke test that the app mounts without throwing:
  ```ts
  // src/tests/components/App.test.tsx
  it('renders without crashing', () => {
    render(<App />);
    expect(document.body).toBeInTheDocument();
  });
  ```

- [ ] Step 2: Run test to confirm failure
  Run: `pnpm --filter frontend test -- src/tests/components/App.test.tsx`
  Expected: FAIL — `App` module not found / cannot resolve

- [ ] Step 3: Implement scaffold files

  `package.json` — dependencies: `react`, `react-dom`, `@tanstack/react-query`, `@tanstack/react-query-devtools`. Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`.

  `vite.config.ts`:
  ```ts
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';

  export default defineConfig({
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/tests/setup.ts',
    },
  });
  ```

  `tsconfig.json` — `target: "ES2020"`, `lib: ["ES2020", "DOM", "DOM.Iterable"]`, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, `strict: true`.

  `index.html` — standard Vite HTML entry pointing to `src/main.tsx`.

  `src/env.d.ts`:
  ```ts
  /// <reference types="vite/client" />
  interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    readonly VITE_WS_URL: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  ```

  `src/main.tsx`:
  ```tsx
  import React from 'react';
  import ReactDOM from 'react-dom/client';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
  import App from './App';

  const queryClient = new QueryClient();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </React.StrictMode>
  );
  ```

  `src/App.tsx` — renders `<BlotterPage />` (stub) wrapped in a React `ErrorBoundary`. The ErrorBoundary is a class component with a `fallback` prop that renders a recovery message.

- [ ] Step 4: Run test to confirm pass
  Run: `pnpm --filter frontend test -- src/tests/components/App.test.tsx`
  Expected: PASS

- [ ] Step 5: Commit
  ```
  git add frontend/
  git commit -m "feat(frontend): scaffold Vite + React + TypeScript project with QueryClientProvider"
  ```
