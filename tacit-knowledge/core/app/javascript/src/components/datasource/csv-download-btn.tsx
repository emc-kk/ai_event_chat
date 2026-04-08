import React from 'react'
import { downloadCsv } from '../../lib/data-acquisition-api-client'

interface CsvDownloadBtnProps {
  jobId: string
  fetchedAfter?: string
  fetchedBefore?: string
  size?: 'sm' | 'lg'
}

export function CsvDownloadBtn({ jobId, fetchedAfter, fetchedBefore, size = 'sm' }: CsvDownloadBtnProps) {
  const handleClick = () => {
    downloadCsv({
      job_id: jobId,
      fetched_after: fetchedAfter || undefined,
      fetched_before: fetchedBefore || undefined,
    })
  }

  return (
    <button
      className={`btn btn-outline-secondary btn-${size}`}
      onClick={handleClick}
      title="CSVダウンロード"
    >
      <i className="fa-solid fa-file-csv me-1" />
      CSVダウンロード
    </button>
  )
}
