import { describe, it, expect, beforeEach } from 'vitest'
import { parseConfig } from '../src/config'

beforeEach(() => {
  process.env.PORT = '3000'
  process.env.MONGODB_URI = 'mongodb://localhost/test'
  delete process.env.FINNHUB_API_KEY
})

describe('parseConfig', () => {
  it('reads PORT, MONGODB_URI, FINNHUB_API_KEY from env', () => {
    process.env.PORT = '4000'
    process.env.MONGODB_URI = 'mongodb://localhost/test'
    process.env.FINNHUB_API_KEY = 'key123'
    const config = parseConfig()
    expect(config.port).toBe(4000)
    expect(config.mongodbUri).toBe('mongodb://localhost/test')
    expect(config.finnhubApiKey).toBe('key123')
  })

  it('finnhubApiKey is undefined when env var is unset', () => {
    delete process.env.FINNHUB_API_KEY
    expect(parseConfig().finnhubApiKey).toBeUndefined()
  })

  it('defaults PORT to 3000 when not set', () => {
    delete process.env.PORT
    expect(parseConfig().port).toBe(3000)
  })

  it('throws when MONGODB_URI is not set', () => {
    delete process.env.MONGODB_URI
    expect(() => parseConfig()).toThrow()
  })
})
