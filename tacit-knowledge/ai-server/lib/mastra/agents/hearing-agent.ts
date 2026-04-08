import { Agent } from '@mastra/core/agent'
import { getHearingInstructions } from '../../prompts'
import { config } from '../../config'
import { hearingMemory } from '../memory'
import { memoryCleanupProcessor } from '../processors'
import type { RequestData } from '../../types'
import { sendSuggestionsTool } from '../tools'

export function hearingAgent() {
  return new Agent({
    id: 'hearing-agent',
    name: 'Hearing Agent',
    instructions: async ({ requestContext }: { requestContext?: { get: (key: string) => unknown } }) => {
      let content
      const requestData = requestContext?.get('requestData') as RequestData | undefined
      if (!requestData) {
        content = 'You are a helpful hearing assistant.'
      } else {
        content = getHearingInstructions(requestData)
      }
      return {
        role: 'system',
        content,
        providerOptions: {
          openai: {
            reasoningEffort: 'low'
          },
        },
      }
    },
    model: `openai/${config.openai.chatModel}`,
    memory: hearingMemory,
    inputProcessors: [memoryCleanupProcessor],
    tools: {
      send_suggestions: sendSuggestionsTool,
    },
  })
}
