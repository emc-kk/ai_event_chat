import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { config } from '../../config'
import { getTextEmbedding } from '../../services/embedding-service'
import { searchQaHybrid } from '../../services/knowledge-qa-service'
import { rerankQaRows } from '../../services/rerank-service'
import type { KnowledgeQaRow } from '../../types'

const HYBRID_SEARCH_TOP_K = 20
const FINAL_TOP_K = config.cohere.rerankTopN
/** Cohere relevance score threshold — results below this are discarded */
const RELEVANCE_SCORE_THRESHOLD = 0.3

let lastMatchingRows: KnowledgeQaRow[] = []

export function getLastMatchingRows(): KnowledgeQaRow[] {
  return lastMatchingRows
}

export function clearLastMatchingRows(): void {
  lastMatchingRows = []
}

function formatQaRowsAsText(
  rows: KnowledgeQaRow[],
  requestNameMap?: Record<string, string>
): string {
  if (rows.length === 0) {
    return ''
  }

  return rows
    .map((row, idx) => {
      const hearingLabel = requestNameMap && row.requestId && requestNameMap[row.requestId]
        ? `（ヒアリング: ${requestNameMap[row.requestId]}）`
        : ''
      return [
        `--- ヒアリングQA ${idx + 1} ${hearingLabel}---`,
        `質問: ${row.question}`,
        `原文回答（※この回答をそのまま引用すること。加筆・補足・展開は禁止）: ${row.answer}`,
      ].join('\n')
    })
    .join('\n\n')
}

export const qaQueryTool = createTool({
  id: 'query_qa',
  description:
    'Searches the Knowledge QA database for relevant question-answer pairs based on the user question. ' +
    'This tool finds questions similar to the user query and returns corresponding answers, keywords, ' +
    'question intent, and related situations. The Knowledge QA contains pre-defined Q&A pairs from hearing sessions.',
  inputSchema: z.object({
    user_question: z.string().describe('The user question to search for'),
  }),
  execute: async ({ user_question }, { requestContext }) => {
    const requestIdValue = requestContext?.get('requestId') as string | string[] | undefined
    const requestNameMap = requestContext?.get('requestNameMap') as Record<string, string> | undefined

    console.log('[QaQueryTool] Called with:', { user_question, requestIdValue })

    if (!requestIdValue) {
      console.log('[QaQueryTool] No requestId set')
      return 'リクエストIDが設定されていません。'
    }

    const requestIds = Array.isArray(requestIdValue) ? requestIdValue : [requestIdValue]
    console.log('[QaQueryTool] requestIds:', requestIds)

    const queryEmbedding = await getTextEmbedding(user_question)

    let allMatchingRows: KnowledgeQaRow[] = []
    for (const reqId of requestIds) {
      const matchingRows = await searchQaHybrid(
        reqId,
        queryEmbedding,
        user_question,
        HYBRID_SEARCH_TOP_K,
        0.7
      )
      // Tag each row with its requestId for later attribution
      const taggedRows = matchingRows.map(row => ({ ...row, requestId: reqId }))
      console.log('[QaQueryTool] Found', matchingRows.length, 'rows for request:', reqId)
      allMatchingRows = allMatchingRows.concat(taggedRows)
    }

    console.log('[QaQueryTool] Total matching rows from hybrid search:', allMatchingRows.length)

    if (allMatchingRows.length === 0) {
      console.log('[QaQueryTool] No matching rows found')
      return '関連するQA情報が見つかりませんでした。'
    }

    const { rows: rerankedRows, usedCohere, relevanceScores } = await rerankQaRows(
      user_question,
      allMatchingRows,
      FINAL_TOP_K
    )

    console.log(
      '[QaQueryTool] After rerank:',
      rerankedRows.length,
      'rows',
      usedCohere ? '(Cohere)' : '(fallback)'
    )

    // Filter by relevance score when Cohere reranking was used
    let filteredRows: KnowledgeQaRow[]
    if (usedCohere && relevanceScores && relevanceScores.length > 0) {
      filteredRows = rerankedRows.filter((_, idx) => {
        const score = relevanceScores[idx]
        const keep = score >= RELEVANCE_SCORE_THRESHOLD
        if (!keep) {
          console.log(
            `[QaQueryTool] Filtered out row ${idx} (score: ${score.toFixed(3)}, threshold: ${RELEVANCE_SCORE_THRESHOLD}):`,
            rerankedRows[idx].question.substring(0, 60)
          )
        }
        return keep
      })
      console.log(`[QaQueryTool] After relevance filtering: ${filteredRows.length}/${rerankedRows.length} rows kept`)
    } else {
      filteredRows = rerankedRows
    }

    if (filteredRows.length === 0) {
      console.log('[QaQueryTool] All rows filtered out by relevance threshold')
      return '関連するQA情報が見つかりませんでした。'
    }

    lastMatchingRows = filteredRows

    const formattedRows = formatQaRowsAsText(filteredRows, requestNameMap)
    console.log('[QaQueryTool] Returning', filteredRows.length, 'matching rows')
    return `関連するQA情報（${filteredRows.length}件）:\n\n${formattedRows}`
  },
})
