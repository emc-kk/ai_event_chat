import { Agent } from '@mastra/core/agent'
import { getTopicInstructions } from '../../prompts'
import { config } from '../../config'
import { defaultMemory } from '../memory'
import { memoryCleanupProcessor } from '../processors'
import {
  ragRetrieverTool,
  qaQueryTool,
  webSearchTool,
} from '../tools'
import type { TopicData } from '../../types'

export interface TopicAgentContext {
  topicData: TopicData
  matchingRequests: string
  glossaryTerms?: string
}

export const topicAgent = new Agent({
  id: 'topic-agent',
  name: 'Topic Agent',
  instructions: async ({ requestContext }: { requestContext?: { get: (key: string) => unknown } }) => {
    let content
    const topicContext = requestContext?.get('topicContext') as TopicAgentContext | undefined
    if (!topicContext) {
      content = 'You are a helpful topic assistant.'
    } else {
      content = getTopicInstructions(
        topicContext.topicData,
        topicContext.matchingRequests,
        topicContext.glossaryTerms
      )
    }
    return {
      role: 'system',
      content,
      providerOptions: {
        openai: {
          reasoningEffort: 'low',
          reasoningSummary: 'auto',
        },
      },
    }
  },
  model: `openai/${config.openai.chatModel}`,
  memory: defaultMemory,
  inputProcessors: [memoryCleanupProcessor],
  tools: {
    query_qa: qaQueryTool,
    retrieve_context: ragRetrieverTool,
    search_web: webSearchTool,
  },
})
