import { Memory } from "@mastra/memory"
import { config } from "../config"
import { postgresStore } from "./storage"

export const defaultMemory = new Memory({
  storage: postgresStore,
  options: {
    lastMessages: config.memory.lastMessages,
    semanticRecall: false,
    generateTitle: false,
    workingMemory: {
      enabled: false,
    },
  },
})

export const hearingMemory = new Memory({
  storage: postgresStore,
  options: {
    lastMessages: config.memory.lastMessages,
    semanticRecall: false,
    generateTitle: false,
    workingMemory: {
      enabled: true,
      scope: 'thread',
      template: `## Asked Questions
- (Update this list after EACH question you ask)

## Session Status
- is_first_response: true
- questions_count: 0`,
    },
  },
})
