import React from 'react'
import type { DAJobRun } from '../../lib/data-acquisition-api-client'

interface RunHistoryTableProps {
  runs: DAJobRun[]
  loading: boolean
}

const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; label: string }> = {
    running: { bg: 'bg-primary', label: '実行中' },
    completed: { bg: 'bg-success', label: '完了' },
    failed: { bg: 'bg-danger', label: '失敗' },
  }
  const s = map[status] ?? { bg: 'bg-secondary', label: status }
  return <span className={`badge ${s.bg}`}>{s.label}</span>
}

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleString('ja-JP', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

export function RunHistoryTable({ runs, loading }: RunHistoryTableProps) {
  if (loading) {
    return (
      <div className="text-center py-3">
        <div className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <p className="text-muted small text-center py-3 mb-0">実行履歴はありません</p>
    )
  }

  return (
    <div className="table-responsive">
      <table className="table table-sm table-hover mb-0">
        <thead className="table-light">
          <tr>
            <th>ステータス</th>
            <th>開始</th>
            <th>完了</th>
            <th>タスク</th>
            <th>失敗</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => (
            <tr key={run.id}>
              <td>{statusBadge(run.status)}</td>
              <td className="small">{formatDate(run.started_at)}</td>
              <td className="small">{formatDate(run.completed_at)}</td>
              <td className="small">{run.tasks_completed}/{run.tasks_total}</td>
              <td className="small">
                {run.tasks_failed > 0 ? (
                  <span className="text-danger">{run.tasks_failed}</span>
                ) : (
                  <span className="text-muted">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
