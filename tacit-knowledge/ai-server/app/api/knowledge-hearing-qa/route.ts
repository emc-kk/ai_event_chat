import { NextRequest, NextResponse } from 'next/server'
import { getQaByRequestId, upsertQaRows } from '../../../lib/services/knowledge-qa-service'
import { getTextEmbeddingBatch } from '../../../lib/services/embedding-service'
import type { KnowledgeQaResponse } from '../../../lib/types'
import type { QaInsertRow } from '../../../lib/services/knowledge-qa-service'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const requestId = searchParams.get('request_id')

  if (!requestId) {
    return NextResponse.json({ error: 'request_id is required' }, { status: 400 })
  }

  try {
    const qaData = await getQaByRequestId(requestId)

    const response: KnowledgeQaResponse = {
      data: qaData,
      total: qaData.length,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching QA data:', error)
    return NextResponse.json({ error: 'Failed to fetch QA data' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { request_id, qa_pairs } = body as {
      request_id: string
      qa_pairs: Array<{
        question: string
        answer: string
        keyword_category?: string
        question_intent?: string
        related_situation?: string
      }>
    }

    if (!request_id) {
      return NextResponse.json({ error: 'request_id is required' }, { status: 400 })
    }

    if (!qa_pairs || !Array.isArray(qa_pairs) || qa_pairs.length === 0) {
      return NextResponse.json({ error: 'qa_pairs array is required and must not be empty' }, { status: 400 })
    }

    const rows: QaInsertRow[] = qa_pairs.map(pair => ({
      question: pair.question,
      answer: pair.answer,
      keywordCategory: pair.keyword_category || '',
      questionIntent: pair.question_intent || '',
      relatedSituation: pair.related_situation || '',
    }))

    console.log(`[QA Import] Generating embeddings for ${rows.length} questions...`)
    const questions = rows.map(r => r.question)
    const embeddings = await getTextEmbeddingBatch(questions)

    console.log(`[QA Import] Inserting ${rows.length} QA rows for request ${request_id}...`)
    const inserted = await upsertQaRows(request_id, rows, embeddings)

    console.log(`[QA Import] Successfully inserted ${inserted} QA rows`)
    return NextResponse.json({
      success: true,
      inserted,
      request_id,
    })
  } catch (error) {
    console.error('Error importing QA data:', error)
    return NextResponse.json({ error: 'Failed to import QA data' }, { status: 500 })
  }
}
