import { FastifyRequest, FastifyReply } from 'fastify'
import { findTradeById, setTradeCancelled } from '../db/trades'
import { wsManager } from '../websocket/manager'

export async function cancelTrade(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params

  const result = await setTradeCancelled(id)
  if (result !== null) {
    wsManager.broadcast('trade:cancelled', result)
    return reply.status(200).send(result)
  }

  const existing = await findTradeById(id)
  if (!existing) {
    return reply.status(404).send({ error: 'Trade not found' })
  }

  reply.status(409).send({ error: 'Trade is already cancelled' })
}
