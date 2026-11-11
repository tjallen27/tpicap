import { MongoMemoryServer } from 'mongodb-memory-server'
import { beforeAll, afterAll } from 'vitest'
import { connectDb, getDb } from '../src/db/client'
import { ensureTradeIndexes } from '../src/db/trades'
import { Db } from 'mongodb'

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await connectDb(mongod.getUri())
  await ensureTradeIndexes()
})

afterAll(async () => {
  await mongod.stop()
})

export function getTestDb(): Db {
  return getDb()
}
