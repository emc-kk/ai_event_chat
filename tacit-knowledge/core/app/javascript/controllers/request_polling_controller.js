import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    requestIds: Array,
    hasUpdating: Boolean,
    interval: { type: Number, default: 5000 }
  }

  connect() {
    console.log('[RequestPolling] Controller connected', {
      hasUpdating: this.hasUpdatingValue,
      requestIds: this.requestIdsValue
    })
    if (this.hasUpdatingValue && this.requestIdsValue.length > 0) {
      console.log('[RequestPolling] Starting polling...')
      this.startPolling()
    } else {
      console.log('[RequestPolling] Polling not started (no updating requests)')
    }
  }

  disconnect() {
    this.stopPolling()
  }

  startPolling() {
    this.poll()
  }

  stopPolling() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }

  async poll() {
    console.log('[RequestPolling] Polling...', { requestIds: this.requestIdsValue })
    try {
      const params = new URLSearchParams()
      this.requestIdsValue.forEach(id => params.append('ids[]', id))

      const response = await fetch(`/api/requests/status?${params}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      console.log('[RequestPolling] Response received:', data)
      this.updateDOM(data)
      this.updateManualDOM(data)
      this.updateTopicDOM(data)

      if (data.has_updating) {
        console.log('[RequestPolling] Still updating, scheduling next poll in', this.intervalValue, 'ms')
        this.scheduleNextPoll()
      } else {
        console.log('[RequestPolling] No longer updating, stopping polling')
        this.hasUpdatingValue = false
      }
    } catch (error) {
      console.error('[RequestPolling] Error:', error)
      this.scheduleNextPoll()
    }
  }

  scheduleNextPoll() {
    this.timeoutId = setTimeout(() => this.poll(), this.intervalValue)
  }

  updateDOM(data) {
    data.requests.forEach(req => {
      // ヒアリング用チャットボットアイコンを更新
      const hearingCell = this.element.querySelector(`[data-hearing-request-id="${req.id}"]`)
      if (hearingCell) {
        if (req.can_access_hearing) {
          hearingCell.innerHTML = `<a href="${req.hearing_path}" class="text-primary" title="ヒアリング用チャットボット"><i class="bi bi-chat-dots fs-5"></i></a>`
        } else {
          hearingCell.innerHTML = '<i class="bi bi-chat-dots fs-5 text-muted" title="このステータスではアクセスできません"></i>'
        }
      }
    })
  }

  updateTopicDOM(data) {
    if (!data.topics) return

    data.topics.forEach(topic => {
      // トピックステータスバッジを更新
      const statusCell = this.element.querySelector(`[data-topic-status-id="${topic.id}"]`)
      if (statusCell) {
        const badge = statusCell.querySelector('.status-badge')
        if (badge) {
          badge.textContent = topic.status_label
          badge.className = `status-badge status-${topic.status.replace(/_/g, '-')}`
        }
      }

      // トピックチャットアイコンを更新
      const chatCell = this.element.querySelector(`[data-topic-chat-id="${topic.id}"]`)
      if (chatCell) {
        if (topic.chat_accessible && topic.chat_path) {
          chatCell.innerHTML = `<a href="${topic.chat_path}" class="text-primary" title="トピックチャット"><i class="bi bi-chat-square-text fs-5"></i></a>`
        } else {
          chatCell.innerHTML = '<i class="bi bi-chat-square-text fs-5 text-muted" title="トピックが完了状態でないとアクセスできません"></i>'
        }
      }
    })
  }

  updateManualDOM(data) {
    data.requests.forEach(req => {
      if (req.status !== 'completed') {
        return;
      }

      const dom = this.element.querySelector(`[data-manual-request-id="${req.id}"]`)
      if (!dom) {
        console.warn('[RequestPolling] Request not found:', req.id)
        return
      }

      const { manualUrl } = dom.dataset;
      if (!manualUrl) {
        console.warn('[RequestPolling] Request has no manual URL:', req.id)
        return
      }

      dom.innerHTML = `<a href="${manualUrl}">マニュアル詳細</a>`
    })
  }
}
