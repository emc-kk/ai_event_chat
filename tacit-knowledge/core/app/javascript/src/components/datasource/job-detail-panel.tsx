import React, { useState, useEffect, useCallback } from 'react'
import type { DAJob, DAJobRun, DARecord } from '../../lib/data-acquisition-api-client'
import { getJobRuns, getRecords } from '../../lib/data-acquisition-api-client'
import { DynamicChart } from './dynamic-chart'
import { DateRangeSelector } from './date-range-selector'
import { RunHistoryTable } from './run-history-table'
import { CsvDownloadBtn } from './csv-download-btn'

interface JobDetailPanelProps {
  job: DAJob
}

export function JobDetailPanel({ job }: JobDetailPanelProps) {
  const [records, setRecords] = useState<DARecord[]>([])
  const [runs, setRuns] = useState<DAJobRun[]>([])
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [fetchedAfter, setFetchedAfter] = useState('')
  const [fetchedBefore, setFetchedBefore] = useState('')
  const [activeSection, setActiveSection] = useState<'chart' | 'history'>('chart')

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true)
    try {
      const data = await getRecords({
        job_id: job.id,
        fetched_after: fetchedAfter || undefined,
        fetched_before: fetchedBefore || undefined,
        limit: 500,
      })
      setRecords(data)
    } catch (err) {
      console.error('Failed to load records:', err)
    } finally {
      setLoadingRecords(false)
    }
  }, [job.id, fetchedAfter, fetchedBefore])

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true)
    try {
      const data = await getJobRuns(job.id)
      setRuns(data)
    } catch (err) {
      console.error('Failed to load runs:', err)
    } finally {
      setLoadingRuns(false)
    }
  }, [job.id])

  useEffect(() => {
    loadRecords()
    loadRuns()
  }, [loadRecords, loadRuns])

  const columns = job.job_definition?.extraction?.columns || []
  const sourceUrl = job.job_definition?.source?.url
  const schedule = job.job_definition?.schedule?.cron

  return (
    <div className="card border-primary">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <div>
          <h5 className="mb-1">{job.name}</h5>
          <p className="text-muted small mb-0">{job.description}</p>
        </div>
        <CsvDownloadBtn
          jobId={job.id}
          fetchedAfter={fetchedAfter}
          fetchedBefore={fetchedBefore}
        />
      </div>

      <div className="card-body">
        {/* Job metadata */}
        <div className="row mb-3">
          <div className="col-auto">
            <span className="text-muted small">
              <i className="fa-solid fa-link me-1" />
              {sourceUrl ? (
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                  ソースURL
                </a>
              ) : '—'}
            </span>
          </div>
          {schedule && (
            <div className="col-auto">
              <span className="text-muted small">
                <i className="fa-regular fa-clock me-1" />
                {schedule}
              </span>
            </div>
          )}
          <div className="col-auto">
            <span className="text-muted small">
              <i className="fa-solid fa-table-columns me-1" />
              {columns.length} カラム
            </span>
          </div>
          <div className="col-auto">
            <span className="text-muted small">
              <i className="fa-solid fa-layer-group me-1" />
              {job.record_count.toLocaleString()} 件
            </span>
          </div>
        </div>

        {/* Date range selector */}
        <div className="mb-3">
          <DateRangeSelector
            fetchedAfter={fetchedAfter}
            fetchedBefore={fetchedBefore}
            onChangeAfter={setFetchedAfter}
            onChangeBefore={setFetchedBefore}
          />
        </div>

        {/* Section tabs */}
        <ul className="nav nav-pills nav-fill mb-3">
          <li className="nav-item">
            <button
              className={`nav-link ${activeSection === 'chart' ? 'active' : ''}`}
              onClick={() => setActiveSection('chart')}
            >
              <i className="fa-solid fa-chart-line me-1" />グラフ
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeSection === 'history' ? 'active' : ''}`}
              onClick={() => setActiveSection('history')}
            >
              <i className="fa-solid fa-clock-rotate-left me-1" />実行履歴
            </button>
          </li>
        </ul>

        {/* Content */}
        {activeSection === 'chart' ? (
          <div>
            {loadingRecords ? (
              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            ) : (
              <DynamicChart
                records={records}
                jobDefinition={job.job_definition}
              />
            )}

            {/* Data preview table */}
            {!loadingRecords && records.length > 0 && (
              <details className="mt-3">
                <summary className="text-muted small" style={{ cursor: 'pointer' }}>
                  データプレビュー (直近 {Math.min(records.length, 10)} 件)
                </summary>
                <div className="table-responsive mt-2">
                  <table className="table table-sm table-hover" style={{ fontSize: 12 }}>
                    <thead className="table-light">
                      <tr>
                        {columns.map(col => (
                          <th key={col.name}>{col.name}</th>
                        ))}
                        <th>取得日</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.slice(0, 10).map(r => (
                        <tr key={r.id}>
                          {columns.map(col => (
                            <td key={col.name}>
                              {String(r.data[col.name] ?? '—')}
                            </td>
                          ))}
                          <td className="text-muted">
                            {new Date(r.fetched_at).toLocaleDateString('ja-JP')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        ) : (
          <RunHistoryTable runs={runs} loading={loadingRuns} />
        )}
      </div>
    </div>
  )
}
