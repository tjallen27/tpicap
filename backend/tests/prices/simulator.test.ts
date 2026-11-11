import { describe, it, expect, vi } from 'vitest'
import { PriceSimulator } from '../../src/prices/simulator'

describe('PriceSimulator', () => {
  it('initialises prices to base prices', () => {
    const sim = new PriceSimulator({ AAPL: 227 })
    expect(sim.getPrice('AAPL')).toBe(227)
  })

  it('tick changes price by at most ±0.5%', () => {
    const sim = new PriceSimulator({ AAPL: 100 })
    sim.tick()
    expect(sim.getPrice('AAPL')).toBeGreaterThanOrEqual(99.50)
    expect(sim.getPrice('AAPL')).toBeLessThanOrEqual(100.50)
  })

  it('price never reaches 0 or below after 10,000 ticks of maximum negative drift', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const sim = new PriceSimulator({ TEST: 0.01 })
    for (let i = 0; i < 10000; i++) sim.tick()
    expect(sim.getPrice('TEST')).toBeGreaterThan(0)
    vi.restoreAllMocks()
  })

  it('getPrices returns all tracked symbols', () => {
    const sim = new PriceSimulator({ AAPL: 227, MSFT: 534 })
    expect(Object.keys(sim.getPrices())).toEqual(expect.arrayContaining(['AAPL', 'MSFT']))
  })
})
