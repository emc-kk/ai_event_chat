import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["sectionsContainer"]

  addSection() {
    const container = this.sectionsContainerTarget
    const index = container.querySelectorAll('.section-item').length

    const html = `
      <div class="card mb-2 section-item" data-index="${index}">
        <div class="card-body py-2 px-3">
          <div class="d-flex align-items-center gap-2 mb-2">
            <i class="bi bi-grip-vertical text-muted" style="cursor: grab;"></i>
            <input type="text"
                   name="manual_template[sections][][name]"
                   value=""
                   class="form-control form-control-sm"
                   placeholder="セクション名（例: 目的）"
                   required>
            <button type="button" class="btn btn-sm btn-outline-danger" data-action="click->template-editor#removeSection">
              <i class="bi bi-trash"></i>
            </button>
          </div>
          <textarea name="manual_template[sections][][instruction]"
                    class="form-control form-control-sm"
                    rows="2"
                    placeholder="このセクションに何を書くかの生成指示"></textarea>
        </div>
      </div>
    `
    container.insertAdjacentHTML('beforeend', html)
  }

  removeSection(event) {
    const sectionItem = event.currentTarget.closest('.section-item')
    if (this.sectionsContainerTarget.querySelectorAll('.section-item').length > 1) {
      sectionItem.remove()
    } else {
      alert('最低1つのセクションが必要です。')
    }
  }
}
