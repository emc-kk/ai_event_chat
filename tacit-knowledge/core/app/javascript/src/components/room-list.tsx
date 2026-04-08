import React from 'react'

export interface Room {
  id: string
  name: string
  createdAt: string
  isFinished?: boolean
  isDeleted?: boolean
}

export interface RoomListProps {
  rooms: Room[]
  currentRoomId: string
  chatType: 'hearing' | 'topic'
  onRoomSelect: (roomId: string) => void
  onCreateNewRoom?: () => void
}

export const RoomList: React.FC<RoomListProps> = ({
  rooms,
  currentRoomId,
  chatType,
  onRoomSelect,
  onCreateNewRoom
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRoomDisplayName = (room: Room) => {
    const typeLabel = chatType === 'hearing' ? 'ヒアリングチャット' : 'トピックチャット'
    return `${typeLabel} ${formatDate(room.createdAt)}`
  }

  return (
    <div className="col-md-2 border-end bg-light p-0">
      {chatType === 'topic' && onCreateNewRoom && (
        <div className="p-2 border-bottom">
          <button
            onClick={onCreateNewRoom}
            className="btn btn-sm btn-outline-primary w-100"
            style={{ fontSize: '0.7rem' }}
          >
            <i className="bi bi-plus-circle me-1"></i>
            新規トピックチャット
          </button>
        </div>
      )}
      <div className="room-list" style={{ height: 'calc(100vh - 160px)', overflowY: 'auto' }}>
        {rooms.map((room) => (
          <div
            key={room.id}
            className={`room-item p-2 border-bottom ${currentRoomId === room.id ? 'current-room' : ''}`}
            onClick={() => onRoomSelect(room.id)}
            style={{ 
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: currentRoomId === room.id 
                ? '#d0d0d0' 
                : 'transparent'
            }}
            onMouseEnter={(e) => {
              if (currentRoomId !== room.id) {
                e.currentTarget.style.background = '#f0f0f0'
              }
            }}
            onMouseLeave={(e) => {
              if (currentRoomId !== room.id) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            <div 
              className="room-title small text-truncate" 
              title={getRoomDisplayName(room)}
              style={{ fontWeight: currentRoomId === room.id ? 500 : 400 }}
            >
              {getRoomDisplayName(room)}
            </div>
            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
              {formatDate(room.createdAt)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
