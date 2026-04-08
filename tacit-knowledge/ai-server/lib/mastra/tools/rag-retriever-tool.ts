import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { retrieveContext, formatContextAsText } from '../../rag'
import type { SourceNode } from '../../types'

let lastSources: SourceNode[] = []

export function getLastSources(): SourceNode[] {
  return lastSources
}

export function clearLastSources(): void {
  lastSources = []
}

export const ragRetrieverTool = createTool({
  id: 'retrieve_context',
  description:
    'Retrieves relevant documents and context information using vector search. ' +
    'This tool searches indexed documents based on the query and returns the most relevant content. ' +
    'Results are filtered by request ID or topic ID.',
  inputSchema: z.object({
    search_query: z.string().describe('The search query'),
    similarity_top_k: z.number().optional().default(10).describe('Number of top similar results to retrieve'),
  }),
  execute: async ({ search_query, similarity_top_k }, { requestContext }) => {
    const rawRequestId = requestContext?.get('requestId')
    const requestId = Array.isArray(rawRequestId)
      ? (rawRequestId.length > 0 ? rawRequestId[0] : undefined)
      : (rawRequestId as string | undefined)
    const topicId = requestContext?.get('topicId') as string | undefined
    const fileIds = requestContext?.get('fileIds') as string[] | undefined

    const result = await retrieveContext(search_query, {
      topicId,
      requestId,
      fileIds,
      similarityTopK: similarity_top_k ?? 10,
    })

    lastSources = result.sources

    if (result.contextParts.length === 0) {
      return '関連するコンテキスト情報が見つかりませんでした。'
    }

    const formattedContext = formatContextAsText(result.contextParts, result.sources)
    return `関連するドキュメント情報（${result.contextParts.length}件）:\n\n${formattedContext}`
  },
})
