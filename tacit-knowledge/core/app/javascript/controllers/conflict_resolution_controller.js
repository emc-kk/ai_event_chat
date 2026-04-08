import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["panel", "conflictItem", "submitButton"]
  static values = { requestId: String }

  connect() {
    this.loadConflicts()
  }

  async loadConflicts() {
    try {
      const response = await fetch(`/api/requests/${this.requestIdValue}/conflicts`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      this.renderConflicts(data.conflicts || [])
    } catch (error) {
      console.error('[ConflictResolution] Error loading conflicts:', error)
    }
  }

  renderConflicts(conflicts) {
    if (!conflicts.length) {
      this.panelTarget.innerHTML = '<div class="alert alert-success">矛盾は全て解決済みです。</div>'
      return
    }

    let html = `
      <div class="alert alert-warning mb-3">
        <i class="bi bi-exclamation-triangle me-2"></i>
        <strong>${conflicts.length}件の矛盾</strong>が検出されました。各矛盾について、どちらの回答を正とするか選択してください。
      </div>
    `

    conflicts.forEach((conflict, index) => {
      html += `
        <div class="card mb-3" data-conflict-id="${conflict.id}" data-conflict-resolution-target="conflictItem">
          <div class="card-header">
            <strong>矛盾 #${index + 1}</strong>
            <span class="badge bg-secondary ms-2">類似度: ${(conflict.similarity * 100).toFixed(0)}%</span>
          </div>
          <div class="card-body">
            <div class="row">
              <div class="col-md-6">
                <h6 class="text-primary">回答 A</h6>
                <p class="small text-muted mb-1"><strong>質問:</strong> ${this.escapeHtml(conflict.question_a)}</p>
                <p class="mb-2">${this.escapeHtml(conflict.answer_a)}</p>
              </div>
              <div class="col-md-6">
                <h6 class="text-success">回答 B</h6>
                <p class="small text-muted mb-1"><strong>質問:</strong> ${this.escapeHtml(conflict.question_b)}</p>
                <p class="mb-2">${this.escapeHtml(conflict.answer_b)}</p>
              </div>
            </div>
            <div class="mt-2">
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="conflict_${conflict.id}" id="conflict_${conflict.id}_a" value="resolved_a" data-action="change->conflict-resolution#checkAllResolved">
                <label class="form-check-label" for="conflict_${conflict.id}_a">Aを正とする</label>
              </div>
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="conflict_${conflict.id}" id="conflict_${conflict.id}_b" value="resolved_b" data-action="change->conflict-resolution#checkAllResolved">
                <label class="form-check-label" for="conflict_${conflict.id}_b">Bを正とする</label>
              </div>
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="conflict_${conflict.id}" id="conflict_${conflict.id}_dismiss" value="dismissed" data-action="change->conflict-resolution#checkAllResolved">
                <label class="form-check-label" for="conflict_${conflict.id}_dismiss">無視する</label>
              </div>
            </div>
          </div>
        </div>
      `
    })

    html += `
      <div class="d-flex justify-content-end">
        <button class="btn btn-primary" data-conflict-resolution-target="submitButton" data-action="click->conflict-resolution#submitResolutions" disabled>
          全て確認済み - 完了
        </button>
      </div>
    `

    this.panelTarget.innerHTML = html
  }

  checkAllResolved() {
    const items = this.conflictItemTargets
    const allResolved = items.every(item => {
      const conflictId = item.dataset.conflictId
      return document.querySelector(`input[name="conflict_${conflictId}"]:checked`)
    })

    if (this.hasSubmitButtonTarget) {
      this.submitButtonTarget.disabled = !allResolved
    }
  }

  async submitResolutions() {
    const items = this.conflictItemTargets
    const resolutions = {}

    items.forEach(item => {
      const conflictId = item.dataset.conflictId
      const checked = document.querySelector(`input[name="conflict_${conflictId}"]:checked`)
      if (checked) {
        resolutions[conflictId] = checked.value
      }
    })

    try {
      this.submitButtonTarget.disabled = true
      this.submitButtonTarget.textContent = '送信中...'

      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')

      const response = await fetch(`/api/requests/${this.requestIdValue}/resolve_conflicts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ resolutions })
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message || '矛盾を解決しました。')
        window.location.href = '/topics'
      } else {
        alert('エラー: ' + (data.message || '解決に失敗しました。'))
        this.submitButtonTarget.disabled = false
        this.submitButtonTarget.textContent = '全て確認済み - 完了'
      }
    } catch (error) {
      console.error('[ConflictResolution] Error submitting:', error)
      alert('エラーが発生しました。')
      this.submitButtonTarget.disabled = false
      this.submitButtonTarget.textContent = '全て確認済み - 完了'
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}
