import React, { useState, useEffect, useCallback } from 'react'
import { getLinkedDataSources, unlinkDataSourcesFromTopic, linkDataSourcesToTopic, getFolderContents, type TopicDataSourceLink, type DSFile, type DSFolder, type BreadcrumbItem } from '../../lib/datasource-api-client'

interface KnowledgeAppProps {
  topicId: string
  onStartSearch: (fileIds: string[]) => void
}

const FileIcon: React.FC<{ fileType: string }> = ({ fileType }) => {
  const iconMap: Record<string, { icon: string; color: string }> = {
    pdf: { icon: 'fa-file-pdf', color: '#dc3545' },
    xlsx: { icon: 'fa-file-excel', color: '#198754' },
    xls: { icon: 'fa-file-excel', color: '#198754' },
    docx: { icon: 'fa-file-word', color: '#0d6efd' },
    doc: { icon: 'fa-file-word', color: '#0d6efd' },
    pptx: { icon: 'fa-file-powerpoint', color: '#fd7e14' },
    ppt: { icon: 'fa-file-powerpoint', color: '#fd7e14' },
    csv: { icon: 'fa-file-csv', color: '#198754' },
    txt: { icon: 'fa-file-lines', color: '#6c757d' },
  }
  const { icon, color } = iconMap[fileType] || { icon: 'fa-file', color: '#6c757d' }
  return <i className={`fa-solid ${icon}`} style={{ color, fontSize: '1.1em' }} />
}

const AiStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: '完了', cls: 'bg-success' },
    processing: { label: '処理中', cls: 'bg-warning text-dark' },
    pending: { label: '待機中', cls: 'bg-secondary' },
    failed: { label: '失敗', cls: 'bg-danger' },
  }
  const { label, cls } = map[status] || { label: status, cls: 'bg-secondary' }
  return <span className={`badge ${cls}`} style={{ fontSize: '0.75em' }}>{label}</span>
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// DS Browser Modal for B-direction linking
const DsBrowserModal: React.FC<{
  show: boolean
  topicId: string
  onClose: () => void
  onLinked: () => void
}> = ({ show, topicId, onClose, onLinked }) => {
  const [folderId, setFolderId] = useState<string | null>(null)
  const [folders, setFolders] = useState<DSFolder[]>([])
  const [files, setFiles] = useState<DSFile[]>([])
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLinking, setIsLinking] = useState(false)

  const loadContents = useCallback(async () => {
    try {
      const data = await getFolderContents(folderId)
      setFolders(data.folders)
      setFiles(data.files.filter(f => f.ai_status === 'completed'))
      setBreadcrumb(data.breadcrumb)
    } catch (e) {
      console.error('Failed to load folder contents:', e)
    }
  }, [folderId])

  useEffect(() => {
    if (show) {
      loadContents()
      setSelectedIds(new Set())
    }
  }, [show, loadContents])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleLink = async () => {
    if (selectedIds.size === 0) return
    setIsLinking(true)
    try {
      await linkDataSourcesToTopic(topicId, Array.from(selectedIds))
      onLinked()
      onClose()
    } catch (e) {
      console.error('Failed to link:', e)
      alert('リンクに失敗しました')
    } finally {
      setIsLinking(false)
    }
  }

  if (!show) return null

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">ナレッジ追加</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body" style={{ minHeight: 300 }}>
            {/* Breadcrumb */}
            <nav aria-label="breadcrumb" className="mb-3">
              <ol className="breadcrumb mb-0">
                <li className={`breadcrumb-item ${!folderId ? 'active' : ''}`}>
                  <a href="#" onClick={e => { e.preventDefault(); setFolderId(null) }}>
                    <i className="fa-solid fa-house" />
                  </a>
                </li>
                {breadcrumb.map((item, i) => (
                  <li key={item.id} className={`breadcrumb-item ${i === breadcrumb.length - 1 ? 'active' : ''}`}>
                    {i === breadcrumb.length - 1 ? item.name : (
                      <a href="#" onClick={e => { e.preventDefault(); setFolderId(item.id) }}>{item.name}</a>
                    )}
                  </li>
                ))}
              </ol>
            </nav>

            <table className="table table-hover table-sm">
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  <th>名前</th>
                  <th style={{ width: 100 }}>サイズ</th>
                </tr>
              </thead>
              <tbody>
                {folders.map(folder => (
                  <tr key={folder.id} style={{ cursor: 'pointer' }} onClick={() => setFolderId(folder.id)}>
                    <td />
                    <td>
                      <i className="fa-solid fa-folder" style={{ color: '#ffc107', marginRight: 8 }} />
                      {folder.name}
                    </td>
                    <td />
                  </tr>
                ))}
                {files.map(file => (
                  <tr key={file.id} className={selectedIds.has(file.id) ? 'table-primary' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedIds.has(file.id)}
                        onChange={() => toggleSelect(file.id)}
                      />
                    </td>
                    <td>
                      <FileIcon fileType={file.file_type} />
                      <span className="ms-2">{file.name}</span>
                    </td>
                    <td className="text-muted small">{formatFileSize(file.file_size)}</td>
                  </tr>
                ))}
                {folders.length === 0 && files.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-muted py-4">ファイルがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="modal-footer">
            <span className="me-auto text-muted small">
              {selectedIds.size > 0 && `${selectedIds.size}件選択中`}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>キャンセル</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleLink}
              disabled={selectedIds.size === 0 || isLinking}
            >
              {isLinking ? '追加中...' : '追加'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const KnowledgeApp: React.FC<KnowledgeAppProps> = ({ topicId, onStartSearch }) => {
  const [links, setLinks] = useState<TopicDataSourceLink[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [showBrowser, setShowBrowser] = useState(false)

  const loadLinks = useCallback(async () => {
    try {
      const data = await getLinkedDataSources(topicId)
      setLinks(data.links)
    } catch (e) {
      console.error('Failed to load linked DS:', e)
    } finally {
      setIsLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    loadLinks()
  }, [loadLinks])

  const toggleSelect = (fileId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(fileId)) next.delete(fileId)
      else next.add(fileId)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === links.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(links.map(l => l.data_source_file_id)))
    }
  }

  const handleUnlink = async (fileIds: string[]) => {
    if (!confirm('選択したファイルをトピックから解除しますか？（ファイル自体は削除されません）')) return
    try {
      await unlinkDataSourcesFromTopic(topicId, fileIds)
      setSelectedIds(prev => {
        const next = new Set(prev)
        fileIds.forEach(id => next.delete(id))
        return next
      })
      await loadLinks()
    } catch (e) {
      console.error('Failed to unlink:', e)
      alert('解除に失敗しました')
    }
  }

  const handleSearch = () => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : links.map(l => l.data_source_file_id)
    onStartSearch(ids)
  }

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: 300 }}>
        <div className="spinner-border" role="status">
          <span className="visually-hidden">読み込み中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-100 d-flex flex-column" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div className="p-3 border-bottom bg-white d-flex justify-content-between align-items-center" style={{ flexShrink: 0 }}>
        <div>
          <span className="fw-bold">ナレッジ</span>
          <span className="text-muted ms-2 small">{links.length}ファイル</span>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-primary btn-sm" onClick={() => setShowBrowser(true)}>
            <i className="fa-solid fa-plus me-1" />ナレッジ追加
          </button>
        </div>
      </div>

      {/* File list */}
      <div className="flex-grow-1" style={{ overflow: 'auto' }}>
        {links.length === 0 ? (
          <div className="text-center text-muted py-5">
            <i className="fa-solid fa-folder-open fa-2x mb-3 d-block" />
            <p>ナレッジが追加されていません</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowBrowser(true)}>
              <i className="fa-solid fa-plus me-1" />ナレッジを追加
            </button>
          </div>
        ) : (
          <table className="table table-hover table-sm mb-0">
            <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={selectedIds.size === links.length && links.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th>ファイル名</th>
                <th style={{ width: 100 }}>ステータス</th>
                <th style={{ width: 100 }}>サイズ</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {links.map(link => (
                <tr key={link.id} className={selectedIds.has(link.data_source_file_id) ? 'table-primary' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={selectedIds.has(link.data_source_file_id)}
                      onChange={() => toggleSelect(link.data_source_file_id)}
                    />
                  </td>
                  <td>
                    <FileIcon fileType={link.file_type || ''} />
                    <span className="ms-2">{link.file_name}</span>
                  </td>
                  <td><AiStatusBadge status={link.ai_status || ''} /></td>
                  <td className="text-muted small">{link.file_size ? formatFileSize(link.file_size) : '-'}</td>
                  <td>
                    <button
                      className="btn btn-link btn-sm text-danger p-0"
                      title="解除"
                      onClick={() => handleUnlink([link.data_source_file_id])}
                    >
                      <i className="fa-solid fa-link-slash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Action bar */}
      {links.length > 0 && (
        <div className="p-3 border-top bg-white d-flex justify-content-between align-items-center" style={{ flexShrink: 0 }}>
          <span className="text-muted small">
            {selectedIds.size > 0
              ? `${selectedIds.size}件選択中 - 選択したファイルを対象に検索`
              : '全ファイルを対象に検索'}
          </span>
          <div className="d-flex gap-2">
            {selectedIds.size > 0 && (
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={() => handleUnlink(Array.from(selectedIds))}
              >
                <i className="fa-solid fa-link-slash me-1" />選択を解除
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={handleSearch}>
              <i className="fa-solid fa-magnifying-glass me-1" />ナレッジ検索
            </button>
          </div>
        </div>
      )}

      {/* DS Browser Modal */}
      <DsBrowserModal
        show={showBrowser}
        topicId={topicId}
        onClose={() => setShowBrowser(false)}
        onLinked={loadLinks}
      />
    </div>
  )
}
