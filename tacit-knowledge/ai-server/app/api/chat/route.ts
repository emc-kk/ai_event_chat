import { handleChatStream } from "@mastra/ai-sdk"
import { createUIMessageStreamResponse, convertToModelMessages } from "ai"
import type { UIMessage } from "ai"
import type { AgentExecutionOptions } from "@mastra/core/agent"
import { RequestContext } from "@mastra/core/request-context"
import { nanoid } from "nanoid"
import { mastra } from "@/lib/mastra"
import { clearGeneratedSuggestions } from "@/lib/mastra/tools/send-suggestions-tool"
import * as fs from 'fs'
import * as path from 'path'

const flowDataPath = path.join(process.cwd(), 'data/flow.json')
const flowData = JSON.parse(fs.readFileSync(flowDataPath, 'utf-8'))

interface CheckItemInfo {
  id: string
  question: string
  stepName: string
  subStepName: string
  options: Array<{
    condition: string
    result: string
    explanation?: string
    nextCheckId?: string
  }>
}

const checkItemMap = new Map<string, CheckItemInfo>()
const checkItemList: string[] = []

for (const step of flowData.steps) {
  for (const subStep of step.subSteps) {
    for (const checkItem of subStep.checkItems) {
      checkItemList.push(checkItem.id)
      checkItemMap.set(checkItem.id, {
        ...checkItem,
        stepName: step.name,
        subStepName: subStep.name
      })
    }
  }
}

function getCheckItemContext(checkId: string): string {
  const item = checkItemMap.get(checkId)
  if (!item) return ''

  const currentIndex = checkItemList.indexOf(checkId)
  const defaultNextCheckId = currentIndex < checkItemList.length - 1 ? checkItemList[currentIndex + 1] : null

  const nextCheckIds = new Set<string>()
  for (const option of item.options) {
    if (option.nextCheckId) {
      nextCheckIds.add(option.nextCheckId)
    } else if (defaultNextCheckId && (option.result === 'NEXT' || option.result === 'DEDUCT' || option.result === 'ADD' || option.result === 'REVIEW')) {
      nextCheckIds.add(defaultNextCheckId)
    }
  }

  let nextCheckItemsInfo = ''
  if (nextCheckIds.size > 0) {
    const nextItems: string[] = []
    for (const nextId of nextCheckIds) {
      const nextItem = checkItemMap.get(nextId)
      if (nextItem) {
        nextItems.push(`
[次の確認項目: ${nextId}]
質問: ${nextItem.question}
選択肢: ${nextItem.options.map(o => o.condition).join(' / ')}`)
      }
    }
    nextCheckItemsInfo = nextItems.join('\n')
  }

  return `
[現在の確認項目]
ID: ${item.id}
ステップ: ${item.stepName}
サブステップ: ${item.subStepName}
質問: ${item.question}
選択肢:
${item.options.map((o, i) => `${i + 1}. 条件: ${o.condition}
   結果: ${o.result}${o.explanation ? `\n   説明: ${o.explanation}` : ''}${o.nextCheckId ? `\n   次のID: ${o.nextCheckId}` : ''}`).join('\n')}
${defaultNextCheckId ? `\nデフォルトの次のID: ${defaultNextCheckId}` : '\n(これが最後の確認項目です)'}
${nextCheckItemsInfo}
`
}

export async function POST(req: Request) {
  const {
    messages,
    room_id,
    request_id,
    current_check_id,
    mode,
  }: {
    messages: UIMessage[];
    room_id?: string;
    request_id?: string;
    current_check_id?: string;
    mode?: 'flow' | 'qa' | 'unified';
  } = await req.json();

  const chatMode = mode || 'unified'
  const checkId = current_check_id || 'step0-sub0-check0'
  const checkItem = checkItemMap.get(checkId)
  console.log('[chat] room_id:', room_id, 'current_check_id:', checkId, 'mode:', chatMode)
  console.log('[chat] question:', checkItem?.question?.substring(0, 50) || 'not found')

  clearGeneratedSuggestions(request_id || 'default')

  interface FileData {
    url: string;
    mediaType: string;
    filename?: string;
  }

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

  const requestContext = new RequestContext<{ requestId: string; currentCheckId: string }>()
  requestContext.set("requestId", request_id || 'default')
  requestContext.set("currentCheckId", current_check_id || 'step0-sub0-check0')

  let messageText = userMessage
  if (chatMode === 'flow' || chatMode === 'unified') {
    const checkContext = getCheckItemContext(current_check_id || 'step0-sub0-check0')
    messageText = `${checkContext}\n[ユーザーの回答]: ${userMessage}`
  }

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

  const agentId = chatMode === 'unified' ? 'unifiedReviewAgent'
    : chatMode === 'flow' ? 'flowAgent'
    : 'qaAgent'

  const stream = await handleChatStream({
    mastra,
    agentId,
    params: {
      messages: inputMessages,
      memory: {
        thread: room_id || 'test-thread',
        resource: 'test-resource',
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

  return createUIMessageStreamResponse({ stream })
}
