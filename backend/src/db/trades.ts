import { Trade, AmendTradeInput } from '@tpicap/shared'
import { getDb } from './client'

const col = () => getDb().collection<Trade>('trades')
const projection = { _id: 0 } as const

export async function ensureTradeIndexes(): Promise<void> {
  await col().createIndex({ id: 1 }, { unique: true })
}

export async function findAllTrades(): Promise<Trade[]> {
  return col().find({}, { projection }).sort({ tradeTimestamp: -1 }).toArray() as Promise<Trade[]>
}

export async function findTradeById(id: string): Promise<Trade | null> {
  return col().findOne({ id }, { projection }) as Promise<Trade | null>
}

export async function insertTrade(trade: Trade): Promise<void> {
  await col().insertOne(trade as Trade & { _id?: unknown })
}

export async function patchTrade(id: string, fields: AmendTradeInput): Promise<Trade | null> {
  return col().findOneAndUpdate(
    { id, status: 'ACTIVE' },
    { $set: fields },
    { returnDocument: 'after', projection }
  ) as Promise<Trade | null>
}

export async function setTradeCancelled(id: string): Promise<Trade | null> {
  return col().findOneAndUpdate(
    { id, status: 'ACTIVE' },
    { $set: { status: 'CANCELLED' } },
    { returnDocument: 'after', projection }
  ) as Promise<Trade | null>
}
