import React, { useState, useEffect } from 'react'

interface RenameModalProps {
  isOpen: boolean
  currentName: string
  itemType: 'folder' | 'file'
  onClose: () => void
  onSubmit: (newName: string) => Promise<void>
}

export function RenameModal({ isOpen, currentName, itemType, onClose, onSubmit }: RenameModalProps) {
  const [name, setName] = useState(currentName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setName(currentName)
    setError('')
  }, [currentName, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || name.trim() === currentName) return

    setLoading(true)
    setError('')
    try {
      await onSubmit(name.trim())
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">名前の変更</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <label className="form-label">
                {itemType === 'folder' ? 'フォルダ名' : 'ファイル名'}
              </label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              {error && <div className="text-danger mt-2">{error}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                キャンセル
              </button>
              <button type="submit" className="btn btn-primary" disabled={!name.trim() || name.trim() === currentName || loading}>
                {loading ? '変更中...' : '変更する'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
