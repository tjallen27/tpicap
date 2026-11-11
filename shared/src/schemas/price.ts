import { z } from 'zod'

export const PriceUpdateSchema = z.object({
  symbol: z.string(),
  currentPrice: z.number().positive(),
  timestamp: z.string().datetime(),
})

export type PriceUpdate = z.infer<typeof PriceUpdateSchema>

export const PriceUpdateEventSchema = z.array(PriceUpdateSchema)
export type PriceUpdateEvent = z.infer<typeof PriceUpdateEventSchema>
