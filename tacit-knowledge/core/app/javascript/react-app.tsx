import React from 'react'
import { createRoot } from 'react-dom/client'
import { ChatApp } from './src/components/chat-app'
import { QaApp } from './src/components/qa-app'
import { DataSourceApp } from './src/components/datasource/datasource-app'
import { KnowledgeApp } from './src/components/knowledge/knowledge-app'
import { GlossaryApp } from './src/components/glossary/glossary-app'
import { ScraperAdminApp } from './src/components/scraper-admin/scraper-admin-app'

if (typeof window !== 'undefined') {
  (window as any).chatAppRoots = (window as any).chatAppRoots || {}
}

export function mountChatApp(elementId: string) {
  const element = document.getElementById(elementId)
  if (element) {
    const existing = (window as any).chatAppRoots?.[elementId]
    if (existing && existing.root) {
      existing.root.unmount()
      delete (window as any).chatAppRoots[elementId]
    }

    const root = createRoot(element)
    root.render(<ChatApp />)
    if (!(window as any).chatAppRoots) {
      (window as any).chatAppRoots = {}
    }
    (window as any).chatAppRoots[elementId] = { root, element }
  }
}

export function mountQaApp(elementId: string) {
  const element = document.getElementById(elementId)
  if (element) {
    const existing = (window as any).chatAppRoots?.[elementId]
    if (existing && existing.root) {
      existing.root.unmount()
      delete (window as any).chatAppRoots[elementId]
    }

    const root = createRoot(element)
    root.render(<QaApp />)
    if (!(window as any).chatAppRoots) {
      (window as any).chatAppRoots = {}
    }
    (window as any).chatAppRoots[elementId] = { root, element }
  }
}

export function mountDataSourceApp(elementId: string) {
  const element = document.getElementById(elementId)
  if (element) {
    const existing = (window as any).chatAppRoots?.[elementId]
    if (existing && existing.root) {
      existing.root.unmount()
      delete (window as any).chatAppRoots[elementId]
    }

    const isPrivilegedAdmin = element.getAttribute('data-privileged-admin') === 'true'
    const isAdmin = element.getAttribute('data-is-admin') === 'true'
    const companiesJson = element.getAttribute('data-companies') || '[]'
    let companies: { id: string; name: string }[] = []
    try { companies = JSON.parse(companiesJson) } catch { /* ignore */ }
    const root = createRoot(element)
    root.render(<DataSourceApp privilegedAdmin={isPrivilegedAdmin} isAdmin={isAdmin} companies={companies} />)
    if (!(window as any).chatAppRoots) {
      (window as any).chatAppRoots = {}
    }
    (window as any).chatAppRoots[elementId] = { root, element }
  }
}

export function mountKnowledgeApp(elementId: string, onStartSearch: (fileIds: string[]) => void) {
  const element = document.getElementById(elementId)
  if (element) {
    const existing = (window as any).chatAppRoots?.[elementId]
    if (existing && existing.root) {
      existing.root.unmount()
      delete (window as any).chatAppRoots[elementId]
    }

    const topicId = element.getAttribute('data-topic-id') || ''
    const root = createRoot(element)
    root.render(<KnowledgeApp topicId={topicId} onStartSearch={onStartSearch} />)
    if (!(window as any).chatAppRoots) {
      (window as any).chatAppRoots = {}
    }
    (window as any).chatAppRoots[elementId] = { root, element }
  }
}

export function mountGlossaryApp(elementId: string) {
  const element = document.getElementById(elementId)
  if (element) {
    const existing = (window as any).chatAppRoots?.[elementId]
    if (existing && existing.root) {
      existing.root.unmount()
      delete (window as any).chatAppRoots[elementId]
    }

    const root = createRoot(element)
    root.render(<GlossaryApp />)
    if (!(window as any).chatAppRoots) {
      (window as any).chatAppRoots = {}
    }
    (window as any).chatAppRoots[elementId] = { root, element }
  }
}

export function mountScraperAdminApp(elementId: string) {
  const element = document.getElementById(elementId)
  if (element) {
    const existing = (window as any).chatAppRoots?.[elementId]
    if (existing && existing.root) {
      existing.root.unmount()
      delete (window as any).chatAppRoots[elementId]
    }

    const companiesJson = element.getAttribute('data-companies') || '[]'
    let companies: { id: string; name: string }[] = []
    try { companies = JSON.parse(companiesJson) } catch { /* ignore */ }
    const aiServerUrl = element.getAttribute('data-ai-server-url') || undefined
    const root = createRoot(element)
    root.render(<ScraperAdminApp companies={companies} aiServerUrl={aiServerUrl} />)
    if (!(window as any).chatAppRoots) {
      (window as any).chatAppRoots = {}
    }
    (window as any).chatAppRoots[elementId] = { root, element }
  }
}

export function unmountApp(elementId: string) {
  const existing = (window as any).chatAppRoots?.[elementId]
  if (existing && existing.root) {
    existing.root.unmount()
    delete (window as any).chatAppRoots[elementId]
  }
}

function initializeApps() {
  // Chat App
  const chatElement = document.getElementById('chat-app')
  if (chatElement) {
    const mountedStatus = chatElement.getAttribute('data-chat-mounted')
    if (mountedStatus === 'false' || mountedStatus === null) {
      chatElement.setAttribute('data-chat-mounted', 'true')
      mountChatApp('chat-app')
    }
  }

  // DataSource App
  const dsElement = document.getElementById('datasource-app')
  if (dsElement) {
    const mountedStatus = dsElement.getAttribute('data-mounted')
    if (mountedStatus === 'false' || mountedStatus === null) {
      dsElement.setAttribute('data-mounted', 'true')
      mountDataSourceApp('datasource-app')
    }
  }

  // Glossary App
  const glossaryElement = document.getElementById('glossary-app')
  if (glossaryElement) {
    const mountedStatus = glossaryElement.getAttribute('data-mounted')
    if (mountedStatus === 'false' || mountedStatus === null) {
      glossaryElement.setAttribute('data-mounted', 'true')
      mountGlossaryApp('glossary-app')
    }
  }

  // Scraper Admin App
  const scraperAdminElement = document.getElementById('scraper-admin-app')
  if (scraperAdminElement) {
    const mountedStatus = scraperAdminElement.getAttribute('data-mounted')
    if (mountedStatus === 'false' || mountedStatus === null) {
      scraperAdminElement.setAttribute('data-mounted', 'true')
      mountScraperAdminApp('scraper-admin-app')
    }
  }
}

document.addEventListener('DOMContentLoaded', initializeApps)

if (typeof window !== 'undefined' && 'Turbo' in window) {
  document.addEventListener('turbo:load', initializeApps)
}
