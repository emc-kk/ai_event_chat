import React, { useEffect, useState, useCallback } from 'react'
import { getAdminJobs, triggerJob, type AdminJob } from '@/lib/scraper-admin-api-client'
import { JobFormDialog } from './job-form-dialog'
import { AiJobGenerator } from './ai-job-generator'

interface Props {
  companies: { id: string; name: string }[]
  aiServerUrl?: string
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'active' ? 'bg-success'
    : status === 'paused' ? 'bg-warning text-dark'
    : status === 'failed' ? 'bg-danger'
    : 'bg-secondary'
  return <span className={`badge ${cls}`}>{status}</span>
}

function formatTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function JobsTab({ companies, aiServerUrl }: Props) {
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filterCompany, setFilterCompany] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showAiGenerator, setShowAiGenerator] = useState(false)
  const [editJob, setEditJob] = useState<AdminJob | null>(null)
  const per = 20

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAdminJobs({
        page,
        per,
        company_id: filterCompany || undefined,
        status: filterStatus || undefined
      })
      setJobs(res.data)
      setTotal(res.meta.total)
    } catch (e) {
      console.error('Failed to load jobs:', e)
    } finally {
      setLoading(false)
    }
  }, [page, filterCompany, filterStatus])

  useEffect(() => { load() }, [load])

  const handleTrigger = async (jobId: string) => {
    try {
      await triggerJob(jobId)
      load()
    } catch (e) {
      console.error('Failed to trigger:', e)
    }
  }

  const totalPages = Math.ceil(total / per)

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex gap-2">
          <select
            className="form-select form-select-sm"
            style={{ width: 180 }}
            value={filterCompany}
            onChange={e => { setFilterCompany(e.target.value); setPage(1) }}
          >
            <option value="">全企業</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            className="form-select form-select-sm"
            style={{ width: 140 }}
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          >
            <option value="">全ステータス</option>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="failed">failed</option>
          </select>
        </div>
        <div className="d-flex gap-2">
          {aiServerUrl && (
            <button className="btn btn-outline-primary btn-sm" onClick={() => setShowAiGenerator(true)}>
              <i className="fa-solid fa-wand-magic-sparkles me-1" />
              AI で作成
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => { setEditJob(null); setShowForm(true) }}>
            + 新規ジョブ
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" /></div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-sm table-hover">
              <thead>
                <tr>
                  <th>企業</th>
                  <th>ジョブ名</th>
                  <th>ステータス</th>
                  <th>スケジュール</th>
                  <th>最終実行</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id}>
                    <td>{job.company_name || '-'}</td>
                    <td>
                      <strong>{job.name}</strong>
                      {job.description && <div className="text-muted small">{job.description}</div>}
                    </td>
                    <td><StatusBadge status={job.status} /></td>
                    <td><code className="small">{job.cron || '-'}</code></td>
                    <td>
                      {job.last_run ? (
                        <div>
                          <StatusBadge status={job.last_run.status} />{' '}
                          <span className="small">{formatTime(job.last_run.started_at)}</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button
                          className="btn btn-outline-primary"
                          onClick={() => handleTrigger(job.id)}
                          title="手動実行"
                        >
                          <i className="fa-solid fa-play" />
                        </button>
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => { setEditJob(job); setShowForm(true) }}
                          title="編集"
                        >
                          <i className="fa-solid fa-pen" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted py-3">ジョブなし</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav>
              <ul className="pagination pagination-sm justify-content-center">
                <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(p => p - 1)}>前</button>
                </li>
                <li className="page-item disabled">
                  <span className="page-link">{page} / {totalPages}</span>
                </li>
                <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(p => p + 1)}>次</button>
                </li>
              </ul>
            </nav>
          )}
        </>
      )}

      {showForm && (
        <JobFormDialog
          companies={companies}
          job={editJob}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}

      {showAiGenerator && aiServerUrl && (
        <AiJobGenerator
          aiServerUrl={aiServerUrl}
          companies={companies}
          onClose={() => setShowAiGenerator(false)}
          onSaved={() => { setShowAiGenerator(false); load() }}
        />
      )}
    </div>
  )
}
