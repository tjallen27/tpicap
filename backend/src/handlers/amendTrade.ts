import { FastifyRequest, FastifyReply } from 'fastify'
import { AmendTradeSchema } from '@tpicap/shared'
import { findTradeById, patchTrade } from '../db/trades'
import { wsManager } from '../websocket/manager'

const IMMUTABLE_FIELDS = ['id', 'symbol', 'side', 'tradeTimestamp', 'status']

export async function amendTrade(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<void> {
  const { id } = request.params
  const body = request.body as Record<string, unknown>

  const invalidFields = Object.keys(body).filter(k => IMMUTABLE_FIELDS.includes(k))
  if (invalidFields.length > 0) {
    return reply.status(400).send({ error: 'Invalid fields', fields: invalidFields })
  }

  const result = AmendTradeSchema.safeParse(body)
  if (!result.success) {
    return reply.status(400).send({ error: 'Validation failed', issues: result.error.issues })
  }

  const existing = await findTradeById(id)
  if (!existing) {
    return reply.status(404).send({ error: 'Trade not found' })
  }

  if (existing.status === 'CANCELLED') {
    return reply.status(409).send({ error: 'Trade is cancelled' })
  }

  const updated = await patchTrade(id, result.data)
  wsManager.broadcast('trade:amended', updated)
  reply.status(200).send(updated)
}
