import { describe, it, expect, beforeEach } from 'vitest'
import '../setup'
import { getTestDb } from '../setup'
import { TradeSchema } from '@tpicap/shared'
import { generateSeedTrades, seedIfEmpty, BASE_PRICES } from '../../src/seed/seed'

beforeEach(async () => {
  await getTestDb().collection('trades').deleteMany({})
})

describe('generateSeedTrades', () => {
  it('returns exactly 100 trades', () => {
    expect(generateSeedTrades()).toHaveLength(100)
  })

  it('all generated trades pass TradeSchema validation', () => {
    generateSeedTrades().forEach(t => expect(TradeSchema.safeParse(t).success).toBe(true))
  })

  it('each trade id is unique', () => {
    const ids = generateSeedTrades().map(t => t.id)
    expect(new Set(ids).size).toBe(100)
  })

  it('execution prices are within ±4% of base price', () => {
    const trades = generateSeedTrades()
    trades.forEach(t => {
      const base = BASE_PRICES[t.symbol]
      expect(t.price).toBeGreaterThanOrEqual(parseFloat((base * 0.96).toFixed(2)))
      expect(t.price).toBeLessThanOrEqual(parseFloat((base * 1.04).toFixed(2)))
    })
  })
})

describe('seedIfEmpty', () => {
  it('inserts 100 trades when collection is empty', async () => {
    await seedIfEmpty()
    const count = await getTestDb().collection('trades').countDocuments()
    expect(count).toBe(100)
  })

  it('does not insert if trades already exist', async () => {
    await seedIfEmpty()
    await seedIfEmpty()
    const count = await getTestDb().collection('trades').countDocuments()
    expect(count).toBe(100)
  })
})
