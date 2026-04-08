export interface GlossaryTerm {
  id: string
  term: string
  definition: string
  term_group: string | null
  created_by_type: string
  created_by_name: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
}

const getCSRFToken = (): string => {
  const meta = document.querySelector('meta[name="csrf-token"]')
  return meta?.getAttribute('content') || ''
}

const defaultHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'X-CSRF-Token': getCSRFToken(),
})

export const getGlossaryTerms = async (): Promise<GlossaryTerm[]> => {
  const response = await fetch('/api/glossary_terms', {
    method: 'GET',
    headers: defaultHeaders(),
  })
  if (!response.ok) throw new Error('Failed to fetch glossary terms')
  return response.json()
}

export const createGlossaryTerm = async (term: string, definition: string, term_group?: string): Promise<GlossaryTerm> => {
  const response = await fetch('/api/glossary_terms', {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({ glossary_term: { term, definition, term_group: term_group || null } }),
  })
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.errors?.join(', ') || 'Failed to create term')
  }
  return response.json()
}

export const updateGlossaryTerm = async (id: string, term: string, definition: string, term_group?: string): Promise<GlossaryTerm> => {
  const response = await fetch(`/api/glossary_terms/${id}`, {
    method: 'PATCH',
    headers: defaultHeaders(),
    body: JSON.stringify({ glossary_term: { term, definition, term_group: term_group || null } }),
  })
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.errors?.join(', ') || 'Failed to update term')
  }
  return response.json()
}

export const deleteGlossaryTerm = async (id: string): Promise<void> => {
  const response = await fetch(`/api/glossary_terms/${id}`, {
    method: 'DELETE',
    headers: defaultHeaders(),
  })
  if (!response.ok) throw new Error('Failed to delete term')
}

export interface ImportResult {
  created: number
  skipped: number
  errors: string[]
  error?: string
}

export const importGlossaryTerms = async (file: File): Promise<ImportResult> => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/glossary_terms/import', {
    method: 'POST',
    headers: { 'X-CSRF-Token': getCSRFToken() },
    body: formData,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'CSVインポートに失敗しました')
  return data
}
