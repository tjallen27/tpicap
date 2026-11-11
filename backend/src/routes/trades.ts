import { FastifyInstance } from 'fastify'
import { getTrades } from '../handlers/getTrades'
import { createTrade } from '../handlers/createTrade'

export function registerTradeRoutes(app: FastifyInstance): void {
  app.get('/trades', getTrades)
  app.post('/trades', createTrade)
}
