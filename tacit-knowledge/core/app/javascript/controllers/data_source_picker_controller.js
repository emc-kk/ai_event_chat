import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["modal", "body", "breadcrumb", "selectedList", "fileIdsInput", "uploadInput", "uploadFolderSelect"]
  static values = {
    multiple: { type: Boolean, default: true }
  }

  connect() {
    this.selectedFiles = new Map() // id -> { id, name, file_type }
    this.currentFolderId = null
    this.breadcrumbPath = [{ id: null, name: "ルート" }]
    this.folders = []
  }

  async open(event) {
    event?.preventDefault()
    this.bsModal = this.bsModal || new bootstrap.Modal(this.modalTarget)
    await this.loadFolder(null)
    this.breadcrumbPath = [{ id: null, name: "ルート" }]
    this.renderBreadcrumb()
    this.bsModal.show()
  }

  async loadFolder(folderId) {
    this.currentFolderId = folderId
    const url = folderId
      ? `/api/data_source_folders?parent_id=${folderId}`
      : `/api/data_source_folders`

    try {
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } })
      const data = await resp.json()
      this.folders = data.folders || []
      this.renderContents(data.folders || [], data.files || [])
    } catch (e) {
      console.error('Failed to load data sources:', e)
      this.bodyTarget.innerHTML = '<p class="text-danger p-3">データソースの読み込みに失敗しました。</p>'
    }
  }

  async navigateFolder(event) {
    event.preventDefault()
    const folderId = event.currentTarget.dataset.folderId
    const folderName = event.currentTarget.dataset.folderName

    if (folderId === '') {
      // Navigate to root
      this.breadcrumbPath = [{ id: null, name: "ルート" }]
      await this.loadFolder(null)
    } else {
      // Check if going back via breadcrumb
      const existingIndex = this.breadcrumbPath.findIndex(b => String(b.id) === String(folderId))
      if (existingIndex >= 0) {
        this.breadcrumbPath = this.breadcrumbPath.slice(0, existingIndex + 1)
      } else {
        this.breadcrumbPath.push({ id: folderId, name: folderName })
      }
      await this.loadFolder(folderId)
    }
    this.renderBreadcrumb()
  }

  toggleFile(event) {
    const fileId = event.currentTarget.dataset.fileId
    const fileName = event.currentTarget.dataset.fileName
    const fileType = event.currentTarget.dataset.fileType
    const checkbox = event.currentTarget.querySelector('input[type="checkbox"]')

    if (this.selectedFiles.has(fileId)) {
      this.selectedFiles.delete(fileId)
      if (checkbox) checkbox.checked = false
    } else {
      if (!this.multipleValue) this.selectedFiles.clear()
      this.selectedFiles.set(fileId, { id: fileId, name: fileName, file_type: fileType })
      if (checkbox) checkbox.checked = true
    }
    this.renderSelectedCount()
  }

  confirm() {
    // Update hidden inputs and display
    const ids = Array.from(this.selectedFiles.keys())

    if (this.hasFileIdsInputTarget) {
      // Clear existing hidden inputs
      this.fileIdsInputTarget.innerHTML = ''
      ids.forEach(id => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = 'data_source_file_ids[]'
        input.value = id
        this.fileIdsInputTarget.appendChild(input)
      })
    }

    if (this.hasSelectedListTarget) {
      this.renderSelectedFiles()
    }

    this.bsModal.hide()
  }

  removeFile(event) {
    event.preventDefault()
    const fileId = event.currentTarget.dataset.fileId
    this.selectedFiles.delete(fileId)

    if (this.hasFileIdsInputTarget) {
      const input = this.fileIdsInputTarget.querySelector(`input[value="${fileId}"]`)
      if (input) input.remove()
    }

    this.renderSelectedFiles()
  }

  async uploadFiles(event) {
    event.preventDefault()
    const files = this.uploadInputTarget.files
    if (!files.length) return

    const folderId = this.hasUploadFolderSelectTarget ? this.uploadFolderSelectTarget.value : this.currentFolderId
    const formData = new FormData()
    Array.from(files).forEach(f => formData.append('files[]', f))
    if (folderId) formData.append('folder_id', folderId)

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')

    try {
      const btn = event.currentTarget
      btn.disabled = true
      btn.textContent = 'アップロード中...'

      const resp = await fetch('/api/data_source_files', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken },
        body: formData
      })

      const data = await resp.json()
      if (resp.ok) {
        this.uploadInputTarget.value = ''
        btn.textContent = 'アップロード'
        btn.disabled = false
        // Reload current folder
        await this.loadFolder(this.currentFolderId)
      } else {
        alert(`アップロードエラー: ${data.error || data.errors?.join(', ')}`)
        btn.textContent = 'アップロード'
        btn.disabled = false
      }
    } catch (e) {
      console.error('Upload error:', e)
      alert('アップロードに失敗しました。')
    }
  }

  // ---- Rendering ----

  renderContents(folders, files) {
    let html = ''

    // Upload row
    html += `
      <div class="p-2 border-bottom bg-light">
        <div class="d-flex align-items-center gap-2">
          <input type="file" multiple class="form-control form-control-sm"
                 data-data-source-picker-target="uploadInput"
                 style="max-width: 300px;">
          <button type="button" class="btn btn-sm btn-outline-primary"
                  data-action="click->data-source-picker#uploadFiles">
            アップロード
          </button>
        </div>
      </div>`

    if (!folders.length && !files.length) {
      html += '<p class="text-muted text-center py-4">このフォルダは空です。</p>'
    }

    // Folders
    folders.forEach(folder => {
      html += `
        <div class="list-group-item list-group-item-action d-flex align-items-center gap-2 py-2"
             style="cursor: pointer;"
             data-action="click->data-source-picker#navigateFolder"
             data-folder-id="${folder.id}"
             data-folder-name="${this.escapeHtml(folder.name)}">
          <i class="bi bi-folder-fill text-warning"></i>
          <span>${this.escapeHtml(folder.name)}</span>
          <span class="text-muted small ms-auto">${folder.files_count || 0} ファイル</span>
        </div>`
    })

    // Files
    files.forEach(file => {
      const isSelected = this.selectedFiles.has(String(file.id))
      const isCompleted = file.ai_status === 'completed'
      const statusBadge = {
        pending: '<span class="badge bg-secondary">待機中</span>',
        processing: '<span class="badge bg-info">処理中</span>',
        completed: '<span class="badge bg-success">完了</span>',
        failed: '<span class="badge bg-danger">失敗</span>'
      }[file.ai_status] || ''

      html += `
        <div class="list-group-item d-flex align-items-center gap-2 py-2 ${!isCompleted ? 'opacity-50' : ''}"
             style="${isCompleted ? 'cursor: pointer;' : ''}"
             ${isCompleted ? `data-action="click->data-source-picker#toggleFile"
             data-file-id="${file.id}"
             data-file-name="${this.escapeHtml(file.name)}"
             data-file-type="${file.file_type || ''}"` : ''}>
          <input type="checkbox" class="form-check-input" ${isSelected ? 'checked' : ''} ${!isCompleted ? 'disabled' : ''}>
          <i class="bi bi-file-earmark text-primary"></i>
          <span class="${!isCompleted ? 'text-muted' : ''}">${this.escapeHtml(file.name)}</span>
          <span class="ms-auto">${statusBadge}</span>
        </div>`
    })

    this.bodyTarget.innerHTML = html
    this.renderSelectedCount()
  }

  renderBreadcrumb() {
    let html = ''
    this.breadcrumbPath.forEach((item, index) => {
      const isLast = index === this.breadcrumbPath.length - 1
      if (isLast) {
        html += `<li class="breadcrumb-item active">${this.escapeHtml(item.name)}</li>`
      } else {
        html += `<li class="breadcrumb-item">
          <a href="#" data-action="click->data-source-picker#navigateFolder"
             data-folder-id="${item.id || ''}"
             data-folder-name="${this.escapeHtml(item.name)}">${this.escapeHtml(item.name)}</a>
        </li>`
      }
    })
    this.breadcrumbTarget.innerHTML = html
  }

  renderSelectedCount() {
    const counter = this.modalTarget.querySelector('.ds-picker-count')
    if (counter) {
      counter.textContent = `${this.selectedFiles.size} ファイル選択中`
    }
  }

  renderSelectedFiles() {
    if (!this.hasSelectedListTarget) return

    if (this.selectedFiles.size === 0) {
      this.selectedListTarget.innerHTML = '<p class="text-muted small mb-0">データソースから選択されていません。</p>'
      return
    }

    let html = '<div class="list-group list-group-flush">'
    this.selectedFiles.forEach((file, id) => {
      html += `
        <div class="list-group-item d-flex align-items-center gap-2 py-1 px-0">
          <i class="bi bi-file-earmark text-primary"></i>
          <span class="small">${this.escapeHtml(file.name)}</span>
          <button type="button" class="btn btn-sm btn-link text-danger ms-auto p-0"
                  data-action="click->data-source-picker#removeFile"
                  data-file-id="${id}">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>`
    })
    html += '</div>'
    this.selectedListTarget.innerHTML = html
  }

  escapeHtml(str) {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }
}
