import { PgVector, PostgresStore } from "@mastra/pg"

const postgresUrl = process.env.POSTGRES_URL || `postgresql://${encodeURIComponent(process.env.POSTGRES_USER || "")}:${encodeURIComponent(process.env.POSTGRES_PASSWORD || "")}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`

if (!postgresUrl) {
  throw new Error("POSTGRES_URL環境変数が設定されていません")
}

// Determine if SSL should be used based on the database URL, not NODE_ENV
// Local/Docker databases don't need SSL, but cloud databases (like neon.tech) do
const isLocalDatabase =
  postgresUrl.includes("localhost") ||
  postgresUrl.includes("127.0.0.1") ||
  postgresUrl.includes("host.docker.internal") ||
  postgresUrl.includes("@postgres:")

const requiresSsl = !isLocalDatabase || postgresUrl.includes("neon.tech")

const globalForStorage = globalThis as unknown as {
  postgresStore: PostgresStore | undefined
  vectorStore: PgVector | undefined
}

function getPostgresStore(): PostgresStore {
  if (!globalForStorage.postgresStore) {
    globalForStorage.postgresStore = new PostgresStore({
      id: 'skillrelay-postgres-store',
      connectionString: postgresUrl,
      ssl: requiresSsl ? { rejectUnauthorized: false } : false
    })
  }
  return globalForStorage.postgresStore
}

function getVectorStore(): PgVector {
  if (!globalForStorage.vectorStore) {
    globalForStorage.vectorStore = new PgVector({
      id: 'skillrelay-vector-store',
      connectionString: postgresUrl,
      ssl: requiresSsl ? { rejectUnauthorized: false } : false
    })
  }
  return globalForStorage.vectorStore
}

function createLazyProxy<T extends object>(getter: () => T): T {
  let instance: T | null = null
  return new Proxy({} as T, {
    get(_target, prop) {
      if (!instance) {
        instance = getter()
      }
      const value = (instance as Record<string | symbol, unknown>)[prop]
      return typeof value === 'function' ? value.bind(instance) : value
    },
    set(_target, prop, value) {
      if (!instance) {
        instance = getter()
      }
      (instance as Record<string | symbol, unknown>)[prop] = value
      return true
    }
  })
}

export const postgresStore = createLazyProxy(getPostgresStore)
export const vectorStore = createLazyProxy(getVectorStore)
