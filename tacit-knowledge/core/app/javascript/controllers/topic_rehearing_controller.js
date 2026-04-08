import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["modal", "form"]

  showModal() {
    if (!this.hasModalTarget) return

    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      const modal = new bootstrap.Modal(this.modalTarget)
      modal.show()
    }
  }

  selectRequest(event) {
    if (this.hasFormTarget && event.params.requestPath) {
      this.formTarget.action = event.params.requestPath
    }
  }
}
