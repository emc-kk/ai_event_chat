import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = { requestId: String }

  finish() {
    if (!confirm('ヒアリングを終了しますか？')) return

    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content')

    fetch(`/api/requests/${this.requestIdValue}/finish_hearing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          alert(data.message)
          window.location.href = '/topics'
        } else {
          alert('エラー: ' + data.message)
        }
      })
      .catch(error => {
        console.error('Error:', error)
        alert('エラーが発生しました。')
      })
  }
}
