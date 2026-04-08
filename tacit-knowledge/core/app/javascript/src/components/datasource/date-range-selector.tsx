import React from 'react'

interface DateRangeSelectorProps {
  fetchedAfter: string
  fetchedBefore: string
  onChangeAfter: (v: string) => void
  onChangeBefore: (v: string) => void
}

const presets: { label: string; days: number | null }[] = [
  { label: '7日', days: 7 },
  { label: '30日', days: 30 },
  { label: '90日', days: 90 },
  { label: '全件', days: null },
]

function formatISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function DateRangeSelector({
  fetchedAfter,
  fetchedBefore,
  onChangeAfter,
  onChangeBefore,
}: DateRangeSelectorProps) {
  const handlePreset = (days: number | null) => {
    if (days === null) {
      onChangeAfter('')
      onChangeBefore('')
    } else {
      const now = new Date()
      const from = new Date(now)
      from.setDate(from.getDate() - days)
      onChangeAfter(formatISO(from))
      onChangeBefore(formatISO(now))
    }
  }

  return (
    <div className="d-flex flex-wrap align-items-center gap-2">
      <div className="btn-group btn-group-sm">
        {presets.map(p => (
          <button
            key={p.label}
            type="button"
            className={`btn btn-outline-secondary ${
              p.days === null && !fetchedAfter && !fetchedBefore ? 'active' : ''
            }`}
            onClick={() => handlePreset(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="input-group input-group-sm" style={{ width: 'auto' }}>
        <input
          type="date"
          className="form-control"
          value={fetchedAfter}
          onChange={(e) => onChangeAfter(e.target.value)}
          style={{ maxWidth: 150 }}
        />
        <span className="input-group-text">〜</span>
        <input
          type="date"
          className="form-control"
          value={fetchedBefore}
          onChange={(e) => onChangeBefore(e.target.value)}
          style={{ maxWidth: 150 }}
        />
      </div>
    </div>
  )
}
