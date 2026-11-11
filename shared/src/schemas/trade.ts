import { z } from 'zod'

export const TradeSchema = z.object({
  id: z.string().regex(/^TRD-\d{6}$/),
  symbol: z.string().min(1).max(10),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
  trader: z.string().min(1),
  book: z.string().min(1),
  counterparty: z.string().min(1),
  tradeTimestamp: z.string().datetime(),
  status: z.enum(['ACTIVE', 'CANCELLED']),
})

export type Trade = z.infer<typeof TradeSchema>

export const CreateTradeSchema = TradeSchema.omit({ id: true, status: true })
export type CreateTradeInput = z.infer<typeof CreateTradeSchema>

export const AmendTradeSchema = TradeSchema
  .pick({ quantity: true, price: true, trader: true, book: true, counterparty: true })
  .partial()
export type AmendTradeInput = z.infer<typeof AmendTradeSchema>
