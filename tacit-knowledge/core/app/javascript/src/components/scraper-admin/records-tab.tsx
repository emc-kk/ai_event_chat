import React, { useEffect, useState, useCallback } from 'react'
import { getRecordSummary, type RecordSummary } from '@/lib/scraper-admin-api-client'

interface Props {
  companies: { id: string; name: string }[]
}

function formatTime(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function estimateSizeMB(recordCount: number): string {
  // Approximate: ~2KB per record
  const mb = (recordCount * 2) / 1024
  return mb < 0.1 ? '< 0.1' : mb.toFixed(1)
}

export function RecordsTab({ companies }: Props) {
  const [summaries, setSummaries] = useState<RecordSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCompany, setFilterCompany] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getRecordSummary({
        company_id: filterCompany || undefined
      })
      setSummaries(data)
    } catch (e) {
      console.error('Failed to load record summary:', e)
    } finally {
      setLoading(false)
    }
  }, [filterCompany])

  useEffect(() => { load() }, [load])

  const totalRecords = summaries.reduce((sum, s) => sum + s.record_count, 0)

  const handleCsvDownload = (jobId: string) => {
    window.location.href = `/api/data_acquisition_records/csv?job_id=${jobId}`
  }

  return (
    <div>
      <div className="d-flex gap-2 mb-3 align-items-center">
        <select
          className="form-select form-select-sm"
          style={{ width: 180 }}
          value={filterCompany}
          onChange={e => setFilterCompany(e.target.value)}
        >
          <option value="">全企業</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-muted small ms-2">
          {summaries.length > 0 && `${summaries.length}ジョブ / ${totalRecords.toLocaleString()}件`}
        </span>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" /></div>
      ) : summaries.length === 0 ? (
        <div className="text-center text-muted py-5">レコードなし</div>
      ) : (
        <div className="row g-3">
          {summaries.map(s => (
            <div className="col-md-6 col-lg-4" key={s.job_id}>
              <div className="card h-100">
                <div className="card-body">
                  <h6 className="card-title mb-1">{s.job_name}</h6>
                  <p className="text-muted small mb-3">{s.company_name}</p>

                  <div className="d-flex flex-wrap gap-3 mb-3">
                    <div>
                      <div className="text-muted small">レコード数</div>
                      <div className="fw-semibold">{s.record_count.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted small">データサイズ</div>
                      <div className="fw-semibold">{estimateSizeMB(s.record_count)} MB</div>
                    </div>
                    <div>
                      <div className="text-muted small">最終取得日時</div>
                      <div className="fw-semibold">{formatTime(s.latest_fetched_at)}</div>
                    </div>
                  </div>
                </div>
                <div className="card-footer bg-transparent border-top-0 pt-0">
                  <button
                    className="btn btn-outline-primary btn-sm w-100"
                    onClick={() => handleCsvDownload(s.job_id)}
                  >
                    CSVダウンロード
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
