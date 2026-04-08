import { PostgresStore } from "@mastra/pg"

const postgresUrl = process.env.POSTGRES_URL ||
  (process.env.POSTGRES_HOST
    ? `postgresql://${encodeURIComponent(process.env.POSTGRES_USER || "")}:${encodeURIComponent(process.env.POSTGRES_PASSWORD || "")}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`
    : "postgresql://postgres:password@localhost:5432/skillrelay_development")

async function main() {
  console.log("Initializing Mastra PostgreSQL tables...")

  const isProduction = process.env.NODE_ENV === "production" ||
    postgresUrl.includes("neon.tech") ||
    (!postgresUrl.includes("localhost") && !postgresUrl.includes("127.0.0.1") && !postgresUrl.includes("host.docker.internal") && !postgresUrl.includes("@postgres:"))

  const store = new PostgresStore({
    id: 'skillrelay-init-store',
    connectionString: postgresUrl,
    ...(isProduction && { ssl: { rejectUnauthorized: false } })
  })

  try {
    await store.init()
    console.log("Mastra tables created successfully!")
  } catch (error) {
    console.error("Failed to initialize Mastra tables:", error)
    process.exit(1)
  }

  process.exit(0)
}

main()
