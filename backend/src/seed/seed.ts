import { Trade } from '@tpicap/shared'
import { getDb } from '../db/client'
import { BASE_PRICES } from '../prices/symbolPool'

export { BASE_PRICES }

const SYMBOLS = Object.keys(BASE_PRICES)
const TRADERS = ['JSMITH', 'ABROWN', 'MJONES', 'KDAVIS', 'LWILSON']
const BOOKS = ['EQUITIES_UK', 'EQUITIES_US', 'TECH_GROWTH', 'FIXED_INCOME', 'FX_DESK']
const COUNTERPARTIES = ['Goldman Sachs', 'JP Morgan', 'Morgan Stanley', 'Barclays', 'Deutsche Bank']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateSeedTrades(): Trade[] {
  const now = Date.now()
  const eightHoursMs = 8 * 60 * 60 * 1000

  return Array.from({ length: 100 }, (_, i) => {
    const index = i + 1
    const symbol = SYMBOLS[i % SYMBOLS.length]
    const basePrice = BASE_PRICES[symbol]
    const price = parseFloat((basePrice * (1 + (Math.random() * 0.08 - 0.04))).toFixed(2))
    const tradeTimestamp = new Date(now - Math.random() * eightHoursMs).toISOString()

    return {
      id: `TRD-10${String(index).padStart(4, '0')}`,
      symbol,
      side: Math.random() > 0.5 ? 'BUY' : 'SELL',
      quantity: Math.floor(Math.random() * 950 + 50) * 10,
      price,
      trader: pick(TRADERS),
      book: pick(BOOKS),
      counterparty: pick(COUNTERPARTIES),
      tradeTimestamp,
      status: Math.random() < 0.2 ? 'CANCELLED' : 'ACTIVE',
    } satisfies Trade
  })
}

export async function seedIfEmpty(): Promise<void> {
  const count = await getDb().collection('trades').countDocuments()
  if (count === 0) {
    const trades = generateSeedTrades()
    await getDb().collection('trades').insertMany(trades as Array<Trade & { _id?: unknown }>)
  }
}
