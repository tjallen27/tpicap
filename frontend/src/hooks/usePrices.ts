import { useQueryClient } from '@tanstack/react-query';

export function usePrices(): Record<string, number> {
  return useQueryClient().getQueryData<Record<string, number>>(['prices']) ?? {};
}
