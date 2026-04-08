export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    chatModel: process.env.OPENAI_MODEL || 'gpt-5-mini',
    embeddingDimension: 1536,
  },
  cohere: {
    apiKey: process.env.COHERE_API_KEY || '',
    rerankModel: 'rerank-multilingual-v3.0',
    rerankTopN: 5,
  },
  postgres: {
    url: process.env.POSTGRES_URL || buildPostgresUrl(),
    embeddingsTable: 'data_knowledge_documents',
  },
  s3: {
    region: process.env.AWS_REGION || 'ap-northeast-1',
    bucket: process.env.AWS_S3_BUCKET || '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  rag: {
    similarityTopK: 10,
    chunkSize: 1024,
    chunkOverlap: 200,
  },
  memory: {
    tokenLimit: 30000,
    chatHistoryRatio: 0.7,
    lastMessages: 40,
  },
  agent: {
    maxIterations: 10,
  },
} as const

function buildPostgresUrl(): string {
  const user = process.env.POSTGRES_USER || 'postgres'
  const password = process.env.POSTGRES_PASSWORD || ''
  const host = process.env.POSTGRES_HOST || 'localhost'
  const port = process.env.POSTGRES_PORT || '5432'
  const db = process.env.POSTGRES_DB || 'skillrelay'

  return `postgresql://${user}:${password}@${host}:${port}/${db}`
}

export type Config = typeof config
