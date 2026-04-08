import { Pool } from 'pg'
import { config } from '../config'
import { getTextEmbedding } from '../services/embedding-service'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.postgres.url,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    })
  }
  return pool
}

export interface VectorSearchResult {
  id: string
  text: string
  metadata: Record<string, unknown>
  similarity: number
}

export type SearchMode = 'vector' | 'text' | 'hybrid'

export interface SearchOptions {
  topicId?: string
  requestId?: string
  fileIds?: string[]
  similarityTopK?: number
  mode?: SearchMode
  textWeight?: number
  vectorWeight?: number
}

export async function searchVectors(
  query: string,
  options: SearchOptions = {}
): Promise<VectorSearchResult[]> {
  const {
    topicId,
    requestId,
    fileIds,
    similarityTopK = config.rag.similarityTopK,
    mode = 'hybrid',
    textWeight = 0.3,
    vectorWeight = 0.7,
  } = options

  const pool = getPool()

  if (mode === 'text') {
    return searchByText(pool, query, { topicId, requestId, fileIds, similarityTopK })
  }

  if (mode === 'vector') {
    return searchByVector(pool, query, { topicId, requestId, fileIds, similarityTopK })
  }

  return searchHybrid(pool, query, { topicId, requestId, fileIds, similarityTopK, textWeight, vectorWeight })
}

async function searchByVector(
  pool: Pool,
  query: string,
  options: { topicId?: string; requestId?: string; fileIds?: string[]; similarityTopK: number }
): Promise<VectorSearchResult[]> {
  const { topicId, requestId, fileIds, similarityTopK } = options

  const queryEmbedding = await getTextEmbedding(query)
  const embeddingStr = '[' + queryEmbedding.join(',') + ']'

  let sql = `
    SELECT
      id,
      text,
      metadata_,
      1 - (embedding <=> $1::vector) as similarity
    FROM ${config.postgres.embeddingsTable}
    WHERE 1=1
  `
  const params: unknown[] = [embeddingStr]
  let paramIndex = 2

  if (fileIds && fileIds.length > 0) {
    const placeholders = fileIds.map((_, i) => `$${paramIndex + i}`).join(', ')
    sql += ` AND (metadata_::jsonb->>'_node_content')::jsonb->'metadata'->>'document_id' IN (${placeholders})`
    params.push(...fileIds)
    paramIndex += fileIds.length
  } else if (topicId) {
    if (process.env.USE_NEW_TOPIC_LINKS === 'true') {
      sql += ` AND (metadata_::jsonb->>'_node_content')::jsonb->'metadata'->>'document_id' IN (
        SELECT data_source_file_id FROM topic_data_source_links WHERE topic_id = $${paramIndex}
      )`
    } else {
      sql += ` AND metadata_->>'topic_id' = $${paramIndex}`
    }
    params.push(topicId)
    paramIndex++
  }

  if (requestId) {
    sql += ` AND metadata_->>'request_id' = $${paramIndex}`
    params.push(requestId)
    paramIndex++
  }

  sql += `
    ORDER BY embedding <=> $1::vector
    LIMIT $${paramIndex}
  `
  params.push(similarityTopK)

  const result = await pool.query(sql, params)

  return result.rows.map((row) => ({
    id: row.id,
    text: row.text,
    metadata: row.metadata_ || {},
    similarity: parseFloat(row.similarity),
  }))
}

