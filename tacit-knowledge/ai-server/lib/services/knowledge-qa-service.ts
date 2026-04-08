import { query } from './database-service'
import type { KnowledgeQaRow } from '../types'

interface QaDbRow {
  [key: string]: unknown
  id: string
  question: string
  keyword_category: string
  question_intent: string
  related_situation: string
  answer: string
  row_index: number
}

/**
 * Safely execute a QA query. Returns empty array if the table doesn't exist
 * (e.g. before QA generation has ever run in a fresh environment).
 */
async function safeQaQuery<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[]
): Promise<T[]> {
  try {
    return await query<T>(sql, params)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('relation') && msg.includes('does not exist')) {
      console.warn('[KnowledgeQaService] data_knowledge_hearing_qa table does not exist yet — returning empty results')
      return []
    }
    throw error
  }
}

export async function getQaByRequestId(requestId: string): Promise<KnowledgeQaRow[]> {
  const sql = `
    SELECT
      id,
      text as question,
      metadata_->>'keyword_category' as keyword_category,
      metadata_->>'question_intent' as question_intent,
      metadata_->>'related_situation' as related_situation,
      metadata_->>'answer' as answer,
      (metadata_->>'row_index')::int as row_index
    FROM data_knowledge_hearing_qa
    WHERE metadata_->>'request_id' = $1
    ORDER BY (metadata_->>'row_index')::int
  `

  const results = await safeQaQuery<QaDbRow>(sql, [requestId])

  return results.map((row) => ({
    id: row.id,
    question: row.question || '',
    keywordCategory: row.keyword_category || '',
    questionIntent: row.question_intent || '',
    relatedSituation: row.related_situation || '',
    answer: row.answer || '',
    rowIndex: row.row_index,
  }))
}

export async function searchQaByVector(
  requestId: string,
  queryEmbedding: number[],
  topK: number = 5
): Promise<KnowledgeQaRow[]> {
  const embeddingStr = '[' + queryEmbedding.join(',') + ']'

  const sql = `
    SELECT
      id,
      text as question,
      metadata_->>'keyword_category' as keyword_category,
      metadata_->>'question_intent' as question_intent,
      metadata_->>'related_situation' as related_situation,
      metadata_->>'answer' as answer,
      (metadata_->>'row_index')::int as row_index,
      embedding <=> $2::vector as distance
    FROM data_knowledge_hearing_qa
    WHERE metadata_->>'request_id' = $1
    ORDER BY embedding <=> $2::vector
    LIMIT $3
  `

  const results = await safeQaQuery<QaDbRow & { distance: number }>(sql, [
    requestId,
    embeddingStr,
    topK,
  ])

  return results.map((row) => ({
    id: row.id,
    question: row.question || '',
    keywordCategory: row.keyword_category || '',
    questionIntent: row.question_intent || '',
    relatedSituation: row.related_situation || '',
    answer: row.answer || '',
    rowIndex: row.row_index,
  }))
}

export async function searchQaByText(
  requestId: string,
  searchText: string,
  topK: number = 5
): Promise<KnowledgeQaRow[]> {
  // tsvector full-text search using plainto_tsquery
  const sql = `
    SELECT
      id,
      text as question,
      metadata_->>'keyword_category' as keyword_category,
      metadata_->>'question_intent' as question_intent,
      metadata_->>'related_situation' as related_situation,
      metadata_->>'answer' as answer,
      (metadata_->>'row_index')::int as row_index,
      ts_rank(text_search_tsv, plainto_tsquery('english', $2)) as rank
    FROM data_knowledge_hearing_qa
    WHERE metadata_->>'request_id' = $1
      AND text_search_tsv @@ plainto_tsquery('english', $2)
    ORDER BY rank DESC
    LIMIT $3
  `

  const results = await safeQaQuery<QaDbRow & { rank: number }>(sql, [
    requestId,
    searchText,
    topK,
  ])

  return results.map((row) => ({
    id: row.id,
    question: row.question || '',
    keywordCategory: row.keyword_category || '',
    questionIntent: row.question_intent || '',
    relatedSituation: row.related_situation || '',
    answer: row.answer || '',
    rowIndex: row.row_index,
  }))
}

