export async function register() {
  // Edge runtime does not support Node.js built-in modules (crypto, net, etc.)
  // that the pg driver requires. Skip DB initialization in Edge context.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { Pool } = await import("pg")

  const connectionString =
    process.env.POSTGRES_URL ||
    `postgresql://${encodeURIComponent(process.env.POSTGRES_USER || "")}:${encodeURIComponent(process.env.POSTGRES_PASSWORD || "")}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`

  const isLocal =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1") ||
    connectionString.includes("host.docker.internal") ||
    connectionString.includes("@postgres:")

  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  })

  try {
    // 1. Rename old-style PK constraint to match @mastra/pg v1.1.0 expectations.
    //    @mastra/pg v1.1.0 expects: public_mastra_ai_spans_traceid_spanid_pk
    //    But the constraint may exist under various names:
    //      - mastra_ai_spans_pkey (default PostgreSQL naming from Rails schema)
    //      - mastra_ai_spans_traceid_spanid_pk (older @mastra/pg versions)
    //    Without this rename, PostgresStore.init() tries to add a second PK
    //    and fails with "multiple primary keys are not allowed".
    await pool.query(`
      DO $$ BEGIN
        -- Skip if the expected constraint already exists
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'public_mastra_ai_spans_traceid_spanid_pk'
        ) THEN
          -- Try renaming from mastra_ai_spans_pkey (Rails default naming)
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'mastra_ai_spans_pkey'
          ) THEN
            ALTER INDEX mastra_ai_spans_pkey
            RENAME TO public_mastra_ai_spans_traceid_spanid_pk;
          -- Try renaming from old @mastra/pg naming
          ELSIF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'mastra_ai_spans_traceid_spanid_pk'
          ) THEN
            ALTER INDEX mastra_ai_spans_traceid_spanid_pk
            RENAME TO public_mastra_ai_spans_traceid_spanid_pk;
          END IF;
        END IF;
      END $$;
    `)

    // 2. Ensure data_knowledge_hearing_qa table exists.
    //    This table is normally created on-demand by the Python worker (LlamaIndex
    //    PGVectorStore) when QA generation first runs. However, the AI server's
    //    query_qa tool queries this table immediately — if no QA generation has
    //    occurred yet, the table is missing and queries fail with a hard error.
    //    Creating it here ensures the AI server can always query safely.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS data_knowledge_hearing_qa (
        id bigserial PRIMARY KEY,
        text varchar NOT NULL,
        metadata_ json,
        node_id varchar,
        embedding vector(1536),
        text_search_tsv tsvector
          GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
      );
    `)
  } catch {
    // Tables may not exist on first deploy — safe to ignore
  } finally {
    await pool.end()
  }
}
