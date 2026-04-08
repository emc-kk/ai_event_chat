import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import * as fs from 'fs'
import * as path from 'path'
import { getTextEmbedding, cosineSimilarity } from '../../services/embedding-service'

const flowDataPath = path.join(process.cwd(), 'data/flow.json')
const flowData = JSON.parse(fs.readFileSync(flowDataPath, 'utf-8'))

const embeddingsPath = path.join(process.cwd(), 'data/flow-embeddings.json')
let embeddingsData: FlowEmbeddings | null = null

try {
  embeddingsData = JSON.parse(fs.readFileSync(embeddingsPath, 'utf-8'))
  console.log(`[AnswerFlowQuestion] Loaded ${embeddingsData?.items.length ?? 0} embeddings`)
} catch {
  console.warn('[AnswerFlowQuestion] flow-embeddings.json not found, vector search disabled')
}

interface FlowStep {
  id: string
  name: string
  subSteps: FlowSubStep[]
}

interface FlowSubStep {
  id: string
  name: string
  checkItems: FlowCheckItem[]
}

interface FlowCheckItem {
  id: string
  question: string
  options: FlowOption[]
}

interface FlowOption {
  condition: string
  result: string
  explanation?: string
  nextCheckId?: string
}

interface MatchedItem {
  stepName: string
  subStepName: string
  checkItem: FlowCheckItem
  score?: number
  matchType?: 'keyword' | 'vector' | 'both'
}

interface EmbeddingItem {
  checkId: string
  stepName: string
  subStepName: string
  text: string
  embedding: number[]
}

interface FlowEmbeddings {
  model: string
  dimension: number
  generatedAt: string
  items: EmbeddingItem[]
}

function searchFlowDataByKeyword(keywords: string[]): MatchedItem[] {
  const results: MatchedItem[] = []

  for (const step of flowData.steps as FlowStep[]) {
    for (const subStep of step.subSteps) {
      for (const checkItem of subStep.checkItems) {
        const checkText = JSON.stringify(checkItem)
        const matchCount = keywords.filter(kw => checkText.includes(kw)).length

        if (matchCount > 0) {
          results.push({
            stepName: step.name,
            subStepName: subStep.name,
            checkItem: checkItem,
            score: matchCount / keywords.length,
            matchType: 'keyword'
          })
        }
      }
    }
  }

  return results
}

async function searchFlowDataByVector(question: string, topK: number = 5): Promise<MatchedItem[]> {
  if (!embeddingsData) {
    return []
  }

  const queryEmbedding = await getTextEmbedding(question)
  const similarities: Array<{ item: EmbeddingItem; similarity: number }> = []

  for (const item of embeddingsData.items) {
    const similarity = cosineSimilarity(queryEmbedding, item.embedding)
    similarities.push({ item, similarity })
  }

  similarities.sort((a, b) => b.similarity - a.similarity)
  const topResults = similarities.slice(0, topK)

  const results: MatchedItem[] = []
  for (const { item, similarity } of topResults) {
    const checkItem = findCheckItemById(item.checkId)
    if (checkItem) {
      results.push({
        stepName: item.stepName,
        subStepName: item.subStepName,
        checkItem: checkItem,
        score: similarity,
        matchType: 'vector'
      })
    }
  }

  return results
}

function findCheckItemById(checkId: string): FlowCheckItem | null {
  for (const step of flowData.steps as FlowStep[]) {
    for (const subStep of step.subSteps) {
      for (const checkItem of subStep.checkItems) {
        if (checkItem.id === checkId) {
          return checkItem
        }
      }
    }
  }
  return null
}

function mergeResults(keywordResults: MatchedItem[], vectorResults: MatchedItem[]): MatchedItem[] {
  const merged = new Map<string, MatchedItem>()

  for (const item of keywordResults) {
    merged.set(item.checkItem.id, item)
  }

  for (const item of vectorResults) {
    const existing = merged.get(item.checkItem.id)
    if (existing) {
      existing.matchType = 'both'
      existing.score = Math.max(existing.score ?? 0, item.score ?? 0)
    } else {
      merged.set(item.checkItem.id, item)
    }
  }

  const results = Array.from(merged.values())
  results.sort((a, b) => {
    if (a.matchType === 'both' && b.matchType !== 'both') return -1
    if (b.matchType === 'both' && a.matchType !== 'both') return 1
    return (b.score ?? 0) - (a.score ?? 0)
  })

  return results
}

interface FlowSummary {
  steps: {
    name: string
    subSteps: {
      name: string
      checkItemCount: number
    }[]
  }[]
}

function getFlowSummary(): FlowSummary {
  return {
    steps: (flowData.steps as FlowStep[]).map(s => ({
      name: s.name,
      subSteps: s.subSteps.map(ss => ({
        name: ss.name,
        checkItemCount: ss.checkItems.length
      }))
    }))
  }
}

export const answerFlowQuestionTool = createTool({
  id: 'answer_flow_question',
  description:
    'Answer questions about the credit review flow. Use when user asks general questions ' +
    'like "NGになる条件は？", "減点される場合は？", "このステップの目的は？" etc. ' +
    'Do NOT use this for flow progression - only for informational questions.',
  inputSchema: z.object({
    question: z.string().describe('The user\'s question about the review flow'),
    search_keywords: z.array(z.string())
      .describe('Keywords to search in flow data (e.g., ["NG", "減点", "延滞", "貸倒"])'),
    need_summary: z.boolean().optional()
      .describe('Set true if user asks about overall flow structure'),
  }),
  execute: async ({ question, search_keywords, need_summary }) => {
    const keywordResults = searchFlowDataByKeyword(search_keywords)
    const vectorResults = await searchFlowDataByVector(question)
    const matchedItems = mergeResults(keywordResults, vectorResults)
    const summary = need_summary ? getFlowSummary() : null

    console.log('[AnswerFlowQuestion] question:', question)
    console.log('[AnswerFlowQuestion] keywords:', search_keywords)
    console.log('[AnswerFlowQuestion] keyword matches:', keywordResults.length)
    console.log('[AnswerFlowQuestion] vector matches:', vectorResults.length)
    console.log('[AnswerFlowQuestion] merged total:', matchedItems.length)

    return {
      question,
      search_keywords,
      matched_items: matchedItems,
      flow_summary: summary,
      total_matches: matchedItems.length,
      search_stats: {
        keyword_matches: keywordResults.length,
        vector_matches: vectorResults.length,
        vector_search_enabled: embeddingsData !== null,
      }
    }
  },
})
