import { embed, embedMany } from 'ai'
import { openai } from '@ai-sdk/openai'
import { config } from '../config'

const embeddingModel = openai.embedding(config.openai.embeddingModel)

export async function getTextEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  })

  return embedding
}

export async function getTextEmbeddingBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts,
  })

  return embeddings
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function findTopKSimilar(
  queryEmbedding: number[],
  embeddings: number[][],
  topK: number
): Array<{ index: number; similarity: number }> {
  const similarities = embeddings.map((emb, index) => ({
    index,
    similarity: cosineSimilarity(queryEmbedding, emb),
  }))

  similarities.sort((a, b) => b.similarity - a.similarity)

  return similarities.slice(0, topK)
}
