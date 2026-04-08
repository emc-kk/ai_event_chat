import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { search, SafeSearchType } from 'duck-duck-scrape'

export interface WebSearchResult {
  title: string
  body: string
  url: string
}

let lastSearchResults: WebSearchResult[] = []

export function getLastSearchResults(): WebSearchResult[] {
  return lastSearchResults
}

export function clearLastSearchResults(): void {
  lastSearchResults = []
}

export const webSearchTool = createTool({
  id: 'search_web',
  description:
    'Performs a web search to retrieve the latest information from the internet. ' +
    'Searches based on the query and returns relevant web page titles, descriptions, and URLs.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    max_results: z.number().optional().default(5).describe('Maximum number of results to retrieve'),
  }),
  execute: async ({ query, max_results }) => {

    try {
      const results = await search(query, {
        safeSearch: SafeSearchType.MODERATE,
      })

      if (!results.results || results.results.length === 0) {
        return 'Web検索結果が見つかりませんでした。'
      }

      const topResults = results.results.slice(0, max_results ?? 5)

      lastSearchResults = topResults.map((r) => ({
        title: r.title,
        body: r.description,
        url: r.url,
      }))

      const formattedResults = topResults
        .map((result, idx) => {
          return [
            `**結果${idx + 1}**:`,
            `- タイトル: ${result.title}`,
            `- 説明: ${result.description}`,
            `- URL: ${result.url}`,
          ].join('\n')
        })
        .join('\n\n')

      return `Web検索結果（${topResults.length}件）:\n\n${formattedResults}`
    } catch (error) {
      console.error('Web search error:', error)
      return 'Web検索中にエラーが発生しました。'
    }
  },
})
