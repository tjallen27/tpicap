import { FastifyRequest, FastifyReply } from 'fastify'
import { findAllTrades } from '../db/trades'

export async function getTrades(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const trades = await findAllTrades()
  reply.send({ trades })
}
