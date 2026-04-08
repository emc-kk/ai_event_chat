import React, { useState, useEffect, useRef } from 'react'
import {
  GlossaryTerm,
  getGlossaryTerms,
  createGlossaryTerm,
  updateGlossaryTerm,
  deleteGlossaryTerm,
  importGlossaryTerms,
} from '../../lib/glossary-api-client'
import { GlossaryForm } from './glossary-form'

type SortKey = 'term' | 'created_at' | 'updated_at'
type SortDir = 'asc' | 'desc'

export const GlossaryApp: React.FC = () => {
  const [terms, setTerms] = useState<GlossaryTerm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('term')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const container = document.getElementById('glossary-app')
  const canEdit = container?.getAttribute('data-can-edit') === 'true'

  useEffect(() => {
    loadTerms()
  }, [])

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => { setError(null); setSuccess(null) }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  const loadTerms = async () => {
    try {
      setLoading(true)
      const data = await getGlossaryTerms()
      setTerms(data)
      setError(null)
    } catch (e) {
      console.error('Failed to load glossary terms:', e)
      setError('用語の読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (term: string, definition: string, termGroup?: string) => {
    try {
      await createGlossaryTerm(term, definition, termGroup)
      setShowForm(false)
      await loadTerms()
    } catch (e: any) {
      throw e
    }
  }

  const handleUpdate = async (term: string, definition: string, termGroup?: string) => {
    if (!editingTerm) return
    try {
      await updateGlossaryTerm(editingTerm.id, term, definition, termGroup)
      setEditingTerm(null)
      await loadTerms()
    } catch (e: any) {
      throw e
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('この用語を削除してもよろしいですか？')) return
    try {
      await deleteGlossaryTerm(id)
      await loadTerms()
    } catch (e) {
      console.error('Failed to delete term:', e)
      setError('削除に失敗しました')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await importGlossaryTerms(file)
      const messages: string[] = []
      if (result.created > 0) messages.push(`${result.created}件を追加`)
      if (result.skipped > 0) messages.push(`${result.skipped}件をスキップ（重複/空行）`)
      if (result.errors?.length > 0) messages.push(`${result.errors.length}件のエラー`)
      setSuccess(`CSVインポート完了: ${messages.join('、')}`)
      await loadTerms()
    } catch (e: any) {
      setError(e.message || 'CSVインポートに失敗しました')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleExportCSV = () => {
    const header = 'term,definition,term_group'
    const rows = terms.map(t => {
      const escapedTerm = `"${t.term.replace(/"/g, '""')}"`
      const escapedDef = `"${t.definition.replace(/"/g, '""')}"`
      const escapedGroup = `"${(t.term_group || '').replace(/"/g, '""')}"`
      return `${escapedTerm},${escapedDef},${escapedGroup}`
    })
    const csv = [header, ...rows].join('\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `glossary_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadTemplate = () => {
    const csv = 'term,definition,term_group\nKPI報告書,月次の重要業績評価指標をまとめた報告書,報告書\nOKR会議,目標と成果指標の進捗確認会議,会議'
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'glossary_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <i className="fa-solid fa-sort text-muted ms-1" style={{ fontSize: '0.7em' }} />
    return sortDir === 'asc'
      ? <i className="fa-solid fa-sort-up ms-1" style={{ fontSize: '0.7em' }} />
      : <i className="fa-solid fa-sort-down ms-1" style={{ fontSize: '0.7em' }} />
  }

  const filteredTerms = terms
    .filter(
      (t) =>
        t.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.definition.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.term_group || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'term') return mul * a.term.localeCompare(b.term, 'ja')
      if (sortKey === 'created_at') return mul * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      return mul * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
    })

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">社内辞書</h5>
        {canEdit && (
          <div className="d-flex gap-2">
            <div className="dropdown">
              <button className="btn btn-outline-secondary btn-sm dropdown-toggle" data-bs-toggle="dropdown">
                <i className="fa-solid fa-file-csv me-1" />CSV
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li>
                  <button className="dropdown-item" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                    <i className="fa-solid fa-file-import me-2" />
                    {importing ? 'インポート中...' : 'CSVインポート'}
                  </button>
                </li>
                <li>
                  <button className="dropdown-item" onClick={handleExportCSV} disabled={terms.length === 0}>
                    <i className="fa-solid fa-file-export me-2" />CSVエクスポート
                  </button>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <button className="dropdown-item" onClick={handleDownloadTemplate}>
                    <i className="fa-solid fa-download me-2" />テンプレートをダウンロード
                  </button>
                </li>
              </ul>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setShowForm(true); setEditingTerm(null) }}
            >
              <i className="fa-solid fa-plus me-1"></i>
              用語を追加
            </button>
          </div>
        )}
      </div>

      {/* Toast notifications */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1080, minWidth: 300, maxWidth: 450 }}>
        {error && (
          <div className="alert alert-danger alert-dismissible fade show shadow-sm mb-2" role="alert">
            {error}
            <button type="button" className="btn-close" onClick={() => setError(null)} />
          </div>
        )}
        {success && (
          <div className="alert alert-success alert-dismissible fade show shadow-sm mb-2" role="alert">
            {success}
            <button type="button" className="btn-close" onClick={() => setSuccess(null)} />
          </div>
        )}
      </div>

      {(showForm || editingTerm) && (
        <GlossaryForm
          initialTerm={editingTerm?.term || ''}
          initialDefinition={editingTerm?.definition || ''}
          initialTermGroup={editingTerm?.term_group || ''}
          onSubmit={editingTerm ? handleUpdate : handleCreate}
          onCancel={() => { setShowForm(false); setEditingTerm(null) }}
          isEditing={!!editingTerm}
        />
      )}

      <div className="mb-3">
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="用語を検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredTerms.length === 0 ? (
        <div className="text-center text-muted py-4">
          {terms.length === 0
            ? '用語が登録されていません'
            : '検索条件に一致する用語がありません'}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover table-sm">
            <thead className="table-light">
              <tr>
                <th style={{ width: '40px' }}>No.</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('term')}>
                  用語{sortIcon('term')}
                </th>
                <th style={{ width: '120px' }}>用語グループ</th>
                <th>定義</th>
                <th style={{ width: '100px' }}>登録者</th>
                <th style={{ width: '100px', cursor: 'pointer' }} onClick={() => toggleSort('created_at')}>
                  登録日{sortIcon('created_at')}
                </th>
                <th style={{ width: '100px' }}>更新者</th>
                <th style={{ width: '100px', cursor: 'pointer' }} onClick={() => toggleSort('updated_at')}>
                  更新日{sortIcon('updated_at')}
                </th>
                {canEdit && <th style={{ width: '100px' }}>操作</th>}
              </tr>
            </thead>
            <tbody>
              {filteredTerms.map((term, index) => (
                <tr key={term.id}>
                  <td className="text-muted small">{index + 1}</td>
                  <td className="fw-semibold">{term.term}</td>
                  <td className="text-muted small">{term.term_group || '-'}</td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{term.definition}</td>
                  <td className="text-muted small">{term.created_by_name || '-'}</td>
                  <td className="text-muted small">
                    {new Date(term.created_at).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="text-muted small">{term.updated_by_name || '-'}</td>
                  <td className="text-muted small">
                    {new Date(term.updated_at).toLocaleDateString('ja-JP')}
                  </td>
                  {canEdit && (
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => { setEditingTerm(term); setShowForm(false) }}
                          title="編集"
                        >
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => handleDelete(term.id)}
                          title="削除"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-muted small mt-2">
        {filteredTerms.length !== terms.length
          ? `${filteredTerms.length} / ${terms.length} 件表示`
          : `${terms.length} 件の用語が登録されています`}
      </div>
    </div>
  )
}
