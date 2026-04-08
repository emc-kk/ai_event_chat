import React, { useState } from 'react'
import { OverviewTab } from './overview-tab'
import { JobsTab } from './jobs-tab'
import { RunsTab } from './runs-tab'
import { InstancesTab } from './instances-tab'
import { CompaniesTab } from './companies-tab'
import { RecordsTab } from './records-tab'

interface Props {
  companies: { id: string; name: string }[]
  aiServerUrl?: string
}

const TABS = [
  { key: 'overview', label: '概要' },
  { key: 'jobs', label: 'ジョブ' },
  { key: 'runs', label: '実行履歴' },
  { key: 'instances', label: 'インスタンス' },
  { key: 'companies', label: '企業一覧' },
  { key: 'records', label: 'レコード/DL' },
] as const

type TabKey = typeof TABS[number]['key']

export function ScraperAdminApp({ companies, aiServerUrl }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  return (
    <div className="p-4">
      <h2 className="mb-4" style={{ fontSize: '1.5rem', fontWeight: 600 }}>スクレイパー管理</h2>

      <ul className="nav nav-tabs mb-4">
        {TABS.map(tab => (
          <li className="nav-item" key={tab.key}>
            <button
              className={`nav-link ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      <div>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'jobs' && <JobsTab companies={companies} aiServerUrl={aiServerUrl} />}
        {activeTab === 'runs' && <RunsTab companies={companies} />}
        {activeTab === 'instances' && <InstancesTab />}
        {activeTab === 'companies' && <CompaniesTab />}
        {activeTab === 'records' && <RecordsTab companies={companies} />}
      </div>
    </div>
  )
}
