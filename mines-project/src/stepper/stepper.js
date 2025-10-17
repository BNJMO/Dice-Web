export class Stepper {
  constructor({
    onStepUp = () => {},
    onStepDown = () => {},
    upAriaLabel = "Increase value",
    downAriaLabel = "Decrease value",
    className = "game-panel-stepper",
    upClassName = "game-panel-stepper-btn game-panel-stepper-up",
    downClassName = "game-panel-stepper-btn game-panel-stepper-down",
  } = {}) {
    this.onStepUp = onStepUp;
    this.onStepDown = onStepDown;

    this.element = document.createElement("div");
    this.element.className = className;
    this.element.addEventListener("pointerdown", this.handlePointerDown);

    this.upButton = document.createElement("button");
    this.upButton.type = "button";
    this.upButton.className = upClassName;
    this.upButton.innerHTML = "▲";
    this.upButton.setAttribute("aria-label", upAriaLabel);
    this.upButton.addEventListener("click", this.handleStepUp);

    this.downButton = document.createElement("button");
    this.downButton.type = "button";
    this.downButton.className = downClassName;
    this.downButton.innerHTML = "▼";
    this.downButton.setAttribute("aria-label", downAriaLabel);
    this.downButton.addEventListener("click", this.handleStepDown);

    this.element.appendChild(this.upButton);
    this.element.appendChild(this.downButton);
  }

  setClickable(isClickable = true) {
    const clickable = Boolean(isClickable);
    if (this.upButton) {
      this.upButton.disabled = !clickable;
    }
    if (this.downButton) {
      this.downButton.disabled = !clickable;
    }
    if (this.element) {
      this.element.classList.toggle("is-non-clickable", !clickable);
    }
  }

  handlePointerDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  handleStepUp = (event) => {
    event.preventDefault();
    event.stopPropagation();
    this.onStepUp?.();
  };

  handleStepDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    this.onStepDown?.();
  };

  destroy() {
    this.element.removeEventListener("pointerdown", this.handlePointerDown);
    this.upButton.removeEventListener("click", this.handleStepUp);
    this.downButton.removeEventListener("click", this.handleStepDown);
  }
}
