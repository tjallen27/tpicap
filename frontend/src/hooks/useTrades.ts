import { useQuery } from '@tanstack/react-query';
import { fetchTrades } from '../api/trades';

export function useTrades() {
  return useQuery({ queryKey: ['trades'], queryFn: fetchTrades });
}
