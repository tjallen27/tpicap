import { describe, it, expect, beforeEach } from 'vitest'
import '../setup'
import { getTestDb } from '../setup'
import { Trade } from '@tpicap/shared'
import {
  findAllTrades,
  findTradeById,
  insertTrade,
  patchTrade,
  setTradeCancelled,
} from '../../src/db/trades'

const t1: Trade = {
  id: 'TRD-100001',
  symbol: 'AAPL',
  side: 'BUY',
  quantity: 100,
  price: 227.45,
  trader: 'JSMITH',
  book: 'EQUITIES_UK',
  counterparty: 'Goldman Sachs',
  tradeTimestamp: '2026-11-10T09:00:00.000Z',
  status: 'ACTIVE',
}
const t2: Trade = { ...t1, id: 'TRD-100002', tradeTimestamp: '2026-11-10T10:00:00.000Z' }

beforeEach(async () => {
  await getTestDb().collection('trades').deleteMany({})
})

describe('findAllTrades', () => {
  it('returns empty array when collection is empty', async () => {
    expect(await findAllTrades()).toEqual([])
  })

  it('returns trades sorted by tradeTimestamp descending', async () => {
    await insertTrade(t1)
    await insertTrade(t2)
    const result = await findAllTrades()
    expect(result[0].id).toBe('TRD-100002')
    expect(result[1].id).toBe('TRD-100001')
  })

  it('result documents do not contain _id', async () => {
    await insertTrade(t1)
    const result = await findAllTrades()
    expect(result[0]).not.toHaveProperty('_id')
  })
})

describe('findTradeById', () => {
  it('returns null for unknown id', async () => {
    expect(await findTradeById('TRD-999999')).toBeNull()
  })

  it('returns the trade by id', async () => {
    await insertTrade(t1)
    const result = await findTradeById('TRD-100001')
    expect(result?.id).toBe('TRD-100001')
    expect(result).not.toHaveProperty('_id')
  })
})

describe('patchTrade', () => {
  it('updates specified fields and returns updated trade', async () => {
    await insertTrade(t1)
    const result = await patchTrade('TRD-100001', { quantity: 500 })
    expect(result?.quantity).toBe(500)
    expect(result?.price).toBe(227.45)
  })

  it('returns null for unknown id', async () => {
    expect(await patchTrade('TRD-999999', { quantity: 1 })).toBeNull()
  })

  it('returns null for CANCELLED trade', async () => {
    await insertTrade({ ...t1, status: 'CANCELLED' })
    expect(await patchTrade('TRD-100001', { quantity: 500 })).toBeNull()
  })
})

describe('insertTrade', () => {
  it('throws on duplicate id', async () => {
    await insertTrade({ ...t1 })
    await expect(insertTrade({ ...t1 })).rejects.toThrow()
  })
})

describe('setTradeCancelled', () => {
  it('sets status to CANCELLED and returns updated trade', async () => {
    await insertTrade(t1)
    const result = await setTradeCancelled('TRD-100001')
    expect(result?.status).toBe('CANCELLED')
  })

  it('returns null if trade is already CANCELLED', async () => {
    await insertTrade({ ...t1, status: 'CANCELLED' })
    expect(await setTradeCancelled('TRD-100001')).toBeNull()
  })

  it('returns null for unknown id', async () => {
    expect(await setTradeCancelled('TRD-999999')).toBeNull()
  })
})
