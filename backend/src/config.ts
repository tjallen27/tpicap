export interface Config {
  port: number
  mongodbUri: string
  finnhubApiKey: string | undefined
}

export function parseConfig(): Config {
  const mongodbUri = process.env.MONGODB_URI
  if (!mongodbUri) throw new Error('MONGODB_URI environment variable is required')

  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    mongodbUri,
    finnhubApiKey: process.env.FINNHUB_API_KEY || undefined,
  }
}
