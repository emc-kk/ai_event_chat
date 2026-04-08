import React, { useState, useRef, useCallback } from 'react'

const ALLOWED_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt', 'csv', 'txt']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ACCEPT_TYPES = ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(',')

interface FileUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (files: File[]) => Promise<void>
}

export function FileUploadModal({ isOpen, onClose, onUpload }: FileUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const validateFiles = (files: File[]): string | null => {
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return `「${file.name}」は対応していないファイル形式です。対応形式: ${ALLOWED_EXTENSIONS.join(', ')}`
      }
      if (file.size > MAX_FILE_SIZE) {
        return `「${file.name}」のサイズが上限(50MB)を超えています`
      }
    }
    return null
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const fileArray = Array.from(files)
    const validationError = validateFiles(fileArray)
    if (validationError) {
      setError(validationError)
      return
    }
    setSelectedFiles(fileArray)
    setError('')
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return

    setLoading(true)
    setError('')
    try {
      await onUpload(selectedFiles)
      setSelectedFiles([])
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedFiles([])
    setError('')
    onClose()
  }

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">ファイルを追加</h5>
            <button type="button" className="btn-close" onClick={handleClose} />
          </div>
          <div className="modal-body">
            <div
              className={`border rounded p-5 text-center ${isDragging ? 'border-primary bg-light' : 'border-dashed'}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{ borderStyle: 'dashed', cursor: 'pointer' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <i className="fa-solid fa-cloud-arrow-up text-primary mb-3" style={{ fontSize: '2.5rem' }} />
              <p className="mb-2">ここにファイルをドラッグ&ドロップ</p>
              <button type="button" className="btn btn-outline-secondary btn-sm">
                ファイルを選択
              </button>
              <p className="text-muted small mt-2 mb-0">対応形式: {ALLOWED_EXTENSIONS.join(', ')} (最大50MB)</p>
              <input
                ref={fileInputRef}
                type="file"
                className="d-none"
                multiple
                accept={ACCEPT_TYPES}
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className="mt-3">
                <small className="text-muted">{selectedFiles.length}件のファイル選択中:</small>
                <ul className="list-unstyled mt-1">
                  {selectedFiles.map((f, i) => (
                    <li key={i} className="small">
                      <i className="fa-solid fa-file me-1" />{f.name}
                      <span className="text-muted ms-2">({(f.size / 1024).toFixed(1)} KB)</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && <div className="text-danger mt-2">{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={handleClose}>
              キャンセル
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={selectedFiles.length === 0 || loading}
              onClick={handleSubmit}
            >
              {loading ? 'アップロード中...' : 'アップロード'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
