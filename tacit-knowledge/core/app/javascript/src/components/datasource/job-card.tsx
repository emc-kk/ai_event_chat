import React from 'react'
import type { DAJob } from '../../lib/data-acquisition-api-client'
import { downloadCsv } from '../../lib/data-acquisition-api-client'

interface JobCardProps {
  job: DAJob
  isSelected: boolean
  isTriggering: boolean
  onSelect: () => void
  onTrigger: () => void
}

const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; label: string }> = {
    active: { bg: 'bg-success', label: 'アクティブ' },
    paused: { bg: 'bg-warning text-dark', label: '一時停止' },
    failed: { bg: 'bg-danger', label: 'エラー' },
    schema_change: { bg: 'bg-info text-dark', label: 'スキーマ変更' },
  }
  const s = map[status] ?? { bg: 'bg-secondary', label: status }
  return <span className={`badge ${s.bg}`}>{s.label}</span>
}

const sourceIcon = (type?: string) => {
  switch (type) {
    case 'csv_download': return 'fa-solid fa-file-csv'
    case 'web_scrape': return 'fa-solid fa-globe'
    case 'pdf_download': return 'fa-solid fa-file-pdf'
    case 'api': return 'fa-solid fa-plug'
    default: return 'fa-solid fa-database'
  }
}

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleString('ja-JP', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function JobCard({ job, isSelected, isTriggering, onSelect, onTrigger }: JobCardProps) {
  const sourceType = job.job_definition?.source?.type

  return (
    <div
      className={`card h-100 ${isSelected ? 'border-primary shadow-sm' : ''}`}
      style={{ cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s' }}
      onClick={onSelect}
    >
      <div className="card-body d-flex flex-column">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div className="d-flex align-items-center gap-2">
            <i className={`${sourceIcon(sourceType)} text-muted`} />
            <h6 className="card-title mb-0 text-truncate" style={{ maxWidth: 200 }}>
              {job.name}
            </h6>
          </div>
          {statusBadge(job.status)}
        </div>

        {/* Description */}
        <p className="card-text text-muted small mb-2 text-truncate">
          {job.description || '説明なし'}
        </p>

        {/* Stats */}
        <div className="d-flex gap-3 mb-3 small text-muted">
          <span>
            <i className="fa-solid fa-layer-group me-1" />
            {job.record_count.toLocaleString()} 件
          </span>
          <span>
            <i className="fa-regular fa-clock me-1" />
            {formatDate(job.last_run?.completed_at || job.last_run?.started_at)}
          </span>
        </div>

        {/* Last run status */}
        {job.last_run && (
          <div className="mb-3">
            <div className="d-flex justify-content-between small mb-1">
              <span className="text-muted">
                {job.last_run.status === 'running' ? '実行中...' : '最終実行'}
              </span>
              {job.last_run.status === 'running' && (
                <span className="text-primary">
                  {job.last_run.tasks_completed}/{job.last_run.tasks_total}
                </span>
              )}
            </div>
            {job.last_run.status === 'running' && (
              <div className="progress" style={{ height: 4 }}>
                <div
                  className="progress-bar progress-bar-striped progress-bar-animated"
                  style={{
                    width: `${job.last_run.tasks_total > 0
                      ? (job.last_run.tasks_completed / job.last_run.tasks_total) * 100
                      : 0}%`
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto d-flex gap-2">
          <button
            className="btn btn-outline-secondary btn-sm flex-grow-1"
            onClick={(e) => { e.stopPropagation(); downloadCsv({ job_id: job.id }) }}
            title="CSVダウンロード"
          >
            <i className="fa-solid fa-download me-1" />CSV
          </button>
          <button
            className="btn btn-outline-primary btn-sm flex-grow-1"
            onClick={(e) => { e.stopPropagation(); onTrigger() }}
            disabled={isTriggering || job.status !== 'active'}
            title="手動実行"
          >
            {isTriggering ? (
              <><span className="spinner-border spinner-border-sm me-1" />実行中</>
            ) : (
              <><i className="fa-solid fa-play me-1" />実行</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
