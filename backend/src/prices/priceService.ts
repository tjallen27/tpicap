import { PriceSimulator } from './simulator'
import { BASE_PRICES } from './symbolPool'
import { fetchFinnhubPrices } from './finnhub'

type BroadcastFn = (event: string, payload: unknown) => void

export function startPriceService(
  broadcast: BroadcastFn,
  options: { finnhubApiKey?: string }
): () => void {
  let simulator = new PriceSimulator({ ...BASE_PRICES })

  if (options.finnhubApiKey) {
    const key = options.finnhubApiKey
    fetchFinnhubPrices(Object.keys(BASE_PRICES), key).then(finnhubPrices => {
      const merged = { ...BASE_PRICES }
      for (const [symbol, price] of Object.entries(finnhubPrices)) {
        if (price > 0) merged[symbol] = price
      }
      simulator = new PriceSimulator(merged)
    }).catch(() => {})
  }

  const intervalId = setInterval(() => {
    simulator.tick()
    const prices = simulator.getPrices()
    const timestamp = new Date().toISOString()
    const updates = Object.entries(prices).map(([symbol, currentPrice]) => ({
      symbol,
      currentPrice,
      timestamp,
    }))
    broadcast('price:updated', updates)
  }, 3000)

  return () => clearInterval(intervalId)
}
