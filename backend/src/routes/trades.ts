import { FastifyInstance } from 'fastify'
import { getTrades } from '../handlers/getTrades'

export function registerTradeRoutes(app: FastifyInstance): void {
  app.get('/trades', getTrades)
}
