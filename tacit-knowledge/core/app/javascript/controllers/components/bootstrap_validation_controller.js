// app/javascript/controllers/form_validation_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["form"]

  connect() {
  }

  validate(event) {
    const form = this.element
    if (!form.checkValidity()) {
      event.preventDefault()
      event.stopPropagation()
    }
    form.classList.add("was-validated")
    form.querySelectorAll(".is-invalid").forEach((input) => input.classList.add("d-none"));
  }
}
