import React, { useRef, useEffect } from 'react'
import type { DSItem } from '../../lib/datasource-api-client'

interface ContextMenuProps {
  item: DSItem
  onRename: () => void
  onMove: () => void
  onDownload?: () => void
  onDelete: () => void
  onPermissions?: () => void
  onClose: () => void
  isOpen: boolean
}

export function ContextMenu({ item, onRename, onMove, onDownload, onDelete, onPermissions, onClose, isOpen }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div ref={menuRef} className="dropdown-menu show" style={{ position: 'absolute', right: 0, top: '100%', zIndex: 1000 }}>
      <button className="dropdown-item" onClick={onRename}>
        <i className="fa-solid fa-pen me-2" />名前の変更
      </button>
      <button className="dropdown-item" onClick={onMove}>
        <i className="fa-solid fa-arrows-alt me-2" />移動
      </button>
      {item.type === 'file' && onDownload && (
        <button className="dropdown-item" onClick={onDownload}>
          <i className="fa-solid fa-download me-2" />ダウンロード
        </button>
      )}
      {item.type === 'folder' && onPermissions && (
        <button className="dropdown-item" onClick={onPermissions}>
          <i className="fa-solid fa-shield-halved me-2" />権限設定
        </button>
      )}
      <div className="dropdown-divider" />
      <button className="dropdown-item text-danger" onClick={onDelete}>
        <i className="fa-solid fa-trash me-2" />削除
      </button>
    </div>
  )
}
