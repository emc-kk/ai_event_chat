import {Controller} from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["modalDestroy", "message", "button"];

  connect() {
    $(this.modalDestroyTarget).on("show.bs.modal", this.updateMessage.bind(this));
  }

  updateMessage(e) {
    const name = e.relatedTarget.dataset.name;
    const id = e.relatedTarget.dataset.id;

    if (name) {
      $(this.messageTarget).text($(this.messageTarget).text().replace(":name", name));
    }
    if (id) {
      $(this.buttonTarget).attr('href', $(this.buttonTarget).attr('href').replace(":id", id));
    }
  }
}
