import { getGeneratedSuggestions } from '@/lib/mastra/tools/send-suggestions-tool'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const requestId = searchParams.get('request_id')

  try {
    const key = requestId || 'default'
    const suggestions = getGeneratedSuggestions(key)
    console.log('[Suggestions API] Returning generated suggestions for key:', key, 'count:', suggestions.length)
    return Response.json({
      suggestions,
      source: 'generated',
    })
  } catch (error) {
    console.error('[Suggestions API] Error:', error)
    return Response.json(
      { error: 'Failed to fetch suggestions', suggestions: [] },
      { status: 500 }
    )
  }
}
