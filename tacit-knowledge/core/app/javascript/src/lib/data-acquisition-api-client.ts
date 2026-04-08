const getCSRFToken = (): string => {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

const defaultHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'X-CSRF-Token': getCSRFToken()
})

// Types
export interface ColumnDef {
  source: string
  name: string
  type: 'text' | 'number'
}

export interface JobDefinition {
  source: {
    type: 'csv_download' | 'web_scrape' | 'pdf_download' | 'api'
    url: string
    method?: string
  }
  extraction: {
    mode?: string
    table_index?: number
    columns: ColumnDef[]
  }
  schedule?: { cron: string }
  dashboard?: {
    chart_type?: 'line' | 'bar' | 'area'
    x_axis?: string
    y_axes?: string[]
  }
}

export interface DAJobRun {
  id: string
  job_id: string
  status: 'running' | 'completed' | 'failed'
  started_at: string
  completed_at: string | null
  tasks_total: number
  tasks_completed: number
  tasks_failed: number
}

export interface DAJob {
  id: string
  company_id: string
  name: string
  description: string
  job_definition: JobDefinition
  status: 'active' | 'paused' | 'failed' | 'schema_change'
  record_count: number
  last_run: DAJobRun | null
  created_at: string
  updated_at: string
}

export interface DARecord {
  id: string
  company_id: string
  job_id: string
  record_type: string
  data: Record<string, unknown>
  source_url: string
  fetched_at: string
  created_at: string
}

// Jobs API
export const getJobs = async (): Promise<DAJob[]> => {
  const res = await fetch('/api/data_acquisition_jobs', { headers: defaultHeaders() })
  if (!res.ok) throw new Error('Failed to fetch jobs')
  const json = await res.json()
  return json.data
}

export const getJobRuns = async (jobId: string): Promise<DAJobRun[]> => {
  const res = await fetch(`/api/data_acquisition_jobs/${jobId}/runs`, { headers: defaultHeaders() })
  if (!res.ok) throw new Error('Failed to fetch runs')
  const json = await res.json()
  return json.data
}

export const triggerJob = async (jobId: string): Promise<DAJobRun> => {
  const res = await fetch(`/api/data_acquisition_jobs/${jobId}/trigger`, {
    method: 'POST',
    headers: defaultHeaders()
  })
  if (!res.ok) throw new Error('Failed to trigger job')
  const json = await res.json()
  return json.data
}

// Records API
export const getRecords = async (params: {
  job_id?: string
  record_type?: string
  fetched_after?: string
  fetched_before?: string
  limit?: number
}): Promise<DARecord[]> => {
  const sp = new URLSearchParams()
  if (params.job_id) sp.append('job_id', params.job_id)
  if (params.record_type) sp.append('record_type', params.record_type)
  if (params.fetched_after) sp.append('fetched_after', params.fetched_after)
  if (params.fetched_before) sp.append('fetched_before', params.fetched_before)
  if (params.limit) sp.append('limit', String(params.limit))

  const res = await fetch(`/api/data_acquisition_records?${sp}`, { headers: defaultHeaders() })
  if (!res.ok) throw new Error('Failed to fetch records')
  const json = await res.json()
  return json.data
}

// CSV Download
export const downloadCsv = (params: {
  job_id: string
  fetched_after?: string
  fetched_before?: string
}): void => {
  const sp = new URLSearchParams()
  sp.append('job_id', params.job_id)
  if (params.fetched_after) sp.append('fetched_after', params.fetched_after)
  if (params.fetched_before) sp.append('fetched_before', params.fetched_before)

  window.open(`/api/data_acquisition_records/csv?${sp}`, '_blank')
}
