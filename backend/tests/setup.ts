import { MongoMemoryServer } from 'mongodb-memory-server'
import { beforeAll, afterAll } from 'vitest'
import { connectDb, getDb } from '../src/db/client'
import { Db } from 'mongodb'

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await connectDb(mongod.getUri())
})

afterAll(async () => {
  await mongod.stop()
})

export function getTestDb(): Db {
  return getDb()
}
