import { describe, it, expect } from 'vitest'
import { PriceUpdateSchema, PriceUpdateEventSchema } from '../src/index'

const valid = {
  symbol: 'AAPL',
  currentPrice: 227.45,
  timestamp: '2026-11-11T09:15:23.000Z',
}

describe('PriceUpdateSchema', () => {
  it('accepts valid price update', () => expect(PriceUpdateSchema.safeParse(valid).success).toBe(true))
  it('rejects negative currentPrice', () => expect(PriceUpdateSchema.safeParse({ ...valid, currentPrice: -1 }).success).toBe(false))
  it('rejects zero currentPrice', () => expect(PriceUpdateSchema.safeParse({ ...valid, currentPrice: 0 }).success).toBe(false))
})

describe('PriceUpdateEventSchema', () => {
  it('accepts array of price updates', () =>
    expect(PriceUpdateEventSchema.safeParse([valid, { ...valid, symbol: 'MSFT' }]).success).toBe(true))
})
