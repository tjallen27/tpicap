const usdFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const quantityFormat = new Intl.NumberFormat('en-US');

const timestampFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

export function formatCurrency(n: number): string {
  const formatted = usdFormat.format(Math.abs(n));
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
}

export function formatPrice(n: number): string {
  return usdFormat.format(n);
}

export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  // en-GB gives "11 Nov 2026, 14:30:00" — strip comma and pad
  return timestampFormat
    .format(date)
    .replace(',', '')
    .replace(/\s+/g, ' ');
}

export function formatQuantity(n: number): string {
  return quantityFormat.format(n);
}
