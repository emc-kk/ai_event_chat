export interface Prompts {
  chat: {
    hearing: {
      initial_message: string
      instructions: string
    }
    topic: {
      instructions: string
    }
  }
}

export interface PromptContext {
  topicName?: string
  topicDescription?: string
  requestName?: string
  requestDescription?: string
  requestContext?: string
  matchingChartRows?: string
  matchingRequests?: string
  userQuestion?: string
  matchingRows?: string
  userMessage?: string
  documentContent?: string
  previousContextsWithConversations?: string
  newComment?: string
  qaPairs?: string
  schemaDescription?: string
  responseSchema?: string
  existingChartRows?: string
  newQaPairs?: string
  existingSummary?: string
  newQaPairsForSummary?: string
  glossaryTerms?: string
}
