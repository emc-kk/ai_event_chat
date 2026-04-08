import React, { useState, useEffect, useCallback } from 'react'
import type { DSFolder, DSItem, BreadcrumbItem } from '../../lib/datasource-api-client'
import { getFolderContents } from '../../lib/datasource-api-client'

interface MoveModalProps {
  isOpen: boolean
  item: DSItem
  currentFolderId: string | null
  onClose: () => void
  onSubmit: (targetFolderId: string | null) => Promise<void>
}

export function MoveModal({ isOpen, item, currentFolderId, onClose, onSubmit }: MoveModalProps) {
  const [browseFolderId, setBrowseFolderId] = useState<string | null>(null)
  const [folders, setFolders] = useState<DSFolder[]>([])
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([])
  const [loadingContents, setLoadingContents] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadFolder = useCallback(async (folderId: string | null) => {
    setLoadingContents(true)
    try {
      const data = await getFolderContents(folderId)
      // 自分自身のフォルダは除外（フォルダ移動時）
      const filtered = item.type === 'folder'
        ? data.folders.filter((f: DSFolder) => f.id !== item.id)
        : data.folders
      setFolders(filtered)
      setBreadcrumb(data.breadcrumb)
    } catch {
      setFolders([])
      setBreadcrumb([])
    } finally {
      setLoadingContents(false)
    }
  }, [item])

  useEffect(() => {
    if (!isOpen) return
    setBrowseFolderId(null)
    setError('')
    loadFolder(null)
  }, [isOpen, loadFolder])

  useEffect(() => {
    if (!isOpen) return
    loadFolder(browseFolderId)
  }, [browseFolderId, isOpen, loadFolder])

  if (!isOpen) return null

  const isCurrent = browseFolderId === currentFolderId

  const handleDrillDown = (folder: DSFolder) => {
    setBrowseFolderId(folder.id)
  }

  const handleBreadcrumbClick = (folderId: string | null) => {
    setBrowseFolderId(folderId)
  }

  const handleSubmit = async () => {
    if (isCurrent) {
      setError('現在と同じフォルダです')
      return
    }

    setLoading(true)
    setError('')
    try {
      await onSubmit(browseFolderId)
      onClose()
    } catch (err: any) {
      setError(err.message || '移動に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setError('')
    onClose()
  }

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fa-solid fa-arrows-alt me-2" />
              「{item.name}」を移動
            </h5>
            <button type="button" className="btn-close" onClick={handleClose} />
          </div>
          <div className="modal-body">
            <p className="text-muted mb-2">移動先のフォルダを選択してください</p>

            {/* Breadcrumb */}
            <nav aria-label="breadcrumb" className="mb-2">
              <ol className="breadcrumb mb-0" style={{ fontSize: '0.85em' }}>
                <li className={`breadcrumb-item ${browseFolderId === null ? 'active' : ''}`}>
                  {browseFolderId === null ? (
                    <span><i className="fa-solid fa-house me-1" />ルート</span>
                  ) : (
                    <a href="#" onClick={(e) => { e.preventDefault(); handleBreadcrumbClick(null) }}>
                      <i className="fa-solid fa-house me-1" />ルート
                    </a>
                  )}
                </li>
                {breadcrumb.map((crumb, idx) => {
                  const isLast = idx === breadcrumb.length - 1
                  return (
                    <li key={crumb.id} className={`breadcrumb-item ${isLast ? 'active' : ''}`}>
                      {isLast ? (
                        <span>{crumb.name}</span>
                      ) : (
                        <a href="#" onClick={(e) => { e.preventDefault(); handleBreadcrumbClick(crumb.id) }}>
                          {crumb.name}
                        </a>
                      )}
                    </li>
                  )
                })}
              </ol>
            </nav>

            {/* Folder list */}
            <div className="border rounded" style={{ maxHeight: 300, overflowY: 'auto' }}>
              {loadingContents ? (
                <div className="text-center py-4">
                  <div className="spinner-border spinner-border-sm text-primary" role="status" />
                </div>
              ) : folders.length === 0 ? (
                <div className="text-center text-muted py-4" style={{ fontSize: '0.9em' }}>
                  サブフォルダはありません
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {folders.map(folder => (
                    <button
                      key={folder.id}
                      type="button"
                      className="list-group-item list-group-item-action d-flex align-items-center py-2"
                      onClick={() => handleDrillDown(folder)}
                    >
                      <i className="fa-solid fa-folder text-warning me-2" />
                      <span className="text-truncate flex-grow-1">{folder.name}</span>
                      {folder.id === currentFolderId && (
                        <span className="badge bg-secondary ms-2" style={{ fontSize: '0.65em' }}>現在地</span>
                      )}
                      <i className="fa-solid fa-chevron-right text-muted ms-2" style={{ fontSize: 10 }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isCurrent && (
              <div className="text-muted mt-2" style={{ fontSize: '0.85em' }}>
                <i className="fa-solid fa-info-circle me-1" />
                現在と同じフォルダです
              </div>
            )}
            {error && !isCurrent && <div className="text-danger mt-2">{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={handleClose}>
              キャンセル
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || isCurrent}
              onClick={handleSubmit}
            >
              {loading ? '移動中...' : 'ここに移動'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
