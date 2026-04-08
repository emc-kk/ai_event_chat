import React, { useState } from 'react'
import type { DSItem, DSFile } from '../../lib/datasource-api-client'
import { FileIcon } from './file-icon'
import { AiStatusBadge } from './ai-status-badge'
import { ContextMenu } from './context-menu'

interface FileRowProps {
  item: DSItem
  isSelected: boolean
  onSelect: (id: string) => void
  onOpen: (item: DSItem) => void
  onRename: (item: DSItem) => void
  onMove: (item: DSItem) => void
  onDownload: (item: DSItem) => void
  onDelete: (item: DSItem) => void
  onPermissions?: (item: DSItem) => void
  searchQuery?: string
}

function HighlightSnippet({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const idx = lowerText.indexOf(lowerQuery)
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="px-0">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function FileRow({ item, isSelected, onSelect, onOpen, onRename, onMove, onDownload, onDelete, onPermissions, searchQuery }: FileRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }

  const snippet = item.type === 'file' ? (item as DSFile).snippet : undefined

  return (
    <tr className={isSelected ? 'table-primary' : ''}>
      <td style={{ width: 40 }}>
        {item.type === 'file' && (
          <input
            type="checkbox"
            className="form-check-input"
            checked={isSelected}
            onChange={() => onSelect(item.id)}
          />
        )}
      </td>
      <td>
        <div
          className="d-flex align-items-center gap-2"
          style={{ cursor: item.type === 'folder' ? 'pointer' : 'default' }}
          onClick={() => item.type === 'folder' && onOpen(item)}
        >
          <FileIcon fileType={item.type === 'file' ? (item as DSFile).file_type : ''} isFolder={item.type === 'folder'} />
          <div>
            <span className={item.type === 'folder' ? 'fw-semibold' : ''}>{item.name}</span>
            {snippet && (
              <div className="text-muted small mt-1" style={{ fontSize: '0.8em', lineHeight: 1.3 }}>
                <i className="fa-solid fa-quote-left me-1" style={{ fontSize: '0.7em' }} />
                <HighlightSnippet text={snippet} query={searchQuery || ''} />
              </div>
            )}
          </div>
        </div>
      </td>
      <td style={{ width: 120 }}>
        {item.type === 'file' && <AiStatusBadge status={(item as DSFile).ai_status} />}
      </td>
      <td style={{ width: 120 }}>
        {formatDate(item.updated_at)}
      </td>
      <td style={{ width: 120 }}>
        {/* updated_by_name - TODO */}
      </td>
      <td style={{ width: 40, position: 'relative' }}>
        <button
          className="btn btn-link text-muted p-0"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
        >
          <i className="fa-solid fa-ellipsis-vertical" />
        </button>
        <ContextMenu
          item={item}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          onRename={() => { setMenuOpen(false); onRename(item) }}
          onMove={() => { setMenuOpen(false); onMove(item) }}
          onDownload={item.type === 'file' ? () => { setMenuOpen(false); onDownload(item) } : undefined}
          onDelete={() => { setMenuOpen(false); onDelete(item) }}
          onPermissions={onPermissions ? () => { setMenuOpen(false); onPermissions(item) } : undefined}
        />
      </td>
    </tr>
  )
}
