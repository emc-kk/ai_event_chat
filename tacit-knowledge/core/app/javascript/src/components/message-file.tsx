import React, { useState } from 'react'
import { ChatFileData } from '../types/chat'
import { Download } from './icons/download'
import { FileIcon } from './icons/file'
import { formatFileSize } from '../lib/file'

interface MessageFileProps {
  file: ChatFileData
}

export const MessageFile: React.FC<MessageFileProps> = ({ file }) => {
  const [isHovered, setIsHovered] = useState(false)
  const [imageError, setImageError] = useState(false)

  const isImage = file.type.startsWith('image/')
  const shouldShowImage = isImage && !imageError

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/chat_files/download?s3_key=${encodeURIComponent(file.s3_key)}`)
      
      if (!response.ok) {
        throw new Error('ダウンロードに失敗しました')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('ファイルのダウンロードに失敗しました:', error)
      alert('ファイルのダウンロードに失敗しました')
    }
  }

  if (shouldShowImage) {
    return (
      <div 
        className="relative inline-block mt-2"
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleDownload}
      >
        <img
          src={file.url}
          alt={file.name}
          onError={() => setImageError(true)}
          className="max-w-sm rounded-lg"
          style={{ maxHeight: '300px' }}
        />
        {isHovered && (
          <div className="absolute inset-0 rounded-lg flex items-center justify-center transition-opacity" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', cursor: 'pointer' }}>
            <Download className="h-6 w-6 text-white" />
          </div>
        )}
        <p className="text-xs opacity-70 mt-1">{file.name}</p>
      </div>
    )
  }

  return (
    <div 
      className="relative mt-2 p-2 rounded-lg flex items-center gap-2 justify-start"
      style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', cursor: 'pointer' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleDownload}
    >
      <FileIcon className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate max-w-[200px]">{file.name}</p>
        <p className="text-xs opacity-70">{formatFileSize(file.size)}</p>
      </div>
      {isHovered && (
        <div className="absolute inset-0 rounded-lg flex items-center justify-center transition-opacity" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', cursor: 'pointer' }}>
          <Download className="h-5 w-5 text-white" />
        </div>
      )}
    </div>
  )
}

