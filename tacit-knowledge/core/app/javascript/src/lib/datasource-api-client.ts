const getCSRFToken = (): string => {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

const defaultHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'X-CSRF-Token': getCSRFToken()
})

// Types
export interface DSFolder {
  id: string
  name: string
  parent_id: string | null
  type: 'folder'
  created_at: string
  updated_at: string
}

export interface DSFile {
  id: string
  name: string
  file_type: string
  file_size: number
  ai_status: 'pending' | 'processing' | 'completed' | 'failed'
  folder_id: string | null
  type: 'file'
  created_at: string
  updated_at: string
  updated_by_id: string | null
  snippet?: string
}

export type DSItem = DSFolder | DSFile

export interface BreadcrumbItem {
  id: string
  name: string
}

export interface FolderContentsResponse {
  folders: DSFolder[]
  files: DSFile[]
  breadcrumb: BreadcrumbItem[]
}

// Folder API
export const getFolderContents = async (parentId?: string | null): Promise<FolderContentsResponse> => {
  const params = new URLSearchParams()
  if (parentId) params.append('parent_id', parentId)

  const response = await fetch(`/api/data_source_folders?${params.toString()}`, {
    method: 'GET',
    headers: defaultHeaders()
  })

  if (!response.ok) throw new Error('Failed to fetch folder contents')
  return response.json()
}

export const createFolder = async (name: string, parentId?: string | null, companyId?: string): Promise<{ success: boolean; folder: DSFolder }> => {
  const body: Record<string, any> = { name, parent_id: parentId || null }
  if (companyId) body.company_id = companyId
  const response = await fetch('/api/data_source_folders', {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.errors?.join(', ') || 'Failed to create folder')
  }
  return response.json()
}

export const renameFolder = async (id: string, name: string): Promise<{ success: boolean; folder: DSFolder }> => {
  const response = await fetch(`/api/data_source_folders/${id}`, {
    method: 'PATCH',
    headers: defaultHeaders(),
    body: JSON.stringify({ name })
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.errors?.join(', ') || 'Failed to rename folder')
  }
  return response.json()
}

export const moveFolder = async (id: string, parentId: string | null): Promise<{ success: boolean }> => {
  const response = await fetch(`/api/data_source_folders/${id}/move`, {
    method: 'PATCH',
    headers: defaultHeaders(),
    body: JSON.stringify({ parent_id: parentId })
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.errors?.join(', ') || 'Failed to move folder')
  }
  return response.json()
}

export const deleteFolder = async (id: string): Promise<{ success: boolean }> => {
  const response = await fetch(`/api/data_source_folders/${id}`, {
    method: 'DELETE',
    headers: defaultHeaders()
  })

  if (!response.ok) throw new Error('Failed to delete folder')
  return response.json()
}

// File API
export const uploadFiles = async (files: File[], folderId?: string | null): Promise<{ success: boolean; files: DSFile[] }> => {
  const formData = new FormData()
  files.forEach(file => formData.append('files[]', file))
  if (folderId) formData.append('folder_id', folderId)

  const response = await fetch('/api/data_source_files', {
    method: 'POST',
    headers: { 'X-CSRF-Token': getCSRFToken() },
    body: formData
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.errors?.join(', ') || 'Failed to upload files')
  }
  return response.json()
}

export const renameFile = async (id: string, name: string): Promise<{ success: boolean; file: DSFile }> => {
  const response = await fetch(`/api/data_source_files/${id}`, {
    method: 'PATCH',
    headers: defaultHeaders(),
    body: JSON.stringify({ name })
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.errors?.join(', ') || 'Failed to rename file')
  }
  return response.json()
}

export const moveFile = async (id: string, folderId: string | null): Promise<{ success: boolean }> => {
  const response = await fetch(`/api/data_source_files/${id}/move`, {
    method: 'PATCH',
    headers: defaultHeaders(),
    body: JSON.stringify({ folder_id: folderId })
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.errors?.join(', ') || 'Failed to move file')
  }
  return response.json()
}

export const downloadFile = (id: string): void => {
  window.open(`/api/data_source_files/${id}/download`, '_blank')
}

export const deleteFile = async (id: string): Promise<{ success: boolean }> => {
  const response = await fetch(`/api/data_source_files/${id}`, {
    method: 'DELETE',
    headers: defaultHeaders()
  })

  if (!response.ok) throw new Error('Failed to delete file')
  return response.json()
}

export const searchFiles = async (query: string): Promise<{ files: DSFile[]; total: number; query: string }> => {
  const params = new URLSearchParams({ q: query })
  const response = await fetch(`/api/data_source_files/search?${params.toString()}`, {
    method: 'GET',
    headers: defaultHeaders()
  })

  if (!response.ok) throw new Error('Failed to search files')
  return response.json()
}

export const bulkCreateTopic = async (fileIds: string[], topicName?: string): Promise<{ success: boolean; topic_id: string; topic_name: string; linked_files: number }> => {
  const response = await fetch('/api/data_source_files/bulk_create_topic', {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({ file_ids: fileIds, topic_name: topicName })
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.errors?.join(', ') || 'Failed to create topic')
  }
  return response.json()
}

// Topic ↔ DataSource Link Types
export interface TopicDataSourceLink {
  id: string
  topic_id: string
  data_source_file_id: string
  file_name: string
  file_type: string
  file_size: number
  ai_status: string
  linked_by_id: string
  linked_by_type: string
  created_at: string
}

export interface LinkedTopic {
  id: string
  name: string
  description: string
  status: string
  link_id: string
  linked_at: string
  linked_by_id: string
  linked_by_type: string
}

// Topic ↔ DataSource Link API
export const getLinkedDataSources = async (topicId: string): Promise<{ links: TopicDataSourceLink[]; total: number }> => {
  const response = await fetch(`/api/topics/${topicId}/data_source_links`, {
    method: 'GET',
    headers: defaultHeaders()
  })

  if (!response.ok) throw new Error('Failed to fetch linked data sources')
  return response.json()
}

export const linkDataSourcesToTopic = async (topicId: string, fileIds: string[]): Promise<{ success: boolean; linked: TopicDataSourceLink[]; skipped_ids: string[]; total_linked: number }> => {
  const response = await fetch(`/api/topics/${topicId}/data_source_links`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({ data_source_file_ids: fileIds })
  })

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.errors?.join(', ') || 'Failed to link data sources')
  }
  return response.json()
}

export const unlinkDataSourcesFromTopic = async (topicId: string, fileIds: string[]): Promise<{ success: boolean; deleted_count: number }> => {
  const response = await fetch(`/api/topics/${topicId}/data_source_links`, {
    method: 'DELETE',
    headers: defaultHeaders(),
    body: JSON.stringify({ data_source_file_ids: fileIds })
  })

  if (!response.ok) throw new Error('Failed to unlink data sources')
  return response.json()
}

export const getLinkedTopics = async (fileId: string): Promise<{ topics: LinkedTopic[]; total: number }> => {
  const response = await fetch(`/api/data_source_files/${fileId}/linked_topics`, {
    method: 'GET',
    headers: defaultHeaders()
  })

  if (!response.ok) throw new Error('Failed to fetch linked topics')
  return response.json()
}
