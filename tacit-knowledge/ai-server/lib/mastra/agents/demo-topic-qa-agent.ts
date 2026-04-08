import { Agent } from "@mastra/core/agent";
import { config } from "../../config";
import { defaultMemory } from "../memory";
import { memoryCleanupProcessor } from "../processors";

/**
 * Demo Topic Q&A Agent — Suntory 酒税法トピック別Q&A
 *
 * Dynamic instructions: topic name and context are injected
 * via requestContext at runtime (per-topic scoping).
 */
export function demoTopicQaAgent() {
  return new Agent({
    id: "demo-topic-qa-agent",
    name: "Demo Topic QA Agent",
    instructions: async ({ requestContext }) => {
      const topicName =
        (requestContext?.get("topicName") as string) || "酒税法";
      const topicContext =
        (requestContext?.get("topicContext") as string) || "";
      const conciseMode =
        (requestContext?.get("conciseMode") as boolean) || false;

      const conciseFragment = conciseMode
        ? `
## 簡潔モード (ACTIVE)
- **回答は2〜3文以内に収めてください。** 箇条書きや長い説明は不要です。
- 核心のみを端的に回答してください。
- Markdownの見出しやリストは使わず、平文で回答してください。
- 音声で読み上げることを想定し、自然な話し言葉で回答してください。
`
        : "";

      return {
        role: "system" as const,
        content: `You are an assistant that provides expert knowledge about ${topicName} at Suntory's Azusa distillery. You answer questions based on the hearing context below.

## CRITICAL: Response Language
**Always respond in Japanese (日本語).** All your responses must be written in Japanese.
${conciseFragment}
## Context
- **Topic**: ${topicName}
- **Client**: サントリー 梓の森工場（酒類製造）

## Knowledge Base
以下はヒアリング対象の知識ベースです。この情報に基づいて回答してください。

${topicContext}

## Response Rules
- Answer the question directly based on the knowledge base above
- If no relevant information is found, honestly say "この質問に関連する情報は見つかりませんでした"
- Do not supplement with speculation beyond the knowledge base${conciseMode ? "" : "\n- Structure content readably in Markdown format"}
- When citing information, explain the practical context
- **All responses must be in Japanese**
`,
      };
    },
    model: `openai/${config.openai.chatModel}`,
    memory: defaultMemory,
    inputProcessors: [memoryCleanupProcessor],
  });
}
