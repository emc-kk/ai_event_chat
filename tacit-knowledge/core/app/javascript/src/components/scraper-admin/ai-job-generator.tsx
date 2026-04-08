import React, { useState } from 'react'
import { generateJobWithAI, createJob, type AdminJob } from '@/lib/scraper-admin-api-client'
import type { JobDefinition } from '@/lib/data-acquisition-api-client'

interface Props {
  aiServerUrl: string
  companies: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}

interface GenerationResult {
  job_definition: JobDefinition | null
  job_name: string | null
  description: string | null
  source_url: string | null
  reasoning: string
}

export function AiJobGenerator({ aiServerUrl, companies, onClose, onSaved }: Props) {
  const [prompt, setPrompt] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 保存用
  const [companyId, setCompanyId] = useState('')
  const [saving, setSaving] = useState(false)

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await generateJobWithAI(aiServerUrl, prompt, url || undefined)
      setResult(data)
    } catch (err: any) {
      setError(err.message || '生成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!result?.job_definition || !companyId || !result.job_name) return
    setSaving(true)
    setError(null)

    try {
      await createJob({
        company_id: companyId,
        name: result.job_name,
        description: result.description || '',
        status: 'active',
        job_definition: result.job_definition,
      })
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
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">AI でジョブ作成</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {error && <div className="alert alert-danger">{error}</div>}

            {!result ? (
              <>
                <div className="mb-3">
                  <label className="form-label fw-bold">どんなデータを取得したいですか？</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="例: JEPXのスポット価格を毎日取得したい&#10;例: 気象庁の東京の天気予報データを毎朝取得&#10;例: 国土交通省の地価公示データをCSVで月次取得"
                    disabled={loading}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">URL (任意 — 指定しなければAIが検索します)</label>
                  <input
                    className="form-control"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://..."
                    disabled={loading}
                  />
                </div>

                {loading && (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary mb-2" />
                    <div className="text-muted">
                      AIがサイトを探索してジョブ定義を生成中...
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* AI Reasoning */}
                <div className="card mb-3">
                  <div className="card-header">
                    <strong>AI の分析</strong>
                  </div>
                  <div className="card-body">
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
                      {result.reasoning}
                    </div>
                  </div>
                </div>

                {result.job_definition ? (
                  <>
                    {/* Job Preview */}
                    <div className="card mb-3">
                      <div className="card-header">
                        <strong>生成されたジョブ定義</strong>
                      </div>
                      <div className="card-body">
                        <table className="table table-sm mb-0">
                          <tbody>
                            <tr>
                              <th style={{ width: 140 }}>ジョブ名</th>
                              <td>{result.job_name}</td>
                            </tr>
                            <tr>
                              <th>説明</th>
                              <td>{result.description}</td>
                            </tr>
                            <tr>
                              <th>ソースURL</th>
                              <td>
                                <a href={result.source_url || '#'} target="_blank" rel="noopener noreferrer" className="small">
                                  {result.source_url}
                                </a>
                              </td>
                            </tr>
                            <tr>
                              <th>種別</th>
                              <td><span className="badge bg-info">{result.job_definition.source?.type}</span></td>
                            </tr>
                            <tr>
                              <th>メソッド</th>
                              <td>{result.job_definition.source?.method || 'GET'}</td>
                            </tr>
                            <tr>
                              <th>スケジュール</th>
                              <td><code>{result.job_definition.schedule?.cron || '-'}</code></td>
                            </tr>
                            <tr>
                              <th>カラム</th>
                              <td>
                                {result.job_definition.extraction?.columns?.map((col, i) => (
                                  <span key={i} className="badge bg-secondary me-1">{col.name} ({col.type})</span>
                                )) || '-'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Save */}
                    <div className="card">
                      <div className="card-body">
                        <div className="row align-items-end">
                          <div className="col-md-6">
                            <label className="form-label">企業を選択して保存</label>
                            <select className="form-select" value={companyId} onChange={e => setCompanyId(e.target.value)}>
                              <option value="">企業を選択...</option>
                              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                          <div className="col-md-6 text-end">
                            <button
                              className="btn btn-outline-secondary me-2"
                              onClick={() => setResult(null)}
                            >
                              やり直す
                            </button>
                            <button
                              className="btn btn-primary"
                              onClick={handleSave}
                              disabled={!companyId || saving}
                            >
                              {saving ? '保存中...' : 'この内容で作成'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="alert alert-warning">
                    ジョブ定義の生成に失敗しました。プロンプトを変えて再試行してください。
                    <button className="btn btn-sm btn-outline-primary ms-2" onClick={() => setResult(null)}>
                      やり直す
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            {!result && (
              <>
                <button type="button" className="btn btn-secondary" onClick={onClose}>キャンセル</button>
                <button
                  className="btn btn-primary"
                  onClick={handleGenerate}
                  disabled={loading || !prompt.trim()}
                >
                  {loading ? '生成中...' : 'AI で生成'}
                </button>
              </>
            )}
            {result && (
              <button type="button" className="btn btn-secondary" onClick={onClose}>閉じる</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
