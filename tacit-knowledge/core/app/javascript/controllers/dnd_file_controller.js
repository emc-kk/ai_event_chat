import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="dnd-file"
export default class extends Controller {
  static targets = ['dropZone', 'fileInput'];

  connect() {
  }

  disconnect() {
  }

  dragOver(e) {
    if (!e) {
      return;
    }
    e.preventDefault();
    this.dropZoneTarget.classList.add('border-primary');
    this.dropZoneTarget.classList.remove('bg-light');
  }

  dragLeave(e) {
    if (!e) {
      return;
    }
    e.preventDefault();
    this.dropZoneTarget.classList.remove('border-primary');
    this.dropZoneTarget.classList.add('bg-light');
  }

  drop(e) {
    if (!e) {
      return;
    }
    e.preventDefault();
    this.dropZoneTarget.classList.remove('border-primary');
    this.dropZoneTarget.classList.add('bg-light');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.fileInputTarget.files = files;
      alert('ファイルが選択されました: ' + files[0].name);
    }
  }

  showFileSelect() {
    this.fileInputTarget.click();
  }

  fileChange() {
    if (this.fileInputTarget.files.length > 0) {
      alert('ファイルが選択されました: ' + this.fileInputTarget.files[0].name);
    }
  }
}
