import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import type { DSItem, DSFile, DSFolder, BreadcrumbItem } from '../../lib/datasource-api-client'
import {
  getFolderContents,
  createFolder,
  renameFolder,
  renameFile,
  deleteFolder,
  deleteFile,
  uploadFiles,
  downloadFile,
  searchFiles,
  bulkCreateTopic,
  moveFile,
  moveFolder,
} from '../../lib/datasource-api-client'
import { Breadcrumb } from './breadcrumb'
import { FileTable } from './file-table'
import { NewFolderModal } from './new-folder-modal'
import { FileUploadModal } from './file-upload-modal'
import { RenameModal } from './rename-modal'
import { DeleteConfirmModal } from './delete-confirm-modal'
import { MoveModal } from './move-modal'
import { SelectionBar } from './selection-bar'
import { DataAcquisitionTab } from './data-acquisition-tab'

interface CompanyOption {
  id: string
  name: string
}

interface DataSourceAppProps {
  readOnly?: boolean
  privilegedAdmin?: boolean
  isAdmin?: boolean
  companies?: CompanyOption[]
}

function getInitialFolderId(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('folder') || null
}

export function DataSourceApp({ readOnly = false, privilegedAdmin = false, isAdmin = false, companies = [] }: DataSourceAppProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<'files' | 'acquisition'>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('tab') === 'acquisition' ? 'acquisition' : 'files'
  })

  const handleTabChange = (tab: 'files' | 'acquisition') => {
    setActiveTab(tab)
    const url = new URL(window.location.href)
    if (tab === 'acquisition') {
      url.searchParams.set('tab', 'acquisition')
      url.searchParams.delete('folder')
    } else {
      url.searchParams.delete('tab')
    }
    window.history.pushState({}, '', url.toString())
  }

  // For privileged admin: require company selection before creating folders/files at root level
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)

  // Privileged admin can operate, but needs company_id for creation at root level
  const canWrite = !readOnly
  // Navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(getInitialFolderId)
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([])
  const [items, setItems] = useState<DSItem[]>([])
  const [loading, setLoading] = useState(true)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<DSFile[] | null>(null)

  // Modal state
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [renameTarget, setRenameTarget] = useState<DSItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DSItem | null>(null)
  const [moveTarget, setMoveTarget] = useState<DSItem | null>(null)

  // Error/success feedback
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Auto-dismiss feedback
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => { setError(null); setSuccess(null) }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  // Load folder contents
  const loadContents = useCallback(async (folderId: string | null) => {
    setLoading(true)
    try {
      const data = await getFolderContents(folderId)
      const allItems: DSItem[] = [...data.folders, ...data.files]
      setItems(allItems)
      setBreadcrumb(data.breadcrumb)
      setSelectedIds(new Set())
      setSearchResults(null)
      setSearchQuery('')
    } catch (err) {
      console.error('Failed to load folder contents:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadContents(currentFolderId)
  }, [currentFolderId, loadContents])

  // Browser history navigation
  const navigateToFolder = useCallback((folderId: string | null, pushHistory = true) => {
    setCurrentFolderId(folderId)
    if (pushHistory) {
      const url = folderId
        ? `${window.location.pathname}?folder=${folderId}`
        : window.location.pathname
      window.history.pushState({ folderId }, '', url)
    }
  }, [])

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const folderId = e.state?.folderId ?? null
      navigateToFolder(folderId, false)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [navigateToFolder])

  // Navigation
  const handleNavigate = (folderId: string | null) => {
    navigateToFolder(folderId)
  }

  const handleOpen = (item: DSItem) => {
    if (item.type === 'folder') {
      navigateToFolder(item.id)
    }
  }

  // Selection
  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    const displayItems = searchResults ?? items
    const fileItems = displayItems.filter(i => i.type === 'file')
    const allFilesSelected = fileItems.length > 0 && fileItems.every(i => selectedIds.has(i.id))
    if (allFilesSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(fileItems.map(i => i.id)))
    }
  }

  // Search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) {
      setSearchResults(null)
      return
    }

    setIsSearching(true)
    try {
      const data = await searchFiles(q)
      setSearchResults(data.files)
      setSelectedIds(new Set())
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setIsSearching(false)
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults(null)
  }

  // CRUD handlers
  const handleCreateFolder = async (name: string, companyId?: string) => {
    try {
      await createFolder(name, currentFolderId, companyId)
      await loadContents(currentFolderId)
    } catch (err: any) {
      setError(err.message || 'フォルダの作成に失敗しました')
    }
  }

  const handleUploadFiles = async (files: File[]) => {
    try {
      await uploadFiles(files, currentFolderId)
      await loadContents(currentFolderId)
    } catch (err: any) {
      setError(err.message || 'ファイルのアップロードに失敗しました')
      throw err // re-throw so upload modal can show error too
    }
  }

  const handleRename = async (newName: string) => {
    if (!renameTarget) return
    try {
      if (renameTarget.type === 'folder') {
        await renameFolder(renameTarget.id, newName)
      } else {
        await renameFile(renameTarget.id, newName)
      }
      setRenameTarget(null)
      await loadContents(currentFolderId)
    } catch (err: any) {
      setError(err.message || '名前の変更に失敗しました')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      if (deleteTarget.type === 'folder') {
        await deleteFolder(deleteTarget.id)
      } else {
        await deleteFile(deleteTarget.id)
      }
      setDeleteTarget(null)
      await loadContents(currentFolderId)
    } catch (err: any) {
      setError(err.message || '削除に失敗しました')
    }
  }

  const handleDownload = (item: DSItem) => {
    if (item.type === 'file') {
      downloadFile(item.id)
    }
  }

  const handlePermissions = (item: DSItem) => {
    const type = item.type === 'folder' ? 'DataSourceFolder' : 'DataSourceFile'
    window.location.href = `/permissions?permissible_type=${type}&permissible_id=${item.id}`
  }

  const handleMove = (item: DSItem) => {
    setMoveTarget(item)
  }

  const handleMoveSubmit = async (targetFolderId: string | null) => {
    if (!moveTarget) return
    try {
      if (moveTarget.type === 'folder') {
        await moveFolder(moveTarget.id, targetFolderId)
      } else {
        await moveFile(moveTarget.id, targetFolderId)
      }
      setMoveTarget(null)
      setSuccess(`「${moveTarget.name}」を移動しました`)
      await loadContents(currentFolderId)
    } catch (err: any) {
      throw err // re-throw so modal can display error
    }
  }

  const handleBulkCreateTopic = async () => {
    const fileIds = Array.from(selectedIds).filter(id => {
      const displayItems = searchResults ?? items
      const item = displayItems.find(i => i.id === id)
      return item?.type === 'file'
    })

    if (fileIds.length === 0) {
      setError('ファイルを選択してください')
      return
    }

    try {
      const result = await bulkCreateTopic(fileIds)
      setSuccess(`トピック「${result.topic_name}」を作成しました`)
      setSelectedIds(new Set())
    } catch (err: any) {
      setError(err.message || 'トピックの作成に失敗しました')
    }
  }

  // Display items
  const displayItems: DSItem[] = searchResults ?? items

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0 fw-bold">データソース管理</h2>
        {canWrite && activeTab === 'files' && (
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary" onClick={() => setShowNewFolder(true)}>
              <i className="fa-solid fa-folder-plus me-1" />新規フォルダ
            </button>
            <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
              <i className="fa-solid fa-cloud-arrow-up me-1" />ファイルを追加
            </button>
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => handleTabChange('files')}
          >
            <i className="fa-solid fa-folder me-1" />ファイル管理
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'acquisition' ? 'active' : ''}`}
            onClick={() => handleTabChange('acquisition')}
          >
            <i className="fa-solid fa-chart-line me-1" />データ取得
          </button>
        </li>
      </ul>

      {/* Toast notifications (fixed position to avoid layout shift) */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1080, minWidth: 300, maxWidth: 450 }}>
        {error && (
          <div className="alert alert-danger alert-dismissible fade show shadow-sm mb-2" role="alert">
            {error}
            <button type="button" className="btn-close" onClick={() => setError(null)} />
          </div>
        )}
        {success && (
          <div className="alert alert-success alert-dismissible fade show shadow-sm mb-2" role="alert">
            {success}
            <button type="button" className="btn-close" onClick={() => setSuccess(null)} />
          </div>
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'files' ? (
        <>
          {/* Search bar */}
          <form onSubmit={handleSearch} className="mb-3">
            <div className="input-group" style={{ maxWidth: 500 }}>
              <span className="input-group-text bg-white">
                <i className="fa-solid fa-search text-muted" />
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="ファイル名・内容で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" className="btn btn-outline-secondary" onClick={clearSearch}>
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
          </form>

          {/* Breadcrumb */}
          {!searchResults && <Breadcrumb items={breadcrumb} onNavigate={handleNavigate} />}

          {/* Search results header */}
          {searchResults && (
            <div className="mb-3">
              <h5>"{searchQuery}" の検索結果: {searchResults.length} 件</h5>
            </div>
          )}

          {/* File table */}
          <div className="card">
            <div className="card-body p-0">
              {loading || isSearching ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : (
                <FileTable
                  items={displayItems}
                  selectedIds={selectedIds}
                  onSelect={handleSelect}
                  onSelectAll={handleSelectAll}
                  onOpen={handleOpen}
                  onRename={(item) => setRenameTarget(item)}
                  onMove={handleMove}
                  onDownload={handleDownload}
                  onDelete={(item) => setDeleteTarget(item)}
                  onPermissions={handlePermissions}
                  searchQuery={searchResults ? searchQuery : undefined}
                />
              )}
            </div>
          </div>

          {/* Selection bar */}
          <SelectionBar
            count={selectedIds.size}
            onCreateTopic={handleBulkCreateTopic}
            onClearSelection={() => setSelectedIds(new Set())}
          />

          {/* Modals */}
          <NewFolderModal
            isOpen={showNewFolder}
            onClose={() => setShowNewFolder(false)}
            onSubmit={handleCreateFolder}
            privilegedAdmin={privilegedAdmin}
            companies={companies}
            currentFolderId={currentFolderId}
          />

          <FileUploadModal
            isOpen={showUpload}
            onClose={() => setShowUpload(false)}
            onUpload={handleUploadFiles}
          />

          {renameTarget && (
            <RenameModal
              isOpen={true}
              currentName={renameTarget.name}
              itemType={renameTarget.type}
              onClose={() => setRenameTarget(null)}
              onSubmit={handleRename}
            />
          )}

          {deleteTarget && (
            <DeleteConfirmModal
              isOpen={true}
              itemName={deleteTarget.name}
              itemType={deleteTarget.type}
              onClose={() => setDeleteTarget(null)}
              onConfirm={handleDelete}
            />
          )}

          {moveTarget && (
            <MoveModal
              isOpen={true}
              item={moveTarget}
              currentFolderId={currentFolderId}
              onClose={() => setMoveTarget(null)}
              onSubmit={handleMoveSubmit}
            />
          )}
        </>
      ) : (
        <DataAcquisitionTab />
      )}
    </div>
  )
}
