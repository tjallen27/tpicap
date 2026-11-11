import { describe, it, expect, vi } from 'vitest'

vi.mock('finnhub', () => ({
  default: {
    DefaultApi: vi.fn().mockImplementation(() => ({
      quote: vi.fn((symbol: string, cb: (err: Error | null, data: { c: number } | null) => void) => {
        if (symbol === 'FAIL') return cb(new Error('not found'), null)
        if (symbol === 'ZERO') return cb(null, { c: 0 })
        cb(null, { c: 227.45 })
      }),
    })),
  },
}))

import { fetchFinnhubPrices } from '../../src/prices/finnhub'

describe('fetchFinnhubPrices', () => {
  it('returns prices for all symbols that succeed', async () => {
    const prices = await fetchFinnhubPrices(['AAPL', 'MSFT'], 'test-key')
    expect(prices['AAPL']).toBe(227.45)
    expect(prices['MSFT']).toBe(227.45)
  })

  it('omits symbols that fail and resolves for the rest', async () => {
    const prices = await fetchFinnhubPrices(['AAPL', 'FAIL'], 'test-key')
    expect(prices['AAPL']).toBe(227.45)
    expect(prices['FAIL']).toBeUndefined()
  })

  it('resolves to empty object when all symbols fail', async () => {
    const prices = await fetchFinnhubPrices(['FAIL'], 'test-key')
    expect(prices).toEqual({})
  })

  it('omits symbols returning c: 0', async () => {
    const prices = await fetchFinnhubPrices(['AAPL', 'ZERO'], 'test-key')
    expect(prices['AAPL']).toBe(227.45)
    expect(prices['ZERO']).toBeUndefined()
  })
})
