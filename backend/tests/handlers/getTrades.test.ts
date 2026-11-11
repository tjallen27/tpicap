import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { FastifyInstance } from 'fastify'
import '../setup'
import { getTestDb } from '../setup'
import { buildTestApp } from '../helpers'
import { insertTrade } from '../../src/db/trades'
import { Trade, TradeSchema } from '@tpicap/shared'

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
})

describe('GET /trades', () => {
  it('returns 200 with empty trades array', async () => {
    const res = await app.inject({ method: 'GET', url: '/trades' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ trades: [] })
  })

  it('returns all trades sorted by tradeTimestamp descending', async () => {
    await insertTrade({ ...baseTrade, id: 'TRD-100001', tradeTimestamp: '2026-11-10T09:00:00.000Z' })
    await insertTrade({ ...baseTrade, id: 'TRD-100002', tradeTimestamp: '2026-11-10T10:00:00.000Z' })
    const res = await app.inject({ method: 'GET', url: '/trades' })
    const { trades } = JSON.parse(res.body)
    expect(trades[0].id).toBe('TRD-100002')
    expect(trades[1].id).toBe('TRD-100001')
  })

  it('each trade in response passes TradeSchema', async () => {
    await insertTrade(baseTrade)
    const { trades } = JSON.parse((await app.inject({ method: 'GET', url: '/trades' })).body)
    trades.forEach((t: unknown) => expect(TradeSchema.safeParse(t).success).toBe(true))
  })
})
