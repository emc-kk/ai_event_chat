import { Controller } from "@hotwired/stimulus";

// Connects to data-controller="manual-video-upload"
export default class extends Controller {
  static targets = [
    "form",
    "dropzone",
    "fileInput",
    "fileInfo",
    "fileName",
    "fileSize",
    "submitBtn",
    "loading"
  ]

  static values = {
    maxSize: { type: Number, default: 500 * 1024 * 1024 } // 500MB
  }

  connect() {
    this.selectedFile = null
    this.inputText = document.querySelector('#manual_input');
  }

  openFileDialog(event) {
    event.preventDefault()
    this.fileInputTarget.click()
  }

  dragOver(event) {
    event.preventDefault()
    this.dropzoneTarget.classList.add("upload-dropzone--dragover")
  }

  dragLeave(event) {
    event.preventDefault()
    this.dropzoneTarget.classList.remove("upload-dropzone--dragover")
  }

  drop(event) {
    event.preventDefault()
    this.dropzoneTarget.classList.remove("upload-dropzone--dragover")

    const files = event.dataTransfer.files
    if (files.length > 0) {
      this.handleFile(files[0])
    }
  }

  fileSelected(event) {
    const files = event.target.files
    if (files.length > 0) {
      this.handleFile(files[0])
    }
  }

  handleFile(file) {
    // サイズチェック
    if (file.size > this.maxSizeValue) {
      this.showError("ファイルサイズが500MBを超えています。")
      this.clearFileInput()
      return
    }

    // 動画ファイルチェック
    let accepted = false;
    this.fileInputTarget.accept.split(",").forEach(type => {
      if (accepted) {
        return;
      }

      const replacedType = type.replace(/\*/, '');
      if (file.type.startsWith(replacedType)) {
        accepted = true;
        return;
      }
      if (file.name.endsWith(type)) {
        accepted = true;
        return;
      }
    });

    if (!accepted) {
      this.showError("動画ファイルを選択してください。")
      this.clearFileInput()
      return
    }

    // ドラッグ＆ドロップの場合、file inputに設定
    if (this.fileInputTarget.files.length === 0) {
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      this.fileInputTarget.files = dataTransfer.files
    }

    this.selectedFile = file
    this.fileNameTarget.textContent = file.name
    this.fileSizeTarget.textContent = this.formatFileSize(file.size)
    this.fileInfoTarget.hidden = false
    this.submitBtnTarget.disabled = false
  }

  removeFile() {
    this.selectedFile = null
    this.clearFileInput()
    this.fileInfoTarget.hidden = true
    this.submitBtnTarget.disabled = true
  }

  clearFileInput() {
    this.fileInputTarget.value = ""
  }

  validateBeforeSubmit(event) {
    let isValid = !!this.selectedFile;
    let message = 'ファイルを選択してください。';
    if (!isValid && this.inputText) {
      isValid = !!this.inputText.value;
      message = 'ファイルを選択するか、テキストを入力してください。';
    }
    if (!isValid) {
      event.preventDefault()
      this.showError(message)
      return
    }

    // 送信中の二重クリック防止
    this.loadingTarget.hidden = false
    this.submitBtnTarget.disabled = true
    this.submitBtnTarget.textContent = "アップロード中..."
  }

  showError(message) {
    alert(message)
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  inputTextChanged(event) {
    event.target.value.length > 0 || this.selectedFile ? this.submitBtnTarget.disabled = false : this.submitBtnTarget.disabled = true
  }

}
