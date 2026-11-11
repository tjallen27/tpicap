import type { Trade, CreateTradeInput, AmendTradeInput } from '@tpicap/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(`API error ${status}`);
    this.name = 'ApiError';
  }
}

const base = () => import.meta.env.VITE_API_URL;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = init ? await fetch(url, init) : await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export function fetchTrades(): Promise<Trade[]> {
  return request<{ trades: Trade[] }>(`${base()}/trades`).then(r => r.trades);
}

export function createTrade(data: CreateTradeInput): Promise<Trade> {
  return request<Trade>(`${base()}/trades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function amendTrade(id: string, data: AmendTradeInput): Promise<Trade> {
  return request<Trade>(`${base()}/trades/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function cancelTrade(id: string): Promise<Trade> {
  return request<Trade>(`${base()}/trades/${id}/cancel`, {
    method: 'PATCH',
  });
}
