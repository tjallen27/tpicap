import finnhub from 'finnhub'

export async function fetchFinnhubPrices(
  symbols: string[],
  apiKey: string
): Promise<Record<string, number>> {
  const client = new finnhub.DefaultApi(apiKey)

  const results = await Promise.allSettled(
    symbols.map(
      symbol =>
        new Promise<{ symbol: string; price: number }>((resolve, reject) => {
          client.quote(symbol, (error: Error | null, data: { c: number } | null) => {
            if (error || !data) return reject(error ?? new Error('No data'))
            resolve({ symbol, price: data.c })
          })
        })
    )
  )

  const prices: Record<string, number> = {}
  for (const result of results) {
    if (result.status === 'fulfilled') {
      prices[result.value.symbol] = result.value.price
    }
  }
  return prices
}
