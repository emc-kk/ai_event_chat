import React from 'react'

interface FileIconProps {
  fileType: string
  isFolder?: boolean
}

const FILE_TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  pdf: { icon: 'fa-file-pdf', color: '#dc3545' },
  xlsx: { icon: 'fa-file-excel', color: '#198754' },
  xls: { icon: 'fa-file-excel', color: '#198754' },
  docx: { icon: 'fa-file-word', color: '#0d6efd' },
  doc: { icon: 'fa-file-word', color: '#0d6efd' },
  pptx: { icon: 'fa-file-powerpoint', color: '#fd7e14' },
  ppt: { icon: 'fa-file-powerpoint', color: '#fd7e14' },
  csv: { icon: 'fa-file-csv', color: '#198754' },
  txt: { icon: 'fa-file-lines', color: '#6c757d' },
}

export function FileIcon({ fileType, isFolder }: FileIconProps) {
  if (isFolder) {
    return <i className="fa-solid fa-folder" style={{ color: '#ffc107', fontSize: '1.2rem' }} />
  }

  const config = FILE_TYPE_ICONS[fileType?.toLowerCase()] || { icon: 'fa-file', color: '#6c757d' }
  return <i className={`fa-solid ${config.icon}`} style={{ color: config.color, fontSize: '1.2rem' }} />
}
