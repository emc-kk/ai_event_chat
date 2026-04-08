import React, { useState } from 'react'

interface CompanyOption {
  id: string
  name: string
}

interface NewFolderModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string, companyId?: string) => Promise<void>
  privilegedAdmin?: boolean
  companies?: CompanyOption[]
  currentFolderId?: string | null
}

export function NewFolderModal({ isOpen, onClose, onSubmit, privilegedAdmin = false, companies = [], currentFolderId }: NewFolderModalProps) {
  const [name, setName] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Show company selector only for privileged admin at root level (no parent folder)
  const showCompanySelector = privilegedAdmin && !currentFolderId && companies.length > 0

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (showCompanySelector && !companyId) {
      setError('会社を選択してください')
      return
    }

    setLoading(true)
    setError('')
    try {
      await onSubmit(name.trim(), showCompanySelector ? companyId : undefined)
      setName('')
      setCompanyId('')
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setName('')
    setCompanyId('')
    setError('')
    onClose()
  }

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">新規フォルダ作成</h5>
            <button type="button" className="btn-close" onClick={handleClose} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {showCompanySelector && (
                <div className="mb-3">
                  <label className="form-label fw-bold">会社</label>
                  <select
                    className="form-select"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    required
                  >
                    <option value="">会社を選択してください</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <label className="form-label">フォルダ名</label>
              <input
                type="text"
                className="form-control"
                placeholder="例: 2026年度_安全規定"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              {error && <div className="text-danger mt-2">{error}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={handleClose}>
                キャンセル
              </button>
              <button type="submit" className="btn btn-primary" disabled={!name.trim() || loading}>
                {loading ? '作成中...' : '作成する'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
