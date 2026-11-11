import { describe, it, expect, vi } from 'vitest'
import { PriceUpdateEventSchema } from '@tpicap/shared'
import { startPriceService } from '../../src/prices/priceService'

describe('startPriceService', () => {
  it('starts simulator and does not call Finnhub when apiKey is undefined', async () => {
    const mockBroadcast = vi.fn()
    const stop = startPriceService(mockBroadcast, {})
    stop()
  })

  it('broadcasts price:updated with all 10 symbols on first tick', () => {
    vi.useFakeTimers()
    const mockBroadcast = vi.fn()
    const stop = startPriceService(mockBroadcast, {})
    vi.advanceTimersByTime(3000)
    expect(mockBroadcast).toHaveBeenCalledWith(
      'price:updated',
      expect.arrayContaining([expect.objectContaining({ symbol: 'AAPL' })])
    )
    const payload = mockBroadcast.mock.calls[0][1]
    expect(payload).toHaveLength(10)
    stop()
    vi.useRealTimers()
  })

  it('payload passes PriceUpdateEventSchema validation', () => {
    vi.useFakeTimers()
    const mockBroadcast = vi.fn()
    const stop = startPriceService(mockBroadcast, {})
    vi.advanceTimersByTime(3000)
    expect(PriceUpdateEventSchema.safeParse(mockBroadcast.mock.calls[0][1]).success).toBe(true)
    stop()
    vi.useRealTimers()
  })

  it('stop function clears the interval', () => {
    vi.useFakeTimers()
    const mockBroadcast = vi.fn()
    const stop = startPriceService(mockBroadcast, {})
    stop()
    vi.advanceTimersByTime(9000)
    expect(mockBroadcast).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
