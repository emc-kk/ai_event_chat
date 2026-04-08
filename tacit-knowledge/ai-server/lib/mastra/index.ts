import { Mastra } from "@mastra/core/mastra"
import { Observability, DefaultExporter } from "@mastra/observability";
import { postgresStore, vectorStore } from "./storage"
import { flowAgent } from "./agents/flow-agent"
import { qaAgent } from "./agents/qa-agent"
import { unifiedReviewAgent } from "./agents/unified-review-agent"
import { hearingAgent } from "./agents/hearing-agent"

import { topicAgent, type TopicAgentContext } from "./agents/topic-agent"
import { demoQaAgent } from "./agents/demo-qa-agent"
import { demoTopicQaAgent } from "./agents/demo-topic-qa-agent"
import { demoHearingAgent } from "./agents/demo-hearing-agent"
import { scraperJobAgent } from "./agents/scraper-job-agent"

export { postgresStore, vectorStore }

export const mastra = new Mastra({
  storage: postgresStore,
  observability: new Observability({
    configs: {
      local: {
        serviceName: "mastra",
        exporters: [new DefaultExporter()],
      },
    },
  }),
  agents: {
    flowAgent: flowAgent(),
    qaAgent: qaAgent(),
    unifiedReviewAgent: unifiedReviewAgent(),
    hearingAgent: hearingAgent(),

    topicAgent: topicAgent,
    demoQaAgent: demoQaAgent(),
    demoTopicQaAgent: demoTopicQaAgent(),
    demoHearingAgent: demoHearingAgent(),
    scraperJobAgent: scraperJobAgent(),
  },
})

export type { TopicAgentContext }
