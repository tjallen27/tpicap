import { describe, it, expect } from 'vitest'
import { TradeSchema, CreateTradeSchema, AmendTradeSchema } from '../src/index'

const valid = {
  id: 'TRD-100001',
  symbol: 'AAPL',
  side: 'BUY',
  quantity: 100,
  price: 227.45,
  trader: 'JSMITH',
  book: 'EQUITIES_UK',
  counterparty: 'Goldman Sachs',
  tradeTimestamp: '2026-11-11T09:15:23.000Z',
  status: 'ACTIVE',
}

describe('TradeSchema', () => {
  it('accepts a valid trade', () => expect(TradeSchema.safeParse(valid).success).toBe(true))
  it('rejects quantity 0', () => expect(TradeSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false))
  it('rejects negative price', () => expect(TradeSchema.safeParse({ ...valid, price: -1 }).success).toBe(false))
  it('rejects invalid side', () => expect(TradeSchema.safeParse({ ...valid, side: 'HOLD' }).success).toBe(false))
  it('rejects invalid status', () => expect(TradeSchema.safeParse({ ...valid, status: 'PENDING' }).success).toBe(false))
  it('rejects non-ISO timestamp', () => expect(TradeSchema.safeParse({ ...valid, tradeTimestamp: '2026-11-11' }).success).toBe(false))
  it('rejects empty symbol', () => expect(TradeSchema.safeParse({ ...valid, symbol: '' }).success).toBe(false))
})

describe('CreateTradeSchema', () => {
  const { id, status, ...createInput } = valid
  it('accepts valid create input', () => expect(CreateTradeSchema.safeParse(createInput).success).toBe(true))
  it('rejects create with quantity 0', () => expect(CreateTradeSchema.safeParse({ ...createInput, quantity: 0 }).success).toBe(false))
})

describe('AmendTradeSchema', () => {
  it('accepts empty object', () => expect(AmendTradeSchema.safeParse({}).success).toBe(true))
  it('accepts partial fields', () => expect(AmendTradeSchema.safeParse({ quantity: 500 }).success).toBe(true))
  it('rejects quantity 0', () => expect(AmendTradeSchema.safeParse({ quantity: 0 }).success).toBe(false))
})
