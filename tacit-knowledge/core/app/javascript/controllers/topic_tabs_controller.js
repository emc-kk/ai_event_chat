import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="topic-tabs"
export default class extends Controller {
  static targets = ["chatContainer", "knowledgeContainer", "chatButton", "knowledgeButton"]

  connect() {
    this.fileIds = []
    setTimeout(() => {
      this.showChat()
    }, 200)
  }

  async showChat() {
    this.chatContainerTarget.classList.remove("d-none")
    this.knowledgeContainerTarget.classList.add("d-none")

    this.chatButtonTarget.classList.add("active")
    this.knowledgeButtonTarget.classList.remove("active")

    this.unmountApp("knowledge-app")
    this.knowledgeContainerTarget.setAttribute("data-mounted", "false")

    const chatMounted = this.chatContainerTarget.getAttribute("data-mounted")
    if (chatMounted !== "true") {
      await new Promise(resolve => setTimeout(resolve, 50))
      this.chatContainerTarget.setAttribute("data-mounted", "true")

      // Set file_ids on chat-app element before mounting
      const chatAppEl = document.getElementById("chat-app")
      if (chatAppEl && this.fileIds && this.fileIds.length > 0) {
        chatAppEl.setAttribute("data-file-ids", JSON.stringify(this.fileIds))
      }

      const chatModule = await import("../react-app")
      chatModule.mountChatApp("chat-app")
    }
  }

  async showKnowledge() {
    this.chatContainerTarget.classList.add("d-none")
    this.knowledgeContainerTarget.classList.remove("d-none")

    this.chatButtonTarget.classList.remove("active")
    this.knowledgeButtonTarget.classList.add("active")

    this.unmountApp("chat-app")
    this.chatContainerTarget.setAttribute("data-mounted", "false")

    const knowledgeMounted = this.knowledgeContainerTarget.getAttribute("data-mounted")
    if (knowledgeMounted !== "true") {
      await new Promise(resolve => setTimeout(resolve, 50))
      this.knowledgeContainerTarget.setAttribute("data-mounted", "true")
      const chatModule = await import("../react-app")
      chatModule.mountKnowledgeApp("knowledge-app", (fileIds) => {
        this.handleStartSearch(fileIds)
      })
    }
  }

  handleStartSearch(fileIds) {
    this.fileIds = fileIds
    // Switch to chat tab with the selected file IDs
    this.showChatWithFileIds(fileIds)
  }

  async showChatWithFileIds(fileIds) {
    this.chatContainerTarget.classList.remove("d-none")
    this.knowledgeContainerTarget.classList.add("d-none")

    this.chatButtonTarget.classList.add("active")
    this.knowledgeButtonTarget.classList.remove("active")

    this.unmountApp("knowledge-app")
    this.knowledgeContainerTarget.setAttribute("data-mounted", "false")

    // Always remount chat with new file IDs
    this.unmountApp("chat-app")
    this.chatContainerTarget.setAttribute("data-mounted", "false")

    await new Promise(resolve => setTimeout(resolve, 50))
    this.chatContainerTarget.setAttribute("data-mounted", "true")

    const chatAppEl = document.getElementById("chat-app")
    if (chatAppEl) {
      chatAppEl.setAttribute("data-file-ids", JSON.stringify(fileIds))
    }

    const chatModule = await import("../react-app")
    chatModule.mountChatApp("chat-app")
  }

  unmountApp(elementId) {
    if (window.chatAppRoots && window.chatAppRoots[elementId]) {
      const rootData = window.chatAppRoots[elementId]
      if (rootData && rootData.root) {
        rootData.root.unmount()
        delete window.chatAppRoots[elementId]
      }
    }
  }

  disconnect() {
    this.unmountApp("chat-app")
    this.unmountApp("knowledge-app")
  }
}
