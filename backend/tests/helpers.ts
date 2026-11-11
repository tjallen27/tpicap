import { FastifyInstance } from 'fastify'
import { createApp } from '../src/server'

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = createApp()
  await app.ready()
  return app
}
