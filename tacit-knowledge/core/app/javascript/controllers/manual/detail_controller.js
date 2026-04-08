import { Controller } from "@hotwired/stimulus";
import { marked } from 'marked';

// Connects to data-controller="manual-detail"
export default class extends Controller {
  static targets = [
    'main',
    'editorWrapper',
    'editor',
    'toEditorButton',
    'toPreviewButton',
    /* 'aiEditorButton', */
    'buttons',
  ];
  static values = {
    updatePath: String,
    statusPath: String,
  };

  connect() {
    marked.setOptions({ breaks: true, gfm: true });
    this.mainTarget.innerHTML = marked(this.editorTarget.value);

    this.toVideoButton = this.buttonsTarget.querySelector('.to-video');
    if (this.toVideoButton && this.toVideoButton.classList.contains('disabled')) {
      this.pollingStatus();
    }
  }

  pollingStatus() {
    this.intervalId = setInterval(() => {
      fetch(this.statusPathValue, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
        },
      })
        .then(response => response.json())
        .then(json => {
          if (json.status === 'completed') {
            clearInterval(this.intervalId);
            this.toVideoButton.classList.remove('disabled');
          }
        });
    }, 5000);
  }

  edit() {
    this.toEditorButtonTarget.classList.add('d-none');
    // this.aiEditorButtonTarget.classList.add('d-none');
    this.toPreviewButtonTarget.classList.remove('d-none');
    this.mainTarget.classList.add('d-none');
    this.editorWrapperTarget.classList.remove('d-none');
  }

  save() {
    this.toEditorButtonTarget.classList.remove('d-none');
    // this.aiEditorButtonTarget.classList.remove('d-none');
    this.toPreviewButtonTarget.classList.add('d-none');
    this.mainTarget.innerHTML = marked(this.editorTarget.value);
    this.mainTarget.classList.remove('d-none');
    this.editorWrapperTarget.classList.add('d-none');

    this._updateBodyText()
      .then(response => response.json())
      .then(json => {
        if (!json.success) {
          console.error(json.errors);
          alert(`保存に失敗しました。\n${json.errors.join('\n')}`);
        }
      })
      .catch((e) => {
        console.error(e);
        alert('保存に失敗しました。');
      });
  }

  async _updateBodyText(bodyText = this.editorTarget.value) {
    return fetch(this.updatePathValue, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
      },
      body: JSON.stringify({ manual: { body: bodyText } }),
    });
  }
}
