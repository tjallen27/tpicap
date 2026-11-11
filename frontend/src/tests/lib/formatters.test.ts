import { it, expect } from 'vitest';
import { formatCurrency, formatPrice, formatTimestamp, formatQuantity } from '../../lib/formatters';

it('formatCurrency formats positive number with + prefix', () => {
  expect(formatCurrency(12450)).toBe('+$12,450.00');
});

it('formatCurrency formats negative number with - prefix', () => {
  expect(formatCurrency(-3200)).toBe('-$3,200.00');
});

it('formatCurrency formats zero without sign prefix', () => {
  expect(formatCurrency(0)).toBe('$0.00');
});

it('formatCurrency formats decimal values to 2dp', () => {
  expect(formatCurrency(1234.567)).toBe('+$1,234.57');
});

it('formatPrice formats positive number as plain currency with no sign', () => {
  expect(formatPrice(227.45)).toBe('$227.45');
});

it('formatPrice formats integer with two decimal places', () => {
  expect(formatPrice(227)).toBe('$227.00');
});

it('formatTimestamp formats ISO string to DD MMM YYYY HH:mm:ss', () => {
  expect(formatTimestamp('2026-11-11T14:30:00.000Z')).toBe('11 Nov 2026 14:30:00');
});

it('formatQuantity formats integer with thousands separator', () => {
  expect(formatQuantity(1000)).toBe('1,000');
  expect(formatQuantity(1000000)).toBe('1,000,000');
  expect(formatQuantity(500)).toBe('500');
});
