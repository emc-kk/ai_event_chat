import React, { useEffect, useState, useCallback } from 'react'
import { getAdminRuns, type AdminRun } from '@/lib/scraper-admin-api-client'

interface Props {
  companies: { id: string; name: string }[]
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'completed' ? 'bg-success'
    : status === 'failed' ? 'bg-danger'
    : status === 'running' ? 'bg-primary'
    : 'bg-secondary'
  return <span className={`badge ${cls}`}>{status}</span>
}

function formatTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function durationMs(start: string, end: string | null): number | null {
  if (!end) return null
  return new Date(end).getTime() - new Date(start).getTime()
}

function formatDuration(ms: number | null) {
  if (ms === null) return '実行中'
  if (ms < 60_000) return `${Math.round(ms / 1000)}秒`
  return `${Math.round(ms / 60_000)}分`
}

// Lambda コスト概算 (ap-northeast-1, arm64)
// Coordinator: 256MB, Receiver: 128MB, Writer: 256MB
// 1run = Coordinator 1回 + Receiver N回 + Writer ceil(N/10)回
// 料金: $0.0000000021/ms (128MB), $0.0000000042/ms (256MB)
function estimateCost(run: AdminRun): string | null {
  const ms = durationMs(run.started_at, run.completed_at)
  if (ms === null) return null

  const tasks = run.tasks_total || 1
  // Coordinator: run全体の duration × 256MB
  const coordinatorCost = ms * 0.0000000042
  // Receiver: タスク数 × 平均50ms × 128MB
  const receiverCost = tasks * 50 * 0.0000000021
  // Writer: ceil(タスク数/10) × 平均200ms × 256MB
  const writerCost = Math.ceil(tasks / 10) * 200 * 0.0000000042

  const totalUsd = coordinatorCost + receiverCost + writerCost
  if (totalUsd < 0.001) return `$${(totalUsd * 1000).toFixed(2)}m`
  return `$${totalUsd.toFixed(4)}`
}

export function RunsTab({ companies }: Props) {
  const [runs, setRuns] = useState<AdminRun[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filterCompany, setFilterCompany] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const per = 30

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAdminRuns({
        page,
        per,
        company_id: filterCompany || undefined,
        status: filterStatus || undefined
      })
      setRuns(res.data)
      setTotal(res.meta.total)
    } catch (e) {
      console.error('Failed to load runs:', e)
    } finally {
      setLoading(false)
    }
  }, [page, filterCompany, filterStatus])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / per)

  return (
    <div>
      <div className="d-flex gap-2 mb-3">
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
          <option value="running">running</option>
          <option value="completed">completed</option>
          <option value="failed">failed</option>
        </select>
        <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={load}>
          <i className="fa-solid fa-refresh" /> 更新
        </button>
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
                  <th>ジョブ</th>
                  <th>ステータス</th>
                  <th>タスク (完了/失敗/全体)</th>
                  <th>所要時間</th>
                  <th>コスト</th>
                  <th>開始</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.id}>
                    <td>{run.company_name || '-'}</td>
                    <td>{run.job_name || '-'}</td>
                    <td><StatusBadge status={run.status} /></td>
                    <td>
                      <span className="text-success">{run.tasks_completed}</span>
                      {' / '}
                      <span className="text-danger">{run.tasks_failed}</span>
                      {' / '}
                      {run.tasks_total}
                    </td>
                    <td>{formatDuration(durationMs(run.started_at, run.completed_at))}</td>
                    <td className="text-muted">{estimateCost(run) || '-'}</td>
                    <td>{formatTime(run.started_at)}</td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted py-3">実行履歴なし</td></tr>
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
    </div>
  )
}
