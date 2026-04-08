import React, { useState, useEffect } from 'react'
import { ChatRoom } from './chat-room'
import { RoomList, Room } from './room-list'
import { getRoomsList, createRoom } from '../lib/api-client'

export const ChatApp: React.FC = () => {
  const [roomId, setRoomId] = useState<string>('')
  const [isInputDisabled, setIsInputDisabled] = useState<boolean>(false)
  const [requestId, setRequestId] = useState<string>('')
  const [chatType, setChatType] = useState<'hearing' | 'topic' | undefined>(undefined)
  const [topicId, setTopicId] = useState<string>('')
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [apiUrl, setApiUrl] = useState<string>('')
  const [apiKey, setApiKey] = useState<string>('')
  const [fileIds, setFileIds] = useState<string[]>([])

  useEffect(() => {
    initializeRoom()
  }, [])

  useEffect(() => {
    if (chatType) {
      loadRooms(chatType, roomId, requestId, topicId)
    }
  }, [requestId, topicId, chatType, roomId])

  const initializeRoom = async () => {
    try {
      const chatAppElement = document.getElementById('chat-app')
      const roomIdAttr = chatAppElement?.getAttribute('data-room-id')
      const requestIdAttr = chatAppElement?.getAttribute('data-request-id')
      const topicIdAttr = chatAppElement?.getAttribute('data-topic-id')
      const chatTypeAttr = chatAppElement?.getAttribute('data-room-type') as 'hearing' | 'topic' | null

      if (roomIdAttr) {
        setRoomId(roomIdAttr)
      }

      if (requestIdAttr) {
        setRequestId(requestIdAttr)
      }

      if (topicIdAttr) {
        setTopicId(topicIdAttr)
      }

      if (chatTypeAttr) {
        setChatType(chatTypeAttr)
      }

      const fileIdsAttr = chatAppElement?.getAttribute('data-file-ids')
      if (fileIdsAttr) {
        try {
          const parsed = JSON.parse(fileIdsAttr)
          if (Array.isArray(parsed)) setFileIds(parsed)
        } catch { /* ignore */ }
      }

      const aiServerUrl = chatAppElement?.getAttribute('data-ai-server-url')
        || process.env.AI_SERVER_URL
        || ''

      const aiApiKey = chatAppElement?.getAttribute('data-ai-api-key') || ''
      setApiKey(aiApiKey)

      if (chatTypeAttr === 'hearing') {
        setApiUrl(`${aiServerUrl}/api/hearing`)
      } else if (chatTypeAttr === 'topic') {
        setApiUrl(`${aiServerUrl}/api/topic`)
      } else {
        setApiUrl(`${aiServerUrl}/api/chat`)
      }

    } catch (error) {
      console.error('room初期化エラー:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadRooms = async (
    type: 'hearing' | 'topic',
    currentRoomId: string,
    reqId: string,
    tpcId: string
  ) => {
    try {
      const data = await getRoomsList({
        chatType: type,
        requestId: reqId || undefined,
        topicId: tpcId || undefined
      })

      setRooms(data.rooms || [])

      const currentRoomData = data.rooms.find((room: Room) => room.id === currentRoomId)
      if (currentRoomData) {
        setCurrentRoom(currentRoomData)
        setIsInputDisabled((currentRoomData.isFinished ?? false) || (currentRoomData.isDeleted ?? false))
      } else if (data.rooms.length > 0) {
        setCurrentRoom(data.rooms[0])
        setIsInputDisabled((data.rooms[0].isFinished ?? false) || (data.rooms[0].isDeleted ?? false))
      }
    } catch (error) {
      console.error('ルーム一覧の取得に失敗しました:', error)
    }
  }

  const handleRoomSelect = async (selectedRoomId: string) => {
    if (selectedRoomId === roomId) return

    try {
      setRoomId(selectedRoomId)

      window.history.pushState({}, '', `/rooms/${selectedRoomId}`)

      const selectedRoom = rooms.find(room => room.id === selectedRoomId)
      if (selectedRoom) {
        setCurrentRoom(selectedRoom)
        setIsInputDisabled((selectedRoom.isFinished ?? false) || (selectedRoom.isDeleted ?? false))
      }
    } catch (error) {
      console.error('ルーム切り替えエラー:', error)
    }
  }

  const handleCreateNewRoom = async () => {
    try {
      const data = await createRoom({
        chatType: chatType!,
        requestId: requestId || null,
        topicId: topicId || null,
        requestContentId: null
      })

      if (data.success) {
        const newRoomId = data.room.id
        const roomLabel = 'トピックチャット'

        const newRoom: Room = {
          id: newRoomId,
          name: `${roomLabel} ${new Date().toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
          createdAt: data.room.created_at || new Date().toISOString(),
          isFinished: false,
          isDeleted: false
        }
        setCurrentRoom(newRoom)
        setIsInputDisabled(false)

        setRoomId(newRoomId)

        window.history.pushState({}, '', `/rooms/${newRoomId}`)

        await loadRooms(chatType!, newRoomId, requestId, topicId)
      }
    } catch (error) {
      console.error('新しいルームの作成に失敗しました:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="w-100 d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">読み込み中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container-fluid h-100" style={{ paddingTop: 0 }}>
      <div className="row h-100">
        {chatType && (
          <RoomList
            rooms={rooms}
            currentRoomId={roomId}
            chatType={chatType}
            onRoomSelect={handleRoomSelect}
            onCreateNewRoom={chatType === 'topic' ? handleCreateNewRoom : undefined}
          />
        )}

        <div className={chatType ? "col-md-10" : "col-12"} style={{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="chat-container position-relative" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {roomId && (
              <ChatRoom
                key={roomId}
                roomId={roomId}
                requestId={requestId}
                chatType={chatType}
                topicId={topicId}
                isInputDisabled={isInputDisabled}
                url={apiUrl}
                apiKey={apiKey}
                fileIds={fileIds}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
