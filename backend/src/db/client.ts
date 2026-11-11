import { MongoClient, Db } from 'mongodb'

let db: Db | null = null

export async function connectDb(uri: string): Promise<Db> {
  const client = new MongoClient(uri)
  await client.connect()
  db = client.db()
  return db
}

export function getDb(): Db {
  if (!db) throw new Error('DB not connected')
  return db
}
