import React, { useState } from 'react'

interface GlossaryFormProps {
  initialTerm: string
  initialDefinition: string
  initialTermGroup: string
  onSubmit: (term: string, definition: string, termGroup?: string) => Promise<void>
  onCancel: () => void
  isEditing: boolean
}

export const GlossaryForm: React.FC<GlossaryFormProps> = ({
  initialTerm,
  initialDefinition,
  initialTermGroup,
  onSubmit,
  onCancel,
  isEditing,
}) => {
  const [term, setTerm] = useState(initialTerm)
  const [definition, setDefinition] = useState(initialDefinition)
  const [termGroup, setTermGroup] = useState(initialTermGroup)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!term.trim() || !definition.trim()) return

    try {
      setSubmitting(true)
      setError(null)
      await onSubmit(term.trim(), definition.trim(), termGroup.trim() || undefined)
    } catch (e: any) {
      setError(e.message || '保存に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card mb-3">
      <div className="card-body">
        <h6 className="card-title">{isEditing ? '用語を編集' : '新しい用語を追加'}</h6>
        {error && (
          <div className="alert alert-danger alert-sm py-1 px-2 small">{error}</div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-2">
            <label className="form-label small">用語</label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="例: KPI報告書"
              required
              autoFocus
            />
          </div>
          <div className="mb-2">
            <label className="form-label small">用語グループ</label>
            <input
              type="text"
              className="form-control form-control-sm"
              value={termGroup}
              onChange={(e) => setTermGroup(e.target.value)}
              placeholder="例: 報告書、会議、設備"
            />
          </div>
          <div className="mb-2">
            <label className="form-label small">定義</label>
            <textarea
              className="form-control form-control-sm"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder="この用語の社内での意味を記入してください"
              rows={3}
              required
            />
          </div>
          <div className="d-flex gap-2">
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submitting || !term.trim() || !definition.trim()}
            >
              {submitting ? '保存中...' : isEditing ? '更新' : '追加'}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={onCancel}
              disabled={submitting}
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
