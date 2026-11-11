import { FastifyInstance } from 'fastify'
import { createApp } from '../src/server'
import { registerTradeRoutes } from '../src/routes/trades'

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = createApp()
  registerTradeRoutes(app)
  await app.ready()
  return app
}
