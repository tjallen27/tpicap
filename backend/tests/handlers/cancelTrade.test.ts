import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { FastifyInstance } from 'fastify'

vi.mock('../../src/websocket/manager', () => ({ wsManager: { broadcast: vi.fn() } }))

import '../setup'
import { getTestDb } from '../setup'
import { buildTestApp } from '../helpers'
import { insertTrade } from '../../src/db/trades'
import { setTradeCancelled } from '../../src/db/trades'
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

describe('PATCH /trades/:id/cancel', () => {
  it('returns 200 with cancelled trade', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-100001/cancel' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).status).toBe('CANCELLED')
  })

  it('broadcasts trade:cancelled', async () => {
    await app.inject({ method: 'PATCH', url: '/trades/TRD-100001/cancel' })
    expect(wsManager.broadcast).toHaveBeenCalledWith(
      'trade:cancelled',
      expect.objectContaining({ status: 'CANCELLED' })
    )
  })

  it('returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-999999/cancel' })
    expect(res.statusCode).toBe(404)
  })

  it('returns 409 for already-cancelled trade', async () => {
    await app.inject({ method: 'PATCH', url: '/trades/TRD-100001/cancel' })
    const res = await app.inject({ method: 'PATCH', url: '/trades/TRD-100001/cancel' })
    expect(res.statusCode).toBe(409)
  })

  it('concurrent cancels — only one succeeds, second returns null', async () => {
    const [r1, r2] = await Promise.all([
      setTradeCancelled('TRD-100001'),
      setTradeCancelled('TRD-100001'),
    ])
    const results = [r1, r2]
    expect(results.filter(r => r !== null)).toHaveLength(1)
    expect(results.filter(r => r === null)).toHaveLength(1)
  })
})
