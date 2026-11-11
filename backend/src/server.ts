import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(cors, { origin: true, methods: ['GET', 'POST', 'PATCH'] })
  return app
}
