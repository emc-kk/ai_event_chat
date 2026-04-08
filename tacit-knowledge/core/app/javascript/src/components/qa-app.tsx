import React, { useEffect, useState, useCallback } from 'react'
import { QaViewer } from './qa-viewer'

interface QaRow {
  id: string
  question: string
  keywordCategory: string
  questionIntent: string
  relatedSituation: string
  answer: string
  rowIndex: number
}

export const QaApp: React.FC = () => {
  const [requestId, setRequestId] = useState<string | null>(null)
  const [qaData, setQaData] = useState<QaRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const container = document.getElementById('qa-app-container')
    const requestIdParam = container?.getAttribute('data-request-id')

    if (!requestIdParam) {
      setError('Request ID not found')
      return
    }

    setRequestId(requestIdParam)
  }, [])

  const handleQaDataLoaded = useCallback((data: QaRow[]) => {
    setQaData(data)
  }, [])

  const handleDownload = () => {
    if (!requestId) return

    window.location.href = `/api/requests/${requestId}/qa_csv`
  }

  if (error && !requestId) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center" style={{ height: '100%' }}>
        <div className="alert alert-danger m-3" role="alert">
          <strong>エラー:</strong> {error}
        </div>
      </div>
    )
  }

  if (!requestId && !error) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100%' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">読み込み中...</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="d-flex justify-content-end align-items-center p-2 border-bottom gap-2">
        {requestId && (
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={handleDownload}
            disabled={qaData.length === 0}
          >
            <i className="bi bi-download me-1"></i>
            CSVダウンロード
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {error && (
          <div className="alert alert-danger m-2" role="alert">
            <strong>エラー:</strong> {error}
          </div>
        )}
        {requestId && <QaViewer requestId={requestId} onQaDataLoaded={handleQaDataLoaded} />}
      </div>
    </div>
  )
}
