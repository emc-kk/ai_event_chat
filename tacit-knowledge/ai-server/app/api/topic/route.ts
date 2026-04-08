import { handleChatStream } from "@mastra/ai-sdk"
import { createUIMessageStreamResponse, convertToModelMessages } from "ai"
import type { UIMessage } from "ai"
import type { AgentExecutionOptions } from "@mastra/core/agent"
import { RequestContext } from "@mastra/core/request-context"
import { nanoid } from "nanoid"
import { saveMessage, getRoomInfo, saveMessageFile } from "@/lib/services/message-service"
import { getTopicDataById, getTopicRequestsData, getMatchingGlossaryTerms } from "@/lib/services/database-service"
import { uploadToS3 } from "@/lib/services/s3-service"
import { mastra, type TopicAgentContext } from "@/lib/mastra"
import { clearLastSources, clearLastMatchingRows, clearLastSearchResults } from "@/lib/mastra/tools"

interface FileData {
  url: string;
  mediaType: string;
  filename?: string;
}

export async function POST(req: Request) {
  const {
    messages,
    room_id,
    topic_id,
    file_ids,
    webSearch,
  }: {
    messages: UIMessage[];
    room_id?: string;
    topic_id?: string;
    file_ids?: string[];
    webSearch?: boolean;
  } = await req.json();

  if (!topic_id) {
    return Response.json({ error: 'topic_id is required' }, { status: 400 })
  }

  const topicData = await getTopicDataById(topic_id)

  if (!topicData) {
    return Response.json({ error: 'Topic not found' }, { status: 404 })
  }

  const requests = await getTopicRequestsData(topic_id)
  const requestIds = requests.map(r => r.id)
  const requestNameMap: Record<string, string> = {}
  for (const r of requests) {
    requestNameMap[r.id] = r.name
  }

  const matchingRequestsText = requests
    .map((r, idx) => `${idx + 1}. **${r.name}**: ${r.description}`)
    .join('\n')

  clearLastSources()
  clearLastMatchingRows()
  clearLastSearchResults()

  let userMessage = ''
  const files: FileData[] = []

  if (messages && messages.length > 0) {
    const modelMessages = await convertToModelMessages(messages)
    const lastMessageContent = modelMessages[modelMessages.length - 1].content
    if (Array.isArray(lastMessageContent)) {
      for (const part of lastMessageContent) {
        if (part.type === 'text') {
          userMessage = part.text || ''
        } else if (part.type === 'file') {
          files.push({
            url: part.data as string,
            mediaType: part.mediaType,
            filename: (part as { filename?: string }).filename,
          })
        }
      }
    }
  }

  // Glossary matching
  let glossaryTermsText = ''
  if (topicData.companyId && userMessage) {
    const glossaryMatches = await getMatchingGlossaryTerms(topicData.companyId, userMessage)
    if (glossaryMatches.length > 0) {
      glossaryTermsText = glossaryMatches
        .map(g => `- **${g.term}**: ${g.definition}`)
        .join('\n')
    }
  }

  const requestContext = new RequestContext<{ topicContext: TopicAgentContext; topicId: string; requestId: string[]; requestNameMap: Record<string, string>; fileIds: string[] | undefined }>()
  requestContext.set("topicContext", {
    topicData,
    matchingRequests: matchingRequestsText,
    glossaryTerms: glossaryTermsText,
  })
  requestContext.set("topicId", topic_id)
  requestContext.set("requestId", requestIds)
  requestContext.set("requestNameMap", requestNameMap)
  if (file_ids && file_ids.length > 0) {
    requestContext.set("fileIds", file_ids)
  }

  if (room_id && userMessage) {
    try {
      const roomInfo = await getRoomInfo(room_id);
      const messageId = await saveMessage({
        roomId: room_id,
        content: userMessage,
        messageType: 'user',
        chatType: roomInfo?.chatType || 'topic',
        topicId: topic_id || roomInfo?.topicId,
        requestId: roomInfo?.requestId,
      });

      for (const file of files) {
        try {
          const base64Match = file.url.match(/^data:([^;]+);base64,(.+)$/)
          if (base64Match) {
            const [, , base64Data] = base64Match
            const buffer = Buffer.from(base64Data, 'base64')
            const fileName = file.filename || `file_${Date.now()}`

            const uploadResult = await uploadToS3({
              roomId: room_id,
              fileName,
              contentType: file.mediaType,
              data: buffer,
            })

            await saveMessageFile({
              messageId,
              filePath: uploadResult.filePath,
              fileName: uploadResult.fileName,
              contentType: uploadResult.contentType,
              fileSize: uploadResult.fileSize,
            })
          }
        } catch (fileError) {
          console.error('[Topic API] Failed to upload file:', fileError)
        }
      }
    } catch (error) {
      console.error('[Topic API] Failed to save user message:', error);
    }
  }

  let messageText = userMessage
  if (webSearch && userMessage) {
    messageText = `${userMessage}\n\n[Web検索を使用して、最新の情報を含めて回答してください]`
  }

  // Build input messages in AI SDK v6 format (parts-based)
  const inputMessages: UIMessage[] = [{
    id: nanoid(),
    role: 'user',
    parts: files.length > 0
      ? [
          { type: 'text' as const, text: messageText },
          ...files.map(f => ({ type: 'file' as const, url: f.url, mediaType: f.mediaType, filename: f.filename }))
        ]
      : [{ type: 'text' as const, text: messageText }]
  }]

  const stream = await handleChatStream({
    mastra,
    agentId: 'topicAgent',
    params: {
      messages: inputMessages,
      memory: {
        thread: room_id || 'topic-thread',
        resource: topic_id || 'topic-resource',
      },
      providerOptions: {
        openai: {
          reasoningEffort: 'low',
          reasoningSummary: 'auto',
        },
      },
    },
    defaultOptions: {
      requestContext,
    } as AgentExecutionOptions,
    sendReasoning: true,
  })

  let assistantResponse = '';
  const transformStream = new TransformStream({
    transform(chunk, controller) {
      if (chunk && typeof chunk === 'object') {
        const parsed = chunk as { type?: string; delta?: string; text?: string }
        if (parsed.type === 'text-delta' && parsed.delta) {
          assistantResponse += parsed.delta
        } else if (parsed.type === 'text' && parsed.text) {
          assistantResponse += parsed.text
        }
      }
      controller.enqueue(chunk)
    },
    async flush() {
      if (room_id && assistantResponse) {
        try {
          const roomInfo = await getRoomInfo(room_id);
          await saveMessage({
            roomId: room_id,
            content: assistantResponse,
            messageType: 'assistant',
            chatType: roomInfo?.chatType || 'topic',
            topicId: topic_id || roomInfo?.topicId,
            requestId: roomInfo?.requestId,
          });
        } catch (error) {
          console.error('[Topic API] Failed to save assistant message:', error);
        }
      }
    }
  })

  const outputStream = stream.pipeThrough(transformStream)

  return createUIMessageStreamResponse({ stream: outputStream })
}
