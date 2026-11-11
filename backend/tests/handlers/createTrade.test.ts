import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { FastifyInstance } from 'fastify'

vi.mock('../../src/websocket/manager', () => ({ wsManager: { broadcast: vi.fn() } }))

import '../setup'
import { getTestDb } from '../setup'
import { buildTestApp } from '../helpers'
import { wsManager } from '../../src/websocket/manager'

const validBody = {
  symbol: 'AAPL',
  side: 'BUY',
  quantity: 100,
  price: 227.45,
  trader: 'JSMITH',
  book: 'EQUITIES_UK',
  counterparty: 'Goldman Sachs',
  tradeTimestamp: '2026-11-11T09:00:00.000Z',
}

let app: FastifyInstance

beforeAll(async () => {
  app = await buildTestApp()
})

beforeEach(async () => {
  await getTestDb().collection('trades').deleteMany({})
  vi.clearAllMocks()
})

describe('POST /trades', () => {
  it('with valid body returns 201 with the created trade', async () => {
    const res = await app.inject({ method: 'POST', url: '/trades', payload: validBody })
    expect(res.statusCode).toBe(201)
    const trade = JSON.parse(res.body)
    expect(trade.id).toMatch(/^TRD-\d{6}$/)
    expect(trade.status).toBe('ACTIVE')
    expect(trade.symbol).toBe('AAPL')
  })

  it('persists the trade to MongoDB', async () => {
    await app.inject({ method: 'POST', url: '/trades', payload: validBody })
    expect(await getTestDb().collection('trades').countDocuments()).toBe(1)
  })

  it('broadcasts trade:created with the full trade', async () => {
    await app.inject({ method: 'POST', url: '/trades', payload: validBody })
    expect(wsManager.broadcast).toHaveBeenCalledWith(
      'trade:created',
      expect.objectContaining({ status: 'ACTIVE' })
    )
  })

  it('with missing field returns 400 with issues array', async () => {
    const { symbol: _s, ...bodyWithoutSymbol } = validBody
    const res = await app.inject({ method: 'POST', url: '/trades', payload: bodyWithoutSymbol })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).issues).toBeDefined()
  })

  it('with quantity 0 returns 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/trades', payload: { ...validBody, quantity: 0 } })
    expect(res.statusCode).toBe(400)
  })
})
