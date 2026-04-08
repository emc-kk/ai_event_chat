// app/javascript/controllers/file_preview_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "preview"]
  static values = { forceUpdate: Boolean }

  connect() {
    $(this.previewTarget).empty();
    this.selectedFiles = []; // Array to store accumulated files
    this.removedFiles = [];
    
    // Find and attach to form submit event
    const form = this.element.closest('form');
    this.submitButton = form ? form.querySelector('#submit-button') : null;
    
    if (form) {
      this.formSubmitHandler = (e) => {
        // Ensure files are properly set in input before form submits
        if (this.selectedFiles.length > 0) {
          this.updateInputFiles();
        }
        
        // Change button to loading state
        if (this.submitButton) {
          this.submitButton.disabled = true;
          this.submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>処理中...';
        }
      };
      
      // Add event listener in capture phase to run BEFORE other handlers
      form.addEventListener('submit', this.formSubmitHandler, true);
    }
  }
  
  disconnect() {
    // Clean up event listener
    if (this.formSubmitHandler) {
      const form = this.element.closest('form');
      if (form) {
        form.removeEventListener('submit', this.formSubmitHandler, true);
      }
    }
  }

  change() {
    const newFiles = Array.from(this.inputTarget.files);

    // Store files directly from input
    this.selectedFiles = newFiles;
    
    // Render the preview
    this.renderPreview();
  }

  // This is now only called when explicitly needed
  updateInputFiles() {
    const dt = new DataTransfer();
    this.selectedFiles.forEach(file => {
      dt.items.add(file);
    });
    this.inputTarget.files = dt.files;
  }

  renderPreview() {
    $(this.previewTarget).empty();

    if (this.selectedFiles.length === 0) {
      return;
    }

    const $fileList = $('<div>').addClass('file-list mt-2');

    $.each(this.selectedFiles, (index, file) => {      
      const $fileItem = $('<div>').addClass('file-item d-flex align-items-center justify-content-between border rounded p-2 mb-2');
      
      const $fileInfo = $('<div>').addClass('file-info d-flex align-items-center');
      
      const $fileIcon = $('<i>').addClass(`bi bi-${this.getFileIcon(file.type)} me-2`);
      
      const $fileName = $('<span>').addClass('file-name text-truncate').text(file.name).attr('title', file.name);
      
      const $fileSize = $('<small>')
        .addClass('text-muted ms-2')
        .text(`(${this.formatFileSize(file.size)})`);
      
      const $removeBtn = $('<button>')
        .addClass('btn btn-sm btn-outline-danger')
        .attr('type', 'button')
        .html('<i class="bi bi-x"></i>')
        .on('click', () => {
          this.removeFile(index);
        });
      
      $fileInfo.append($fileIcon, $fileName, $fileSize);
      $fileItem.append($fileInfo, $removeBtn);
      $fileList.append($fileItem);
    });

    $(this.previewTarget).append($fileList);
  }

  removeFile(indexToRemove) {
    // Remove from our array
    this.selectedFiles.splice(indexToRemove, 1);
    
    // Update the file input
    this.updateInputFiles();
    
    // Re-render preview
    this.renderPreview();
  }

  getFileIcon(mimeType) {
    const iconMap = {
      'application/pdf': 'file-earmark-pdf',
      'application/msword': 'file-earmark-word',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'file-earmark-word',
      'application/vnd.ms-excel': 'file-earmark-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'file-earmark-excel',
      'application/vnd.ms-powerpoint': 'file-earmark-ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'file-earmark-ppt',
      'text/plain': 'file-earmark-text',
      'image/jpeg': 'file-earmark-image',
      'image/jpg': 'file-earmark-image',
      'image/png': 'file-earmark-image',
      'image/gif': 'file-earmark-image'
    }
    
    if (mimeType.startsWith('image/')) {
      return 'file-earmark-image';
    }
    
    return iconMap[mimeType] || 'file-earmark'
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}
