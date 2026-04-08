import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["resolveForm"]
  static values = {
    resolveUrl: String
  }

  async resolve(event) {
    event.preventDefault()
    const btn = event.currentTarget
    const elementId = btn.dataset.elementId
    const resolution = btn.dataset.resolution

    // 条件分岐統合の場合はモーダル表示
    if (resolution === 'merged_condition') {
      this.showMergeModal(elementId)
      return
    }

    // フラグの場合はコメント入力
    if (resolution === 'flagged') {
      this.showFlagModal(elementId)
      return
    }

    // 採用の場合はそのまま実行
    const detail = { adopted_request_id: btn.dataset.requestId }
    const respondentName = btn.dataset.respondentName || ''
    await this.submitResolution(elementId, resolution, detail, '', respondentName)
  }

  async confirmAdopt(event) {
    const elementId = event.currentTarget.dataset.elementId
    const requestId = event.currentTarget.dataset.requestId
    const comment = document.getElementById(`comment-${elementId}`)?.value || ''
    const detail = { adopted_request_id: requestId }
    await this.submitResolution(elementId, 'adopted', detail, comment)
  }

  async confirmMerge(event) {
    const elementId = event.currentTarget.dataset.elementId
    const condition = document.getElementById(`merge-condition-${elementId}`)?.value || ''
    if (!condition.trim()) {
      alert('条件分岐の記述を入力してください。')
      return
    }
    const detail = { condition_description: condition }
    const comment = document.getElementById(`merge-comment-${elementId}`)?.value || ''
    await this.submitResolution(elementId, 'merged_condition', detail, comment)
  }

  async confirmFlag(event) {
    const elementId = event.currentTarget.dataset.elementId
    const reason = document.getElementById(`flag-reason-${elementId}`)?.value || ''
    const detail = { flag_reason: reason }
    await this.submitResolution(elementId, 'flagged', detail, reason)
  }

  async saveNote(event) {
    event.preventDefault()
    const elementId = event.currentTarget.dataset.elementId
    const note = document.getElementById(`note-${elementId}`)?.value || ''
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')

    try {
      const response = await fetch(this.resolveUrlValue, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          element_id: elementId,
          resolution_note: note
        })
      })

      const data = await response.json()
      if (data.success) {
        const btn = event.currentTarget
        const originalText = btn.textContent
        btn.textContent = '保存済み'
        btn.classList.remove('btn-outline-primary')
        btn.classList.add('btn-success')
        setTimeout(() => {
          btn.textContent = originalText
          btn.classList.remove('btn-success')
          btn.classList.add('btn-outline-primary')
        }, 2000)
      } else {
        alert(`エラー: ${data.error}`)
      }
    } catch (error) {
      console.error('Save note error:', error)
      alert('保存に失敗しました。')
    }
  }

  async submitResolution(elementId, resolution, detail, comment, respondentName = '') {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
    const url = this.resolveUrlValue

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          element_id: elementId,
          resolution: resolution,
          resolution_detail: detail,
          resolution_comment: comment
        })
      })

      const data = await response.json()
      if (data.success) {
        // 要素のUIを更新
        const card = document.getElementById(`element-${elementId}`)
        if (card) {
          const badge = card.querySelector('.resolution-badge')
          const labels = { adopted: '採用済み', merged_condition: '条件分岐統合', flagged: '要追加調査' }
          const colors = { adopted: 'success', merged_condition: 'info', flagged: 'warning' }
          if (badge) {
            badge.className = `resolution-badge badge bg-${colors[resolution]}`
            if (resolution === 'adopted' && respondentName) {
              badge.textContent = `${respondentName}を採用済み`
            } else {
              badge.textContent = labels[resolution]
            }
          }
          // アクションボタンを非表示
          const actions = card.querySelector('.action-buttons')
          if (actions) actions.classList.add('d-none')
        }
        // モーダルを閉じる
        document.querySelectorAll('.modal.show').forEach(modal => {
          const bsModal = bootstrap.Modal.getInstance(modal)
          if (bsModal) bsModal.hide()
        })
      } else {
        alert(`エラー: ${data.error}`)
      }
    } catch (error) {
      console.error('Resolution error:', error)
      alert('解決処理に失敗しました。')
    }
  }

  showMergeModal(elementId) {
    const modal = document.getElementById(`merge-modal-${elementId}`)
    if (modal) new bootstrap.Modal(modal).show()
  }

  showFlagModal(elementId) {
    const modal = document.getElementById(`flag-modal-${elementId}`)
    if (modal) new bootstrap.Modal(modal).show()
  }
}
