import { useQuery } from '@tanstack/react-query';

export function usePrices(): Record<string, number> {
  const { data } = useQuery<Record<string, number>>({
    queryKey: ['prices'],
    queryFn: () => ({} as Record<string, number>),
    staleTime: Infinity,
  });
  return data ?? {};
}
