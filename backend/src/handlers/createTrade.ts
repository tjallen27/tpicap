import { FastifyRequest, FastifyReply } from 'fastify'
import { CreateTradeSchema, Trade } from '@tpicap/shared'
import { insertTrade } from '../db/trades'
import { wsManager } from '../websocket/manager'

function generateTradeId(): string {
  return `TRD-${Math.floor(100000 + Math.random() * 900000)}`
}

export async function createTrade(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const result = CreateTradeSchema.safeParse(request.body)
  if (!result.success) {
    return reply.status(400).send({ error: 'Validation failed', issues: result.error.issues })
  }

  let trade: Trade | null = null
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate: Trade = { ...result.data, id: generateTradeId(), status: 'ACTIVE' }
    try {
      await insertTrade(candidate)
      trade = candidate
      break
    } catch (err: any) {
      if (err.code !== 11000 || attempt === 9) throw err
    }
  }

  wsManager.broadcast('trade:created', trade!)
  reply.status(201).send(trade!)
}
