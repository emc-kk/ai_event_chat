import { Room } from '../components/room-list'

const getCSRFToken = (): string => {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

const defaultHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'X-CSRF-Token': getCSRFToken()
})

// Rooms API
interface RoomsListParams {
  chatType: 'hearing' | 'topic'
  requestId?: string
  topicId?: string
}

interface RoomsListResponse {
  rooms: Room[]
}

export const getRoomsList = async (params: RoomsListParams): Promise<RoomsListResponse> => {
  const searchParams = new URLSearchParams({ chat_type: params.chatType })
  if (params.requestId) searchParams.append('request_id', params.requestId)
  if (params.topicId) searchParams.append('topic_id', params.topicId)

  const response = await fetch(`/api/rooms/list?${searchParams.toString()}`, {
    method: 'GET',
    headers: defaultHeaders()
  })

  if (!response.ok) {
    throw new Error('Failed to fetch rooms')
  }

  return response.json()
}

interface CreateRoomParams {
  chatType: 'hearing' | 'topic'
  requestId?: string | null
  topicId?: string | null
  requestContentId?: string | null
}

interface CreateRoomResponse {
  success: boolean
  room: {
    id: string
    created_at: string
  }
  error?: string
}

export const createRoom = async (params: CreateRoomParams): Promise<CreateRoomResponse> => {
  const response = await fetch('/api/rooms', {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({
      chat_type: params.chatType,
      request_id: params.requestId || null,
      topic_id: params.topicId || null,
      request_content_id: params.requestContentId || null
    })
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Failed to create room')
  }

  return response.json()
}

interface FindOrCreateRoomResponse {
  success: boolean
  room: {
    id: string
    created_at: string
    is_new: boolean
  }
  error?: string
}

export const findOrCreateRoom = async (params: CreateRoomParams): Promise<FindOrCreateRoomResponse> => {
  const response = await fetch('/api/rooms/find_or_create', {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({
      chat_type: params.chatType,
      request_id: params.requestId || null,
      topic_id: params.topicId || null,
      request_content_id: params.requestContentId || null
    })
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Failed to find or create room')
  }

  return response.json()
}

interface RoomResponse {
  success: boolean
  room: {
    id: string
    chat_type: string
    request_id: string | null
    topic_id: string | null
    request_content_id: string | null
    is_finished: boolean
    is_deleted: boolean
    created_at: string
  }
}

export const getRoom = async (roomId: string): Promise<RoomResponse> => {
  const response = await fetch(`/api/rooms/${roomId}`, {
    method: 'GET',
    headers: defaultHeaders()
  })

  if (!response.ok) {
    throw new Error('Failed to fetch room')
  }

  return response.json()
}

// Messages API
interface Message {
  id: string
  content: string
  type: 'user' | 'assistant'
  chat_type: string
  created_at: string
  updated_at: string
}

interface MessagesListResponse {
  messages: Message[]
}

export const getMessages = async (roomId: string): Promise<MessagesListResponse> => {
  const response = await fetch(`/api/messages?room_id=${roomId}`, {
    method: 'GET',
    headers: defaultHeaders()
  })

  if (!response.ok) {
    throw new Error('Failed to fetch messages')
  }

  return response.json()
}
