import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { FastifyInstance } from 'fastify'

vi.mock('../../src/websocket/manager', () => ({ wsManager: { broadcast: vi.fn() } }))

import '../setup'
import { getTestDb } from '../setup'
import { buildTestApp } from '../helpers'
import { insertTrade } from '../../src/db/trades'
import { wsManager } from '../../src/websocket/manager'
import { Trade } from '@tpicap/shared'

const baseTrade: Trade = {
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

let app: FastifyInstance

beforeAll(async () => {
  app = await buildTestApp()
})

beforeEach(async () => {
  await getTestDb().collection('trades').deleteMany({})
  await insertTrade(baseTrade)
  vi.clearAllMocks()
})

describe('PATCH /trades/:id', () => {
  it('with valid fields returns 200 with updated trade', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-100001', payload: { quantity: 500 } })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).quantity).toBe(500)
  })

  it('broadcasts trade:amended with updated trade', async () => {
    await app.inject({ method: 'PATCH', url: '/trades/TRD-100001', payload: { quantity: 500 } })
    expect(wsManager.broadcast).toHaveBeenCalledWith(
      'trade:amended',
      expect.objectContaining({ quantity: 500 })
    )
  })

  it('returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-999999', payload: { quantity: 1 } })
    expect(res.statusCode).toBe(404)
  })

  it('returns 409 for cancelled trade', async () => {
    await getTestDb().collection('trades').updateOne({ id: 'TRD-100001' }, { $set: { status: 'CANCELLED' } })
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-100001', payload: { quantity: 500 } })
    expect(res.statusCode).toBe(409)
  })

  it('returns 400 with field list when immutable field present', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-100001', payload: { symbol: 'NVDA' } })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toEqual({ error: 'Invalid fields', fields: ['symbol'] })
  })

  it('returns 400 for quantity 0', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-100001', payload: { quantity: 0 } })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for empty body', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-100001', payload: {} })
    expect(res.statusCode).toBe(400)
  })
})
