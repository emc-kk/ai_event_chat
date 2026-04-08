import React, { useState } from 'react'

interface DeleteConfirmModalProps {
  isOpen: boolean
  itemName: string
  itemType: 'folder' | 'file'
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function DeleteConfirmModal({ isOpen, itemName, itemType, onClose, onConfirm }: DeleteConfirmModalProps) {
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">削除の確認</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <p>
              {itemType === 'folder'
                ? `フォルダ「${itemName}」とその中のすべてのファイルを削除しますか？`
                : `ファイル「${itemName}」を削除しますか？`
              }
            </p>
            <p className="text-muted small">この操作は取り消せません。</p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              キャンセル
            </button>
            <button type="button" className="btn btn-danger" onClick={handleConfirm} disabled={loading}>
              {loading ? '削除中...' : '削除する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
