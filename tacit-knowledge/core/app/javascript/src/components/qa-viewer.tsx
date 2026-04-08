import React, { useEffect, useState } from 'react'

interface QaRow {
  id: string
  question: string
  keywordCategory: string
  questionIntent: string
  relatedSituation: string
  answer: string
  rowIndex: number
}

interface QaViewerProps {
  requestId: string
  onQaDataLoaded?: (data: QaRow[]) => void
}

export const QaViewer: React.FC<QaViewerProps> = ({ requestId, onQaDataLoaded }) => {
  const [data, setData] = useState<QaRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const headers = ['質問', 'キーワード/カテゴリ', '質問の意図', '関連する状況', '回答']

  useEffect(() => {
    const loadQaData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/requests/${requestId}/qa_data`)
        if (!response.ok) {
          if (response.status === 404) {
            setData([])
            setLoading(false)
            return
          }
          throw new Error(`QAデータの読み込みに失敗しました: ${response.statusText}`)
        }

        const result = await response.json()
        const qaData = result.data || []

        setData(qaData)
        onQaDataLoaded?.(qaData)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : '不明なエラーが発生しました')
        setLoading(false)
      }
    }

    loadQaData()
  }, [requestId, onQaDataLoaded])

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100%' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">読み込み中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-danger m-3" role="alert">
        <strong>エラー:</strong> {error}
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
        <div className="table-responsive">
          <table className="table table-striped table-hover table-bordered">
            <thead className="table-light">
              <tr>
                {headers.map((header, index) => (
                  <th key={index} style={{ whiteSpace: 'nowrap', position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr key={row.id || rowIndex}>
                  <td style={{ whiteSpace: 'normal', wordWrap: 'break-word', maxWidth: '300px' }}>
                    {row.question || ''}
                  </td>
                  <td style={{ whiteSpace: 'normal', wordWrap: 'break-word', maxWidth: '200px' }}>
                    {row.keywordCategory || ''}
                  </td>
                  <td style={{ whiteSpace: 'normal', wordWrap: 'break-word', maxWidth: '200px' }}>
                    {row.questionIntent || ''}
                  </td>
                  <td style={{ whiteSpace: 'normal', wordWrap: 'break-word', maxWidth: '200px' }}>
                    {row.relatedSituation || ''}
                  </td>
                  <td style={{ whiteSpace: 'normal', wordWrap: 'break-word', maxWidth: '300px' }}>
                    {row.answer || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.length === 0 && (
          <div className="alert alert-info m-3" role="alert">
            QAデータがありません。
          </div>
        )}
      </div>
    </div>
  )
}
