import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="components--item"
export default class extends Controller {
  connect() {
    this.element.classList.add("green")
  }
}
