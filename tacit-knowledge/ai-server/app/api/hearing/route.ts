import { handleChatStream } from "@mastra/ai-sdk"
import { createUIMessageStreamResponse, convertToModelMessages } from "ai"
import type { UIMessage } from "ai"
import type { AgentExecutionOptions } from "@mastra/core/agent"
import { RequestContext } from "@mastra/core/request-context"
import { nanoid } from "nanoid"
import { saveMessage, getRoomInfo, getLastAssistantMessageId, saveMessageFile } from "@/lib/services/message-service"
import { getRequestData } from "@/lib/services/database-service"
import { uploadToS3 } from "@/lib/services/s3-service"
import { mastra } from "@/lib/mastra"
import { getHearingInitialPrompt } from "@/lib/prompts"
import { clearGeneratedSuggestions } from "@/lib/mastra/tools/send-suggestions-tool"
import type { RequestData } from "@/lib/types"

interface FileData {
  url: string;
  mediaType: string;
  filename?: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      messages,
      room_id,
      topic_id,
      request_id,
    }: {
      messages: UIMessage[];
      room_id?: string;
      topic_id?: string;
      request_id?: string;
    } = body

    if (!request_id) {
      return Response.json(
        { error: 'request_id_required', message: 'request_id は必須です。' },
        { status: 400 }
      )
    }

    try {
      clearGeneratedSuggestions(request_id)
    } catch (e) {
      console.warn('[Hearing API] clearGeneratedSuggestions failed:', e)
    }

    let requestData: RequestData | null = null
    try {
      requestData = await getRequestData(request_id)
    } catch (dbError) {
      console.error('[Hearing API] getRequestData failed:', dbError)
      return Response.json(
        {
          error: 'database_error',
          message: 'リクエスト情報の取得に失敗しました。DB接続を確認してください。',
        },
        { status: 503 }
      )
    }
    if (!requestData) {
      return Response.json(
        {
          error: 'request_not_found',
          message: 'リクエスト情報が見つかりません。同一のデータベースを参照しているか確認してください。',
        },
        { status: 404 }
      )
    }

  const requestContext = new RequestContext<{ requestData: RequestData; requestId: string }>()
  requestContext.set("requestData", requestData)
  requestContext.set("requestId", request_id)

  const INITIAL_MESSAGE_MARKER = '__INITIAL_MESSAGE__'

  let userMessage = ''
  let isInitialMessage = false
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

  if (userMessage === INITIAL_MESSAGE_MARKER || !userMessage) {
    isInitialMessage = true
    userMessage = getHearingInitialPrompt()
  }

  if (room_id && userMessage && !isInitialMessage) {
    try {
      const roomInfo = await getRoomInfo(room_id);
      const questionId = await getLastAssistantMessageId(room_id);
      const messageId = await saveMessage({
        roomId: room_id,
        content: userMessage,
        messageType: 'user',
        chatType: roomInfo?.chatType || 'hearing',
        topicId: topic_id || roomInfo?.topicId,
        requestId: request_id || roomInfo?.requestId,
        questionId: questionId || undefined,
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
          console.error('[Hearing API] Failed to upload file:', fileError)
        }
      }
    } catch (error) {
      console.error('[Hearing API] Failed to save user message:', error);
    }
  }

  const inputMessages: UIMessage[] = [{
    id: nanoid(),
    role: 'user',
    parts: files.length > 0
      ? [
          { type: 'text' as const, text: userMessage },
          ...files.map(f => ({ type: 'file' as const, url: f.url, mediaType: f.mediaType, filename: f.filename }))
        ]
      : [{ type: 'text' as const, text: userMessage }]
  }]

  const stream = await handleChatStream({
    mastra,
    agentId: 'hearingAgent',
    params: {
      messages: inputMessages,
      memory: {
        thread: room_id || 'hearing-thread',
        resource: request_id || 'hearing-resource',
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
            chatType: roomInfo?.chatType || 'hearing',
            topicId: topic_id || roomInfo?.topicId,
            requestId: request_id || roomInfo?.requestId,
          });
        } catch (error) {
          console.error('[Hearing API] Failed to save assistant message:', error);
        }
      }
    }
  })

  const outputStream = stream.pipeThrough(transformStream)

  return createUIMessageStreamResponse({ stream: outputStream })
  } catch (err) {
    const message = err instanceof Error ? err.message : '不明なエラー'
    console.error('[Hearing API] Error:', err)
    return Response.json(
      {
        error: 'server_error',
        message: `ヒアリング用チャットの処理中にエラーが発生しました: ${message}`,
      },
      { status: 500 }
    )
  }
}
