import React, { useState, useEffect, useCallback } from 'react'
import type { DAJob } from '../../lib/data-acquisition-api-client'
import { getJobs, triggerJob } from '../../lib/data-acquisition-api-client'
import { JobCard } from './job-card'
import { JobDetailPanel } from './job-detail-panel'

function SetupGuide() {
  const [open, setOpen] = useState(false)
  return (
    <div className="card border-0 shadow-sm mx-auto" style={{ maxWidth: 600 }}>
      <div
        className="card-body"
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <i className="fa-solid fa-circle-info text-primary me-2" />
            <span className="fw-semibold small">新しいデータ取得のセットアップ方法</span>
          </div>
          <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} text-muted small`} />
        </div>
        {open && (
          <div className="mt-3 text-start small text-muted">
            <ol className="mb-2 ps-3">
              <li className="mb-1">取得したいデータソースのURL・種類（CSV / Webページ / API）を整理</li>
              <li className="mb-1">取得頻度（毎日・毎週など）と必要なカラムを決定</li>
              <li className="mb-1"><strong>@taiziii</strong> に Slack でセットアップを依頼</li>
            </ol>
            <div className="bg-light rounded p-2 mt-2">
              <div className="fw-semibold mb-1" style={{ fontSize: 12 }}>依頼テンプレート:</div>
              <code style={{ fontSize: 11, whiteSpace: 'pre-wrap' }}>
{`データ取得セットアップ依頼
- 対象URL: https://example.com/data
- 種類: CSV / Webスクレイピング / API
- 取得頻度: 毎日 9:00
- 必要カラム: 日付, 金額, カテゴリ
- 備考: Shift-JIS エンコーディング`}
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function DataAcquisitionTab() {
  const [jobs, setJobs] = useState<DAJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [triggeringId, setTriggeringId] = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getJobs()
      setJobs(data)
      setError(null)
    } catch (err) {
      console.error('Failed to load jobs:', err)
      setError('ジョブの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const handleTrigger = async (jobId: string) => {
    setTriggeringId(jobId)
    try {
      await triggerJob(jobId)
      await loadJobs()
    } catch (err) {
      console.error('Failed to trigger job:', err)
    } finally {
      setTriggeringId(null)
    }
  }

  const handleSelect = (jobId: string) => {
    setSelectedJobId(prev => prev === jobId ? null : jobId)
  }

  const selectedJob = jobs.find(j => j.id === selectedJobId) ?? null
  const activeJobs = jobs.filter(j => j.status === 'active')
  const inactiveJobs = jobs.filter(j => j.status !== 'active')

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <i className="fa-solid fa-circle-exclamation me-2" />
        {error}
        <button className="btn btn-link btn-sm" onClick={loadJobs}>再試行</button>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-5">
        <i className="fa-solid fa-database text-muted mb-3" style={{ fontSize: 48 }} />
        <h5 className="text-muted">データ取得ジョブが設定されていません</h5>
        <p className="text-muted small mb-4">
          新しいデータ取得ジョブのセットアップをご希望の場合は、<br />
          <strong>@taiziii</strong> までご連絡ください。
        </p>
        <SetupGuide />
      </div>
    )
  }

  return (
    <div>
      {/* Refresh button */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-muted small">
          {activeJobs.length} 件のアクティブジョブ
          {inactiveJobs.length > 0 && ` / ${inactiveJobs.length} 件の非アクティブジョブ`}
        </span>
        <button className="btn btn-outline-secondary btn-sm" onClick={loadJobs}>
          <i className="fa-solid fa-arrows-rotate me-1" />更新
        </button>
      </div>

      {/* Job cards grid */}
      <div className="row g-3 mb-4">
        {activeJobs.map(job => (
          <div className="col-md-6 col-lg-4" key={job.id}>
            <JobCard
              job={job}
              isSelected={job.id === selectedJobId}
              isTriggering={job.id === triggeringId}
              onSelect={() => handleSelect(job.id)}
              onTrigger={() => handleTrigger(job.id)}
            />
          </div>
        ))}
      </div>

      {/* Inactive jobs (collapsed) */}
      {inactiveJobs.length > 0 && (
        <details className="mb-4">
          <summary className="text-muted small mb-2" style={{ cursor: 'pointer' }}>
            非アクティブジョブ ({inactiveJobs.length})
          </summary>
          <div className="row g-3 mt-1">
            {inactiveJobs.map(job => (
              <div className="col-md-6 col-lg-4" key={job.id}>
                <JobCard
                  job={job}
                  isSelected={job.id === selectedJobId}
                  isTriggering={job.id === triggeringId}
                  onSelect={() => handleSelect(job.id)}
                  onTrigger={() => handleTrigger(job.id)}
                />
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Detail panel */}
      {selectedJob && (
        <JobDetailPanel job={selectedJob} />
      )}

      {/* Setup guide */}
      <div className="mt-4">
        <SetupGuide />
      </div>
    </div>
  )
}
