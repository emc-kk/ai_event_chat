import type { InputProcessor } from '@mastra/core/processors'

export const memoryCleanupProcessor: InputProcessor = {
  id: 'memory-cleanup',

  processInputStep: async ({ messageList }) => {
    const messages = messageList.get.all.db()
    const sourceChecker = messageList.makeMessageSourceChecker()

    for (const message of messages) {
      if (sourceChecker.getSource(message) !== 'memory') continue

      if (message.role === 'assistant' && message.content?.parts) {
        message.content.parts = message.content.parts
          .filter((part) => part.type === 'text')
          .map((part) => {
            const { providerMetadata, ...rest } = part as any
            return rest
          })

        if (message.content.toolInvocations) {
          message.content.toolInvocations = []
        }

        delete message.content.providerMetadata
        delete (message.content as any).reasoning
        delete (message.content as any).annotations

        if (message.content.metadata) {
          delete message.content.metadata.providerMetadata
        }
      }
    }

    return { messageList }
  },
}
