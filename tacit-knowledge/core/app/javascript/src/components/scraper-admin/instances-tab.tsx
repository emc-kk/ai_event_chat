import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { getInstances, type ScraperInstance } from '@/lib/scraper-admin-api-client'

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'active' ? 'bg-success'
    : status === 'online' ? 'bg-success'
    : status === 'offline' ? 'bg-danger'
    : status === 'busy' ? 'bg-warning text-dark'
    : 'bg-secondary'
  return <span className={`badge ${cls}`}>{status}</span>
}

function LoadBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0
  const cls = pct >= 80 ? 'bg-danger' : pct >= 50 ? 'bg-warning' : 'bg-success'
  return (
    <div className="progress" style={{ height: 16 }}>
      <div className={`progress-bar ${cls}`} style={{ width: `${pct}%` }}>
        {current}/{max}
      </div>
    </div>
  )
}

function formatTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function InstancesTab() {
  const [instances, setInstances] = useState<ScraperInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await getInstances()
      setInstances(data)
    } catch (e) {
      console.error('Failed to load instances:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  const statuses = useMemo(() => {
    const set = new Set(instances.map(i => i.status))
    return Array.from(set).sort()
  }, [instances])

  const filtered = useMemo(() => {
    if (!filterStatus) return instances
    return instances.filter(i => i.status === filterStatus)
  }, [instances, filterStatus])

  if (loading) return <div className="text-center py-5"><div className="spinner-border" /></div>

  if (instances.length === 0) {
    return <div className="text-center text-muted py-5">登録済みインスタンスなし</div>
  }

  return (
    <div>
      <div className="d-flex gap-2 mb-3 align-items-center">
        <select
          className="form-select form-select-sm"
          style={{ width: 160 }}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">全ステータス ({instances.length})</option>
          {statuses.map(s => (
            <option key={s} value={s}>{s} ({instances.filter(i => i.status === s).length})</option>
          ))}
        </select>
        <span className="text-muted small">{filtered.length} 件表示</span>
        <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={load}>
          <i className="fa-solid fa-refresh" /> 更新
        </button>
      </div>

      <div className="row">
        {filtered.map(inst => (
          <div className="col-md-6 col-lg-4 mb-3" key={inst.id}>
            <div className="card h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <h6 className="card-title mb-0" style={{ fontSize: '0.85rem' }}>{inst.name}</h6>
                  <StatusBadge status={inst.status} />
                </div>
                <div className="text-muted small mb-2">{inst.host}:{inst.port}</div>

                <div className="mb-2">
                  <div className="small text-muted mb-1">タスク負荷</div>
                  <LoadBar current={inst.current_tasks} max={inst.max_concurrency} />
                </div>

                {inst.capabilities && inst.capabilities.length > 0 && (
                  <div className="mb-2">
                    {inst.capabilities.map(cap => (
                      <span key={cap} className="badge bg-info me-1">{cap}</span>
                    ))}
                  </div>
                )}

                <div className="text-muted small">
                  最終チェック: {formatTime(inst.last_health_check_at)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
