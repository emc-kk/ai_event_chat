import type { JobDefinition, DAJobRun } from './data-acquisition-api-client'

const getCSRFToken = (): string => {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

const defaultHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'X-CSRF-Token': getCSRFToken()
})

// Types
export interface AdminJob {
  id: string
  company_id: string
  company_name: string | null
  name: string
  description: string
  job_definition: JobDefinition
  status: 'active' | 'paused' | 'failed' | 'schema_change'
  dispatch_target: string
  cron: string | null
  last_run: DAJobRun | null
  created_at: string
  updated_at: string
}

export interface AdminRun {
  id: string
  job_id: string
  job_name: string | null
  company_name: string | null
  status: 'running' | 'completed' | 'failed'
  started_at: string
  completed_at: string | null
  tasks_total: number
  tasks_completed: number
  tasks_failed: number
}

export interface ScraperInstance {
  id: string
  name: string
  host: string
  port: number
  status: string
  max_concurrency: number
  current_tasks: number
  capabilities: string[]
  resource_thresholds: Record<string, number>
  tags: Record<string, string>
  last_health_check_at: string | null
  updated_at: string
}

export interface AdminRecord {
  id: string
  company_id: string
  company_name: string | null
  job_id: string
  job_name: string | null
  run_id: string | null
  record_type: string
  source_url: string
  fetched_at: string
  created_at: string
}

export interface OverviewData {
  jobs_total: number
  jobs_by_status: Record<string, number>
  runs_24h: number
  runs_7d: number
  success_rate_24h: number | null
  completed_24h: number
  failed_24h: number
  records_today: number
  daily_stats: Array<{ date: string; total: number; completed: number }>
  recent_runs: AdminRun[]
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  meta: { page: number; per: number; total: number }
}

// API functions
export const getOverview = async (): Promise<OverviewData> => {
  const res = await fetch('/api/scraper_admin/overview', { headers: defaultHeaders() })
  if (!res.ok) throw new Error('Failed to fetch overview')
  const json = await res.json()
  return json.data
}

export const getAdminJobs = async (params?: {
  page?: number
  per?: number
  status?: string
  company_id?: string
}): Promise<PaginatedResponse<AdminJob>> => {
  const sp = new URLSearchParams()
  if (params?.page) sp.append('page', String(params.page))
  if (params?.per) sp.append('per', String(params.per))
  if (params?.status) sp.append('status', params.status)
  if (params?.company_id) sp.append('company_id', params.company_id)

  const res = await fetch(`/api/scraper_admin/jobs?${sp}`, { headers: defaultHeaders() })
  if (!res.ok) throw new Error('Failed to fetch admin jobs')
  return res.json()
}

export const getAdminRuns = async (params?: {
  page?: number
  per?: number
  days?: number
  company_id?: string
  status?: string
}): Promise<PaginatedResponse<AdminRun>> => {
  const sp = new URLSearchParams()
  if (params?.page) sp.append('page', String(params.page))
  if (params?.per) sp.append('per', String(params.per))
  if (params?.days) sp.append('days', String(params.days))
  if (params?.company_id) sp.append('company_id', params.company_id)
  if (params?.status) sp.append('status', params.status)

  const res = await fetch(`/api/scraper_admin/runs?${sp}`, { headers: defaultHeaders() })
  if (!res.ok) throw new Error('Failed to fetch admin runs')
  return res.json()
}

export const getInstances = async (): Promise<ScraperInstance[]> => {
  const res = await fetch('/api/scraper_admin/instances', { headers: defaultHeaders() })
  if (!res.ok) throw new Error('Failed to fetch instances')
  const json = await res.json()
  return json.data
}

export const getAdminRecords = async (params?: {
  page?: number
  per?: number
  company_id?: string
  job_id?: string
  record_type?: string
}): Promise<PaginatedResponse<AdminRecord>> => {
  const sp = new URLSearchParams()
  if (params?.page) sp.append('page', String(params.page))
  if (params?.per) sp.append('per', String(params.per))
  if (params?.company_id) sp.append('company_id', params.company_id)
  if (params?.job_id) sp.append('job_id', params.job_id)
  if (params?.record_type) sp.append('record_type', params.record_type)

  const res = await fetch(`/api/scraper_admin/records?${sp}`, { headers: defaultHeaders() })
  if (!res.ok) throw new Error('Failed to fetch admin records')
  return res.json()
}

export interface RecordSummary {
  job_id: string
  job_name: string
  company_name: string
  record_count: number
  latest_fetched_at: string | null
}

export interface CompanySummary {
  company_id: string
  company_name: string
  jobs_total: number
  jobs_active: number
  latest_run_status: string | null
  record_count: number
}

export const getRecordSummary = async (params?: {
  company_id?: string
}): Promise<RecordSummary[]> => {
  const sp = new URLSearchParams()
  if (params?.company_id) sp.append('company_id', params.company_id)

  const res = await fetch(`/api/scraper_admin/record_summary?${sp}`, { headers: defaultHeaders() })
  if (!res.ok) throw new Error('Failed to fetch record summary')
  const json = await res.json()
  return json.data
}

export const getCompanySummary = async (): Promise<CompanySummary[]> => {
  const res = await fetch('/api/scraper_admin/company_summary', { headers: defaultHeaders() })
  if (!res.ok) throw new Error('Failed to fetch company summary')
  const json = await res.json()
  return json.data
}

// Job CRUD (reuses existing endpoints)
export const createJob = async (job: {
  company_id: string
  name: string
  description: string
  status: string
  job_definition: Partial<JobDefinition>
}): Promise<AdminJob> => {
  const res = await fetch('/api/data_acquisition_jobs', {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({ data_acquisition_job: job })
  })
  if (!res.ok) throw new Error('Failed to create job')
  const json = await res.json()
  return json.data
}

export const updateJob = async (id: string, job: Partial<{
  name: string
  description: string
  status: string
  job_definition: Partial<JobDefinition>
}>): Promise<AdminJob> => {
  const res = await fetch(`/api/data_acquisition_jobs/${id}`, {
    method: 'PATCH',
    headers: defaultHeaders(),
    body: JSON.stringify({ data_acquisition_job: job })
  })
  if (!res.ok) throw new Error('Failed to update job')
  const json = await res.json()
  return json.data
}

// AI Job Generation
export const generateJobWithAI = async (
  aiServerUrl: string,
  prompt: string,
  url?: string
): Promise<{
  job_definition: JobDefinition | null
  job_name: string | null
  description: string | null
  source_url: string | null
  reasoning: string
}> => {
  const res = await fetch(`${aiServerUrl}/api/scraper-jobs/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, url })
  })
  if (!res.ok) throw new Error('Failed to generate job with AI')
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'AI generation failed')
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
