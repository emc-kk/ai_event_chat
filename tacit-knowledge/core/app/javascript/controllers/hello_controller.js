import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="hello"
export default class extends Controller {
  connect() {
    setTimeout(() => this.element.textContent = "Hello, Stimulus!", 1000);
  }
}
