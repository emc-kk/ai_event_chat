import React from 'react'
import type { BreadcrumbItem } from '../../lib/datasource-api-client'

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  onNavigate: (folderId: string | null) => void
}

export function Breadcrumb({ items, onNavigate }: BreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb" className="mb-3">
      <ol className="breadcrumb mb-0">
        <li className="breadcrumb-item">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onNavigate(null) }}
            style={{ textDecoration: 'none' }}
          >
            <i className="fa-solid fa-home me-1" />
          </a>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={item.id} className={`breadcrumb-item${isLast ? ' active' : ''}`}>
              {isLast ? (
                item.name
              ) : (
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); onNavigate(item.id) }}
                  style={{ textDecoration: 'none' }}
                >
                  {item.name}
                </a>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
