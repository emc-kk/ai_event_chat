import { searchVectors, type VectorSearchResult } from './vector-store'
import { rerankDocuments } from './reranker'
import { config } from '../config'
import type { SourceNode } from '../types'

export interface RetrieveOptions {
  topicId?: string
  requestId?: string
  fileIds?: string[]
  similarityTopK?: number
  rerankTopN?: number
}

export interface RetrieveResult {
  contextParts: string[]
  sources: SourceNode[]
}

function vectorResultToSource(result: VectorSearchResult): SourceNode {
  return {
    score: result.similarity,
    fileName: (result.metadata.file_name as string) || (result.metadata.fileName as string) || 'N/A',
    topicId: result.metadata.topic_id as string | undefined,
    requestId: result.metadata.request_id as string | undefined,
    textPreview: result.text.substring(0, 200),
  }
}

export async function retrieveContext(
  searchQuery: string,
  options: RetrieveOptions = {}
): Promise<RetrieveResult> {
  const {
    topicId,
    requestId,
    fileIds,
    similarityTopK = config.rag.similarityTopK,
    rerankTopN = config.cohere.rerankTopN,
  } = options

  const results = await searchVectors(searchQuery, {
    topicId,
    requestId,
    fileIds,
    similarityTopK,
  })

  if (results.length === 0) {
    return { contextParts: [], sources: [] }
  }

  const textsForRerank = results.map((r) => r.text)
  const rerankResults = await rerankDocuments(searchQuery, textsForRerank, rerankTopN)

  const rerankedResults = rerankResults.map((r) => ({
    ...results[r.index],
    similarity: r.relevanceScore,
  }))

  const contextParts = rerankedResults.map((r) => r.text)
  const sources = rerankedResults.map(vectorResultToSource)

  return { contextParts, sources }
}

export function formatContextAsText(contextParts: string[], sources?: SourceNode[]): string {
  if (contextParts.length === 0) {
    return ''
  }

  return contextParts
    .map((part, idx) => {
      const fileName = sources?.[idx]?.fileName
      const header = fileName && fileName !== 'N/A'
        ? `--- 参照元ファイル: ${fileName} ---`
        : `--- コンテキスト${idx + 1} ---`
      return `${header}\n${part}`
    })
    .join('\n\n')
}
