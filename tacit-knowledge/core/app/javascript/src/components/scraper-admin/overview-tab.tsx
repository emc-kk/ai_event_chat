import React, { useEffect, useState, useCallback } from 'react'
import { getOverview, type OverviewData, type AdminRun } from '@/lib/scraper-admin-api-client'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'completed' ? 'bg-success'
    : status === 'failed' ? 'bg-danger'
    : status === 'running' ? 'bg-primary'
    : 'bg-secondary'
  return <span className={`badge ${cls}`}>{status}</span>
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="col-md-3 col-sm-6 mb-3">
      <div className="card h-100">
        <div className="card-body text-center">
          <div className="text-muted small mb-1">{label}</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{value}</div>
          {sub && <div className="text-muted small">{sub}</div>}
        </div>
      </div>
    </div>
  )
}

function formatTime(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const overview = await getOverview()
      setData(overview)
    } catch (e) {
      console.error('Failed to load overview:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>
  if (!data) return <div className="alert alert-danger">データの取得に失敗しました</div>

  const chartData = data.daily_stats.map(d => ({
    date: d.date,
    rate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
    total: d.total,
    completed: d.completed
  }))

  return (
    <div>
      <div className="row">
        <StatCard label="ジョブ総数" value={data.jobs_total} sub={`稼働中: ${data.jobs_by_status['active'] || 0}`} />
        <StatCard label="実行 (24h)" value={data.runs_24h} sub={`成功: ${data.completed_24h} / 失敗: ${data.failed_24h}`} />
        <StatCard
          label="成功率 (24h)"
          value={data.success_rate_24h != null ? `${data.success_rate_24h}%` : '-'}
        />
        <StatCard label="本日レコード" value={data.records_today} />
      </div>

      {chartData.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <strong>成功率トレンド (7日間)</strong>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(val) => `${val}%`} />
                <Area type="monotone" dataKey="rate" stroke="#198754" fill="#19875420" name="成功率" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <strong>最新の実行</strong>
        </div>
        <div className="table-responsive">
          <table className="table table-sm table-hover mb-0">
            <thead>
              <tr>
                <th>企業</th>
                <th>ジョブ</th>
                <th>ステータス</th>
                <th>タスク</th>
                <th>開始</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_runs.map((run: AdminRun) => (
                <tr key={run.id}>
                  <td>{run.company_name || '-'}</td>
                  <td>{run.job_name || '-'}</td>
                  <td><StatusBadge status={run.status} /></td>
                  <td>
                    <span className="text-success">{run.tasks_completed}</span>
                    {run.tasks_failed > 0 && <span className="text-danger ms-1">/ {run.tasks_failed} fail</span>}
                    <span className="text-muted ms-1">/ {run.tasks_total}</span>
                  </td>
                  <td>{formatTime(run.started_at)}</td>
                </tr>
              ))}
              {data.recent_runs.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted py-3">実行履歴なし</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
