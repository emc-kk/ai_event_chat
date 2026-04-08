import React, { useEffect, useState } from 'react'
import { getCompanySummary, type CompanySummary } from '@/lib/scraper-admin-api-client'

function statusBadge(status: string | null) {
  if (!status) return <span className="badge bg-secondary">未実行</span>
  const map: Record<string, string> = {
    completed: 'bg-success',
    running: 'bg-primary',
    failed: 'bg-danger',
  }
  const label: Record<string, string> = {
    completed: '成功',
    running: '実行中',
    failed: '失敗',
  }
  return <span className={`badge ${map[status] || 'bg-secondary'}`}>{label[status] || status}</span>
}

export function CompaniesTab() {
  const [companies, setCompanies] = useState<CompanySummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await getCompanySummary()
        setCompanies(data)
      } catch (e) {
        console.error('Failed to load company summary:', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleNavigate = (companyId: string) => {
    window.location.href = `/data_sources?company_id=${companyId}`
  }

  if (loading) {
    return <div className="text-center py-5"><div className="spinner-border" /></div>
  }

  if (companies.length === 0) {
    return <div className="text-center text-muted py-5">企業データなし</div>
  }

  return (
    <div className="row g-3">
      {companies.map(c => (
        <div className="col-md-6 col-lg-4" key={c.company_id}>
          <div
            className="card h-100"
            style={{ cursor: 'pointer' }}
            onClick={() => handleNavigate(c.company_id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') handleNavigate(c.company_id) }}
          >
            <div className="card-body">
              <h6 className="card-title mb-3">{c.company_name}</h6>

              <div className="d-flex flex-wrap gap-3 mb-2">
                <div>
                  <div className="text-muted small">ジョブ数</div>
                  <div className="fw-semibold">{c.jobs_active} / {c.jobs_total}</div>
                  <div className="text-muted" style={{ fontSize: '0.7rem' }}>アクティブ / 全体</div>
                </div>
                <div>
                  <div className="text-muted small">レコード総数</div>
                  <div className="fw-semibold">{c.record_count.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted small">直近の実行</div>
                  <div>{statusBadge(c.latest_run_status)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
