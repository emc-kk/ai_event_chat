import type { SourceNode } from './source'

export type ChatType = 'hearing' | 'validation' | 'topic'

export interface ChatRequest {
  messages: ChatMessage[]
  roomId: string
  topicId?: string
  requestId?: string
  directoryPath?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatResponse {
  response: string
  roomId: string
  status: 'success' | 'error'
  sources?: SourceNode[]
}

export interface InitialMessageRequest {
  requestId: string
  chatType: ChatType
  roomId: string
}

export interface InitialMessageResponse {
  response: string
  status: 'success' | 'error'
}

export interface RequestData {
  id: string
  name: string
  description: string
  context: string
  topicId: string
  topicName: string
  topicDescription: string
}

export interface TopicData {
  id: string
  name: string
  description: string
  companyId?: string
}
