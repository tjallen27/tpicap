export class PriceSimulator {
  private prices: Record<string, number>

  constructor(basePrices: Record<string, number>) {
    this.prices = { ...basePrices }
  }

  tick(): void {
    for (const symbol of Object.keys(this.prices)) {
      const current = this.prices[symbol]
      const next = parseFloat((current + current * (Math.random() * 0.01 - 0.005)).toFixed(2))
      if (next > 0) {
        this.prices[symbol] = next
      }
    }
  }

  getPrices(): Record<string, number> {
    return { ...this.prices }
  }

  getPrice(symbol: string): number {
    return this.prices[symbol]
  }
}
