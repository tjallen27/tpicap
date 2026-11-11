import { parseConfig } from './config'
import { connectDb } from './db/client'
import { ensureTradeIndexes } from './db/trades'
import { createApp } from './server'
import { registerWsPlugin } from './websocket/plugin'
import { wsManager } from './websocket/manager'
import { registerTradeRoutes } from './routes/trades'
import { seedIfEmpty } from './seed/seed'
import { startPriceService } from './prices/priceService'

async function main(): Promise<void> {
  const config = parseConfig()

  await connectDb(config.mongodbUri)
  await ensureTradeIndexes()

  const app = await createApp()

  await registerWsPlugin(app)
  registerTradeRoutes(app)

  await app.ready()
  await seedIfEmpty()

  startPriceService(
    (event, payload) => wsManager.broadcast(event, payload),
    { finnhubApiKey: config.finnhubApiKey }
  )

  await app.listen({ port: config.port, host: '0.0.0.0' })
  console.log(`Backend listening on port ${config.port}`)
}

main().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
