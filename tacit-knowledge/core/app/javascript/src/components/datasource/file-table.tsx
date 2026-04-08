import React from 'react'
import type { DSItem } from '../../lib/datasource-api-client'
import { FileRow } from './file-row'

interface FileTableProps {
  items: DSItem[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onSelectAll: () => void
  onOpen: (item: DSItem) => void
  onRename: (item: DSItem) => void
  onMove: (item: DSItem) => void
  onDownload: (item: DSItem) => void
  onDelete: (item: DSItem) => void
  onPermissions?: (item: DSItem) => void
  searchQuery?: string
}

export function FileTable({ items, selectedIds, onSelect, onSelectAll, onOpen, onRename, onMove, onDownload, onDelete, onPermissions, searchQuery }: FileTableProps) {
  const fileItems = items.filter(item => item.type === 'file')
  const allSelected = fileItems.length > 0 && fileItems.every(item => selectedIds.has(item.id))

  return (
    <table className="table table-hover align-middle mb-0">
      <thead>
        <tr>
          <th style={{ width: 40 }}>
            <input
              type="checkbox"
              className="form-check-input"
              checked={allSelected}
              onChange={onSelectAll}
            />
          </th>
          <th>名前</th>
          <th style={{ width: 120 }}>AI学習状態</th>
          <th style={{ width: 120 }}>更新日</th>
          <th style={{ width: 120 }}>更新者</th>
          <th style={{ width: 40 }}></th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr>
            <td colSpan={6} className="text-center text-muted py-5">
              このフォルダにはファイルがありません
            </td>
          </tr>
        ) : (
          items.map(item => (
            <FileRow
              key={item.id}
              item={item}
              isSelected={selectedIds.has(item.id)}
              onSelect={onSelect}
              onOpen={onOpen}
              onRename={onRename}
              onMove={onMove}
              onDownload={onDownload}
              onDelete={onDelete}
              onPermissions={onPermissions}
              searchQuery={searchQuery}
            />
          ))
        )}
      </tbody>
    </table>
  )
}
