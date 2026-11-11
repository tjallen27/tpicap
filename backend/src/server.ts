import Fastify, { FastifyInstance } from 'fastify'

export function createApp(): FastifyInstance {
  return Fastify({ logger: false })
}