async function searchByText(
  pool: Pool,
  query: string,
  options: { topicId?: string; requestId?: string; fileIds?: string[]; similarityTopK: number }
): Promise<VectorSearchResult[]> {
  const { topicId, requestId, fileIds, similarityTopK } = options

  let sql = `
    SELECT
      id,
      text,
      metadata_,
      ts_rank_cd(text_search_tsv, plainto_tsquery('english', $1)) as similarity
    FROM ${config.postgres.embeddingsTable}
    WHERE text_search_tsv @@ plainto_tsquery('english', $1)
  `
  const params: unknown[] = [query]
  let paramIndex = 2

  if (fileIds && fileIds.length > 0) {
    const placeholders = fileIds.map((_, i) => `$${paramIndex + i}`).join(', ')
    sql += ` AND (metadata_::jsonb->>'_node_content')::jsonb->'metadata'->>'document_id' IN (${placeholders})`
    params.push(...fileIds)
    paramIndex += fileIds.length
  } else if (topicId) {
    if (process.env.USE_NEW_TOPIC_LINKS === 'true') {
      sql += ` AND (metadata_::jsonb->>'_node_content')::jsonb->'metadata'->>'document_id' IN (
        SELECT data_source_file_id FROM topic_data_source_links WHERE topic_id = $${paramIndex}
      )`
    } else {
      sql += ` AND metadata_->>'topic_id' = $${paramIndex}`
    }
    params.push(topicId)
    paramIndex++
  }

  if (requestId) {
    sql += ` AND metadata_->>'request_id' = $${paramIndex}`
    params.push(requestId)
    paramIndex++
  }

  sql += `
    ORDER BY similarity DESC
    LIMIT $${paramIndex}
  `
  params.push(similarityTopK)

  const result = await pool.query(sql, params)

  return result.rows.map((row) => ({
    id: row.id,
    text: row.text,
    metadata: row.metadata_ || {},
    similarity: parseFloat(row.similarity),
  }))
}

async function searchHybrid(
  pool: Pool,
  query: string,
  options: {
    topicId?: string
    requestId?: string
    fileIds?: string[]
    similarityTopK: number
    textWeight: number
    vectorWeight: number
  }
): Promise<VectorSearchResult[]> {
  const { topicId, requestId, fileIds, similarityTopK, textWeight, vectorWeight } = options

  const queryEmbedding = await getTextEmbedding(query)
  const embeddingStr = '[' + queryEmbedding.join(',') + ']'

  let filterClause = ''
  const params: unknown[] = [embeddingStr, query, vectorWeight, textWeight]
  let paramIndex = 5

  if (fileIds && fileIds.length > 0) {
    const placeholders = fileIds.map((_, i) => `$${paramIndex + i}`).join(', ')
    filterClause += ` AND (metadata_::jsonb->>'_node_content')::jsonb->'metadata'->>'document_id' IN (${placeholders})`
    params.push(...fileIds)
    paramIndex += fileIds.length
  } else if (topicId) {
    if (process.env.USE_NEW_TOPIC_LINKS === 'true') {
      filterClause += ` AND (metadata_::jsonb->>'_node_content')::jsonb->'metadata'->>'document_id' IN (
        SELECT data_source_file_id FROM topic_data_source_links WHERE topic_id = $${paramIndex}
      )`
    } else {
      filterClause += ` AND metadata_->>'topic_id' = $${paramIndex}`
    }
    params.push(topicId)
    paramIndex++
  }

  if (requestId) {
    filterClause += ` AND metadata_->>'request_id' = $${paramIndex}`
    params.push(requestId)
    paramIndex++
  }

  const sql = `
    WITH vector_search AS (
      SELECT
        id,
        text,
        metadata_,
        1 - (embedding <=> $1::vector) as vector_score,
        ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) as vector_rank
      FROM ${config.postgres.embeddingsTable}
      WHERE 1=1 ${filterClause}
      ORDER BY embedding <=> $1::vector
      LIMIT $${paramIndex}
    ),
    text_search AS (
      SELECT
        id,
        ts_rank_cd(text_search_tsv, plainto_tsquery('english', $2)) as text_score,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(text_search_tsv, plainto_tsquery('english', $2)) DESC) as text_rank
      FROM ${config.postgres.embeddingsTable}
      WHERE text_search_tsv @@ plainto_tsquery('english', $2) ${filterClause}
      ORDER BY text_score DESC
      LIMIT $${paramIndex}
    )
    SELECT
      v.id,
      v.text,
      v.metadata_,
      (
        $3::float * COALESCE(v.vector_score, 0) +
        $4::float * COALESCE(t.text_score, 0)
      ) as similarity
    FROM vector_search v
    LEFT JOIN text_search t ON v.id = t.id
    ORDER BY similarity DESC
    LIMIT $${paramIndex}
  `
  params.push(similarityTopK)

  const result = await pool.query(sql, params)

  return result.rows.map((row) => ({
    id: row.id,
    text: row.text,
    metadata: row.metadata_ || {},
    similarity: parseFloat(row.similarity),
  }))
}

export async function closeVectorStore(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
