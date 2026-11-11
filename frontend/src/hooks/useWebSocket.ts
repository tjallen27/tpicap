import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Trade, PriceUpdate } from '@tpicap/shared';

type WsStatus = 'connected' | 'reconnecting' | 'disconnected';

const MAX_ATTEMPTS = 4;

function backoffDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt - 1), 8000);
}

export function useWebSocket(): { status: WsStatus; retry: () => void } {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<WsStatus>('reconnecting');
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const hasPreviouslyConnected = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function connect() {
    const ws = new WebSocket(`${import.meta.env.VITE_WS_URL}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (hasPreviouslyConnected.current) {
        queryClient.invalidateQueries({ queryKey: ['trades'] });
      }
      hasPreviouslyConnected.current = true;
      setStatus('connected');
    };

    ws.onclose = () => {
      attemptRef.current += 1;
      if (attemptRef.current > MAX_ATTEMPTS) {
        setStatus('disconnected');
        return;
      }
      setStatus('reconnecting');
      const delay = backoffDelay(attemptRef.current);
      timeoutRef.current = setTimeout(() => { connect(); }, delay);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const { event: name, payload } = JSON.parse(event.data as string) as {
          event: string;
          payload: unknown;
        };

        if (name === 'trade:created') {
          queryClient.setQueryData<Trade[]>(['trades'], old =>
            old ? [...old, payload as Trade] : [payload as Trade]
          );
        } else if (name === 'trade:amended' || name === 'trade:cancelled') {
          const updated = payload as Trade;
          queryClient.setQueryData<Trade[]>(['trades'], old =>
            old ? old.map(t => (t.id === updated.id ? updated : t)) : [updated]
          );
        } else if (name === 'price:updated') {
          const updates = payload as PriceUpdate[];
          queryClient.setQueryData<Record<string, number>>(['prices'], old => {
            const next = { ...(old ?? {}) };
            for (const { symbol, currentPrice } of updates) {
              next[symbol] = currentPrice;
            }
            return next;
          });
        }
      } catch {
        // malformed message — ignore
      }
    };
  }

  useEffect(() => {
    connect();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      wsRef.current?.close();
    };
    // connect is stable across renders; eslint-disable is acceptable here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function retry() {
    attemptRef.current = 0;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    wsRef.current?.close();
    connect();
  }

  return { status, retry };
}
