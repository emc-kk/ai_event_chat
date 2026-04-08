import React from 'react'

interface SelectionBarProps {
  count: number
  onCreateTopic: () => void
  onClearSelection: () => void
}

export function SelectionBar({ count, onCreateTopic, onClearSelection }: SelectionBarProps) {
  if (count === 0) return null

  return (
    <div
      className="fixed-bottom d-flex align-items-center justify-content-center gap-3 py-3"
      style={{ backgroundColor: '#1a1a2e', color: '#fff', zIndex: 1050 }}
    >
      <span>{count}件を選択中</span>
      <button className="btn btn-outline-light btn-sm" onClick={onCreateTopic}>
        <i className="fa-solid fa-wand-magic-sparkles me-1" />
        選択したファイルでトピックを作成
      </button>
      <button className="btn btn-link text-white-50 btn-sm" onClick={onClearSelection}>
        <i className="fa-solid fa-xmark" />
      </button>
    </div>
  )
}
