import React, { useState } from 'react'
import { createJob, updateJob, type AdminJob } from '@/lib/scraper-admin-api-client'
import type { ColumnDef, JobDefinition } from '@/lib/data-acquisition-api-client'

interface Props {
  companies: { id: string; name: string }[]
  job: AdminJob | null
  onClose: () => void
  onSaved: () => void
}

const CRON_PRESETS = [
  { label: '毎日 8:00', value: '0 8 * * *' },
  { label: '毎日 12:00', value: '0 12 * * *' },
  { label: '毎週月曜 9:00', value: '0 9 * * 1' },
  { label: '毎時', value: '0 * * * *' },
]

const SOURCE_TYPES = [
  { value: 'csv_download', label: 'CSV ダウンロード' },
  { value: 'web_scrape', label: 'Web スクレイピング' },
  { value: 'pdf_download', label: 'PDF ダウンロード' },
  { value: 'api', label: 'API' },
]

export function JobFormDialog({ companies, job, onClose, onSaved }: Props) {
  const isEdit = !!job
  const def = job?.job_definition || {} as Partial<JobDefinition>

  const [companyId, setCompanyId] = useState(job?.company_id || '')
  const [name, setName] = useState(job?.name || '')
  const [description, setDescription] = useState(job?.description || '')
  const [status, setStatus] = useState<string>(job?.status || 'active')

  // Source
  const [sourceType, setSourceType] = useState<string>(def.source?.type || 'csv_download')
  const [sourceUrl, setSourceUrl] = useState(def.source?.url || '')
  const [sourceMethod, setSourceMethod] = useState(def.source?.method || 'GET')

  // Extraction
  const [columns, setColumns] = useState<ColumnDef[]>(def.extraction?.columns || [])

  // Schedule
  const [cron, setCron] = useState(def.schedule?.cron || '')

  // Chart
  const [chartType, setChartType] = useState<string>(def.dashboard?.chart_type || 'line')
  const [xAxis, setXAxis] = useState(def.dashboard?.x_axis || '')
  const [yAxes, setYAxes] = useState(def.dashboard?.y_axes?.join(', ') || '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addColumn = () => {
    setColumns([...columns, { source: '', name: '', type: 'text' }])
  }

  const updateColumn = (idx: number, field: keyof ColumnDef, value: string) => {
    const next = [...columns]
    next[idx] = { ...next[idx], [field]: value }
    setColumns(next)
  }

  const removeColumn = (idx: number) => {
    setColumns(columns.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const jobDef: Partial<JobDefinition> = {
      source: { type: sourceType as any, url: sourceUrl, method: sourceMethod },
      extraction: { columns },
      schedule: cron ? { cron } : undefined,
      dashboard: xAxis ? { chart_type: chartType as any, x_axis: xAxis, y_axes: yAxes.split(',').map(s => s.trim()).filter(Boolean) } : undefined,
    }

    try {
      if (isEdit && job) {
        await updateJob(job.id, { name, description, status, job_definition: jobDef })
      } else {
        await createJob({ company_id: companyId, name, description, status, job_definition: jobDef })
      }
      onSaved()
    } catch (err: any) {
      setError(err.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={e => e.stopPropagation()}>
        <form className="modal-content" onSubmit={handleSubmit}>
          <div className="modal-header">
            <h5 className="modal-title">{isEdit ? 'ジョブ編集' : '新規ジョブ作成'}</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {error && <div className="alert alert-danger">{error}</div>}

            {/* Basic Info */}
            <h6 className="mb-2">基本情報</h6>
            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label">企業</label>
                <select className="form-select" value={companyId} onChange={e => setCompanyId(e.target.value)} required disabled={isEdit}>
                  <option value="">選択...</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">ステータス</label>
                <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">ジョブ名</label>
              <input className="form-control" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label">説明</label>
              <textarea className="form-control" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <hr />

            {/* Source */}
            <h6 className="mb-2">ソース設定</h6>
            <div className="row mb-3">
              <div className="col-md-4">
                <label className="form-label">種別</label>
                <select className="form-select" value={sourceType} onChange={e => setSourceType(e.target.value)}>
                  {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">メソッド</label>
                <select className="form-select" value={sourceMethod} onChange={e => setSourceMethod(e.target.value)}>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">URL</label>
                <input className="form-control" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>

            <hr />

            {/* Extraction */}
            <h6 className="mb-2">抽出カラム</h6>
            {columns.map((col, i) => (
              <div className="row mb-2 align-items-end" key={i}>
                <div className="col-md-4">
                  <input className="form-control form-control-sm" placeholder="ソースフィールド" value={col.source} onChange={e => updateColumn(i, 'source', e.target.value)} />
                </div>
                <div className="col-md-4">
                  <input className="form-control form-control-sm" placeholder="表示名" value={col.name} onChange={e => updateColumn(i, 'name', e.target.value)} />
                </div>
                <div className="col-md-2">
                  <select className="form-select form-select-sm" value={col.type} onChange={e => updateColumn(i, 'type', e.target.value as any)}>
                    <option value="text">text</option>
                    <option value="number">number</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => removeColumn(i)}>
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-outline-secondary btn-sm mb-3" onClick={addColumn}>
              + カラム追加
            </button>

            <hr />

            {/* Schedule */}
            <h6 className="mb-2">スケジュール</h6>
            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label">Cron 式</label>
                <input className="form-control" value={cron} onChange={e => setCron(e.target.value)} placeholder="0 8 * * *" />
              </div>
              <div className="col-md-6">
                <label className="form-label">プリセット</label>
                <div className="d-flex gap-1 flex-wrap">
                  {CRON_PRESETS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      className={`btn btn-sm ${cron === p.value ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setCron(p.value)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <hr />

            {/* Dashboard */}
            <h6 className="mb-2">ダッシュボード表示 (任意)</h6>
            <div className="row mb-3">
              <div className="col-md-3">
                <label className="form-label">チャート種別</label>
                <select className="form-select" value={chartType} onChange={e => setChartType(e.target.value)}>
                  <option value="line">折れ線</option>
                  <option value="bar">棒</option>
                  <option value="area">エリア</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">X軸カラム</label>
                <input className="form-control" value={xAxis} onChange={e => setXAxis(e.target.value)} placeholder="date" />
              </div>
              <div className="col-md-5">
                <label className="form-label">Y軸カラム (カンマ区切り)</label>
                <input className="form-control" value={yAxes} onChange={e => setYAxes(e.target.value)} placeholder="price, volume" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>キャンセル</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '保存中...' : isEdit ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
