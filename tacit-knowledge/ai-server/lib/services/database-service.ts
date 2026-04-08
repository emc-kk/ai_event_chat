import { Pool } from 'pg'
import { config } from '../config'
import type { RequestData, TopicData } from '../types'

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

export async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const pool = getPool()
  const result = await pool.query(sql, params)
  return result.rows as T[]
}

export async function getRequestData(
  requestId: string,
  getAllContents = false
): Promise<RequestData | null> {
  const requestQuery = `
    SELECT
      r.id as request_id,
      r.name as request_name,
      r.description as request_description,

      r.topic_id,
      t.name as topic_name,
      t.description as topic_description
    FROM requests r
    LEFT JOIN topics t ON r.topic_id = t.id
    WHERE r.id = $1
    LIMIT 1
  `

  const results = await query<{
    request_id: string
    request_name: string | null
    request_description: string | null

    topic_id: string
    topic_name: string | null
    topic_description: string | null
  }>(requestQuery, [requestId])

  if (!results || results.length === 0) {
    return null
  }

  const row = results[0]

  let requestContext = ''
  if (getAllContents) {
    const contentQuery = `
      SELECT context, created_at
      FROM request_contents
      WHERE request_id = $1
      ORDER BY created_at ASC
    `
    const contentResults = await query<{ context: string | null; created_at: Date }>(
      contentQuery,
      [requestId]
    )

    if (contentResults && contentResults.length > 0) {
      const contexts = contentResults
        .map((r, idx) => r.context ? `${idx + 1}. ${r.context}` : null)
        .filter(Boolean)
      requestContext = contexts.join('\n\n')
    }
  } else {
    const contentQuery = `
      SELECT context
      FROM request_contents
      WHERE request_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `
    const contentResults = await query<{ context: string | null }>(contentQuery, [requestId])

    if (contentResults && contentResults.length > 0) {
      requestContext = contentResults[0].context || ''
    }
  }

  return {
    id: row.request_id,
    name: row.request_name || '',
    description: row.request_description || '',
    context: requestContext,
    topicId: row.topic_id,
    topicName: row.topic_name || '',
    topicDescription: row.topic_description || '',
  }
}

export async function getTopicDataById(topicId: string): Promise<TopicData | null> {
  const results = await query<{
    id: string
    name: string | null
    description: string | null
    company_id: string | null
  }>(
    `
    SELECT id, name, description, company_id
    FROM topics
    WHERE id = $1 AND deleted_at IS NULL
    LIMIT 1
  `,
    [topicId]
  )

  if (!results || results.length === 0) {
    return null
  }

  const row = results[0]
  return {
    id: row.id,
    name: row.name || '',
    description: row.description || '',
    companyId: row.company_id || undefined,
  }
}

export async function getMatchingGlossaryTerms(
  companyId: string,
  text: string
): Promise<Array<{ term: string; definition: string }>> {
  if (!text || !companyId) return []

  const results = await query<{ term: string; definition: string }>(
    `
    SELECT term, definition
    FROM company_glossary_terms
    WHERE company_id = $1 AND position(term IN $2) > 0
    ORDER BY length(term) DESC
  `,
    [companyId, text]
  )

  return results || []
}

export async function getTopicRequestsData(
  topicId: string
): Promise<Array<{ id: string; name: string; description: string }>> {
  const results = await query<{
    id: string
    name: string | null
    description: string | null

  }>(
    `
    SELECT id, name, description
    FROM requests
    WHERE topic_id = $1 AND deleted_at IS NULL AND request_type = 0
  `,
    [topicId]
  )

  return (results || []).map((row) => ({
    id: row.id,
    name: row.name || '',
    description: row.description || '',
  }))
}
