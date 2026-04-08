import { Controller } from "@hotwired/stimulus";
import { marked } from 'marked';

// Connects to data-controller="manual-chat"
export default class extends Controller {
  static targets = ["panel", "toggleBtn", "input", "messages"]

  open() {
    this.panelTarget.classList.remove('d-none')
    this.toggleBtnTarget.classList.add('d-none')
    this.inputTarget.focus()
  }

  close() {
    this.panelTarget.classList.add('d-none')
    this.toggleBtnTarget.classList.remove('d-none')
  }

  send(event) {
    if (event.type === 'keypress' && event.key !== 'Enter') return

    const message = this.inputTarget.value.trim()
    if (!message) return

    this.appendUserMessage(message)
    this.inputTarget.value = ''
    this.scrollToBottom()
  }

  appendUserMessage(message) {
    const html = `
      <div class="d-flex justify-content-end">
        <div class="chat-message chat-message--user mb-3 bg-light">
          <div class="p-2">
            <p class="mb-0">
              ${this.escapeHtml(message)}
            </p>
          </div>
        </div>
      </div>
    `
    this.messagesTarget.insertAdjacentHTML('beforeend', html)
  }

  scrollToBottom() {
    this.messagesTarget.scrollTop = this.messagesTarget.scrollHeight
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}
