export interface KnowledgeQaRow {
  id: string
  question: string
  keywordCategory: string
  questionIntent: string
  relatedSituation: string
  answer: string
  rowIndex: number
  /** Which request (hearing) this QA belongs to — set by qa-query-tool */
  requestId?: string
}

export interface KnowledgeQaResponse {
  data: KnowledgeQaRow[]
  total: number
}