export async function searchQaHybrid(
  requestId: string,
  queryEmbedding: number[],
  searchText: string,
  topK: number = 5,
  vectorWeight: number = 0.7
): Promise<KnowledgeQaRow[]> {
  const embeddingStr = '[' + queryEmbedding.join(',') + ']'
  const textWeight = 1 - vectorWeight

  // Hybrid search combining vector similarity and text search
  // Normalize vector distance (0-2 range for cosine) to 0-1 score
  // Combine with tsvector rank
  const sql = `
    WITH vector_scores AS (
      SELECT
        id,
        1 - (embedding <=> $2::vector) / 2 as vector_score
      FROM data_knowledge_hearing_qa
      WHERE metadata_->>'request_id' = $1
    ),
    text_scores AS (
      SELECT
        id,
        COALESCE(ts_rank(text_search_tsv, plainto_tsquery('english', $3)), 0) as text_score
      FROM data_knowledge_hearing_qa
      WHERE metadata_->>'request_id' = $1
    )
    SELECT
      q.id,
      q.text as question,
      q.metadata_->>'keyword_category' as keyword_category,
      q.metadata_->>'question_intent' as question_intent,
      q.metadata_->>'related_situation' as related_situation,
      q.metadata_->>'answer' as answer,
      (q.metadata_->>'row_index')::int as row_index,
      (COALESCE(v.vector_score, 0) * $4 + COALESCE(t.text_score, 0) * $5) as combined_score
    FROM data_knowledge_hearing_qa q
    LEFT JOIN vector_scores v ON q.id = v.id
    LEFT JOIN text_scores t ON q.id = t.id
    WHERE q.metadata_->>'request_id' = $1
    ORDER BY combined_score DESC
    LIMIT $6
  `

  const results = await safeQaQuery<QaDbRow & { combined_score: number }>(sql, [
    requestId,
    embeddingStr,
    searchText,
    vectorWeight,
    textWeight,
    topK,
  ])

  return results.map((row) => ({
    id: row.id,
    question: row.question || '',
    keywordCategory: row.keyword_category || '',
    questionIntent: row.question_intent || '',
    relatedSituation: row.related_situation || '',
    answer: row.answer || '',
    rowIndex: row.row_index,
  }))
}


export async function deleteQaByRequestId(requestId: string): Promise<boolean> {
  const sql = `
    DELETE FROM data_knowledge_hearing_qa
    WHERE metadata_->>'request_id' = $1
  `

  try {
    await safeQaQuery(sql, [requestId])
    return true
  } catch (error) {
    console.error('Error deleting QA data:', error)
    return false
  }
}

export interface QaInsertRow {
  question: string
  keywordCategory: string
  questionIntent: string
  relatedSituation: string
  answer: string
}

export async function upsertQaRows(
  requestId: string,
  rows: QaInsertRow[],
  embeddings: number[][]
): Promise<number> {
  await deleteQaByRequestId(requestId)

  // Ensure table exists
  await query(`
    CREATE TABLE IF NOT EXISTS data_knowledge_hearing_qa (
      id bigserial PRIMARY KEY,
      text varchar NOT NULL,
      metadata_ json,
      node_id varchar,
      embedding vector(1536),
      text_search_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
    )
  `, [])

  let inserted = 0
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const embedding = embeddings[i]
    const embeddingStr = '[' + embedding.join(',') + ']'
    const metadata = {
      request_id: requestId,
      row_index: i,
      keyword_category: row.keywordCategory,
      question_intent: row.questionIntent,
      related_situation: row.relatedSituation,
      answer: row.answer,
    }

    await query(
      `INSERT INTO data_knowledge_hearing_qa (text, metadata_, node_id, embedding)
       VALUES ($1, $2::json, $3, $4::vector)`,
      [row.question, JSON.stringify(metadata), `qa-${requestId}-${i}`, embeddingStr]
    )
    inserted++
  }

  return inserted
}
