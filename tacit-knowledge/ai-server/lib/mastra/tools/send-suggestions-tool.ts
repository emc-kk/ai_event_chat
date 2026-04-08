import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export interface GeneratedSuggestion {
  id?: string
  question: string
  answerCandidates: string[]
  category?: string
  currentCheckId?: string
}

// Use globalThis to persist data across HMR in development
const globalKey = '__suggestionsByRequestId__'
declare global {
  var __suggestionsByRequestId__: Map<string, GeneratedSuggestion[]> | undefined
}

function getSuggestionsMap(): Map<string, GeneratedSuggestion[]> {
  if (!globalThis[globalKey]) {
    globalThis[globalKey] = new Map<string, GeneratedSuggestion[]>()
  }
  return globalThis[globalKey]!
}

export function getGeneratedSuggestions(requestId: string): GeneratedSuggestion[] {
  return getSuggestionsMap().get(requestId) || []
}

export function clearGeneratedSuggestions(requestId: string): void {
  getSuggestionsMap().delete(requestId)
}

export const sendSuggestionsTool = createTool({
  id: 'send_suggestions',
  description:
    '[CRITICAL: Use before asking a question] Send answer candidates to the user. ' +
    'Without this tool, answer options will not appear in the UI. ' +
    'Include 2-4 answer candidates per question.',
  inputSchema: z.object({
    current_check_id: z.string().optional().describe('The current check item ID from flow.json (e.g., step0-sub0-check0). Optional for non-flow agents.'),
    suggestions: z
      .array(
        z.object({
          question: z.string().describe('The question to ask'),
          answer_candidates: z.array(z.string()).describe('Expected answer candidates'),
          category: z
            .string()
            .optional()
            .describe('Category: decision/exception/tips/priority/context'),
        })
      )
      .describe('List of question candidates (3-5 recommended)'),
  }),
  execute: async ({ current_check_id, suggestions }, { requestContext }) => {
    const requestId = requestContext?.get('requestId') as string | undefined
    const checkId = current_check_id || undefined

    console.log('[SuggestionTool] Received', suggestions.length, 'suggestions for requestId:', requestId, 'checkId:', checkId || 'none')

    const key = requestId || 'default'
    const map = getSuggestionsMap()

    const mapped = suggestions.map((s) => ({
      question: s.question,
      answerCandidates: s.answer_candidates,
      category: s.category,
      currentCheckId: checkId,
    }))

    map.set(key, mapped)

    console.log('[SuggestionTool] Stored', mapped.length, 'suggestions with checkId:', checkId || 'none')

    return `Generated ${suggestions.length} question candidates. They will be displayed to the user.`
  },
})
