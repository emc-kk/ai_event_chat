import React from 'react'

interface AiStatusBadgeProps {
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

const STATUS_CONFIG = {
  pending: { label: '未処理', className: 'badge bg-secondary' },
  processing: { label: '処理中...', className: 'badge bg-info' },
  completed: { label: '学習完了', className: 'badge bg-success' },
  failed: { label: '読込失敗', className: 'badge bg-danger' },
} as const

export function AiStatusBadge({ status }: AiStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending

  return (
    <span className={config.className}>
      {status === 'processing' && (
        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
      )}
      {status === 'completed' && <span className="me-1">&#x2705;</span>}
      {config.label}
    </span>
  )
}
