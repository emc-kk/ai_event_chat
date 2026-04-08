import { CohereClient } from 'cohere-ai'
import { config } from '../config'

let cohereClient: CohereClient | null = null

function getCohereClient(): CohereClient {
  if (!cohereClient) {
    cohereClient = new CohereClient({
      token: config.cohere.apiKey,
    })
  }
  return cohereClient
}

export interface RerankResult {
  index: number
  relevanceScore: number
}

export async function rerankDocuments(
  query: string,
  documents: string[],
  topN?: number
): Promise<RerankResult[]> {
  if (documents.length === 0) {
    return []
  }

  if (!config.cohere.apiKey) {
    const limit = topN ?? config.cohere.rerankTopN
    return documents.slice(0, limit).map((_, index) => ({
      index,
      relevanceScore: 1 - index * 0.01,
    }))
  }

  const client = getCohereClient()

  const response = await client.rerank({
    query,
    documents,
    topN: topN ?? config.cohere.rerankTopN,
    model: config.cohere.rerankModel,
  })

  return response.results.map((result) => ({
    index: result.index,
    relevanceScore: result.relevanceScore,
  }))
}

export async function rerankWithDocuments<T extends { text: string }>(
  query: string,
  documents: T[],
  topN?: number
): Promise<Array<T & { relevanceScore: number }>> {
  if (documents.length === 0) {
    return []
  }

  const texts = documents.map((doc) => doc.text)
  const results = await rerankDocuments(query, texts, topN)

  return results.map((result) => ({
    ...documents[result.index],
    relevanceScore: result.relevanceScore,
  }))
}
