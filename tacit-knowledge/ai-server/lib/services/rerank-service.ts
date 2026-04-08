import { CohereClient } from 'cohere-ai'
import { config } from '../config'
import type { KnowledgeQaRow } from '../types'

const cohere = config.cohere.apiKey ? new CohereClient({ token: config.cohere.apiKey }) : null

export interface RerankResult {
  rows: KnowledgeQaRow[]
  usedCohere: boolean
  relevanceScores?: number[]
}

export async function rerankQaRows(
  query: string,
  rows: KnowledgeQaRow[],
  topN: number = config.cohere.rerankTopN
): Promise<RerankResult> {
  if (rows.length === 0) {
    return { rows: [], usedCohere: false }
  }

  if (rows.length <= topN) {
    return { rows, usedCohere: false }
  }

  if (!cohere || !config.cohere.apiKey) {
    console.log('[RerankService] Cohere API key not configured, using fallback')
    return { rows: rows.slice(0, topN), usedCohere: false }
  }

  try {
    const documents = rows.map((row) => ({
      text: `質問: ${row.question}\n回答: ${row.answer}\nキーワード: ${row.keywordCategory}\n意図: ${row.questionIntent}\n状況: ${row.relatedSituation}`,
    }))

    const response = await cohere.rerank({
      model: config.cohere.rerankModel,
      query,
      documents: documents.map((d) => d.text),
      topN,
    })

    const rerankedRows = response.results.map((result) => rows[result.index])
    const relevanceScores = response.results.map((result) => result.relevanceScore)

    console.log('[RerankService] Cohere rerank successful, returned', rerankedRows.length, 'rows',
      'scores:', relevanceScores.map(s => s.toFixed(3)).join(', '))
    return { rows: rerankedRows, usedCohere: true, relevanceScores }
  } catch (error) {
    console.error('[RerankService] Cohere rerank failed, using fallback:', error)
    return { rows: rows.slice(0, topN), usedCohere: false }
  }
}
