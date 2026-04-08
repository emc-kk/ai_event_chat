import { createUIMessageStreamResponse } from "ai";
import type { UIMessage } from "ai";
import { handleChatStream } from "@mastra/ai-sdk";
import { nanoid } from "nanoid";
import { mastra } from "@/lib/mastra";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const inputMessages: UIMessage[] = messages.length > 0
    ? [{
        id: nanoid(),
        role: "user" as const,
        parts: messages[messages.length - 1].parts,
      }]
    : [];

  if (inputMessages.length === 0) {
    return Response.json({ error: "No message" }, { status: 400 });
  }

  const stream = await handleChatStream({
    mastra,
    agentId: "demoQaAgent",
    params: {
      messages: inputMessages,
      memory: {
        thread: "demo-qa-thread",
        resource: "demo-daiwa-qa",
      },
    },
  });

  return createUIMessageStreamResponse({ stream });
}
