import { Agent } from "@mastra/core/agent";
import { config } from "../../config";
import { defaultMemory } from "../memory";
import { memoryCleanupProcessor } from "../processors";
import { readFileSync } from "fs";
import { join } from "path";

// Load Q&A knowledge at startup
const qaPath = join(process.cwd(), "data/demo/daiwa-qa-knowledge.json");
let qaText = "";
try {
  const qaData = JSON.parse(readFileSync(qaPath, "utf-8"));
  qaText = qaData.qa_pairs
    .map(
      (qa: { question: string; answer: string; category: string }) =>
        `Q: ${qa.question}\nA: ${qa.answer}\nカテゴリ: ${qa.category}`
    )
    .join("\n\n---\n\n");
} catch {
  qaText = "(knowledge base not loaded)";
}

const configPath = join(process.cwd(), "data/demo/daiwa-client-config.json");
let clientConfig: { mock_request_data: { topicName: string; topicDescription: string; name: string; description: string } } | null = null;
try {
  clientConfig = JSON.parse(readFileSync(configPath, "utf-8"));
} catch {
  // ignore
}

const systemPrompt = `You are an assistant that provides technical knowledge about infrastructure investment. You answer questions based on information collected from hearings.

## CRITICAL: Response Language
**Always respond in Japanese (日本語).** All your responses must be written in Japanese.

## Context
- **Topic**: ${clientConfig?.mock_request_data.topicName || "インフラ投資判断"} - ${clientConfig?.mock_request_data.topicDescription || ""}
- **Hearing**: ${clientConfig?.mock_request_data.name || ""} - ${clientConfig?.mock_request_data.description || ""}

## Knowledge Base (from hearings)
以下はヒアリングから収集された知識ベースです。この情報に基づいて回答してください。

${qaText}

## Response Rules
- Answer the question directly based on the knowledge base above
- If no relevant information is found, honestly say "この質問に関連する情報は見つかりませんでした"
- Do not supplement with speculation
- Structure content readably in Markdown format
- When citing information, mention which aspect of the knowledge base it comes from
- **All responses must be in Japanese**
`;

export function demoQaAgent() {
  return new Agent({
    id: "demo-qa-agent",
    name: "Demo QA Agent",
    instructions: {
      role: "system",
      content: systemPrompt,
      providerOptions: {
        openai: {
          reasoningEffort: "low",
        },
      },
    },
    model: `openai/${config.openai.chatModel}`,
    memory: defaultMemory,
    inputProcessors: [memoryCleanupProcessor],
  });
}
