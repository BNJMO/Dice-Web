export class ServerPanel {
  constructor({
    mount = document.body,
    initialDemoMode = true,
    initialCollapsed = false,
    initialHidden = false,
    onDemoModeToggle = () => {},
    onVisibilityChange = () => {},
  } = {}) {
    this.onDemoModeToggle = onDemoModeToggle;
    this.onVisibilityChange = onVisibilityChange;
    this.visible = !initialHidden;

    this.container = document.createElement("div");
    this.container.className = "server-panel";
    if (initialCollapsed) {
      this.container.classList.add("server-panel--collapsed");
    }
    if (initialHidden) {
      this.container.classList.add("server-panel--hidden");
    }

    this.buildHeader(initialDemoMode, initialCollapsed);
    this.buildBody();

    mount.prepend(this.container);

    this.setDemoMode(initialDemoMode);
    this.applyVisibility(this.visible, { force: true });
  }

  buildHeader(initialDemoMode, initialCollapsed) {
    const header = document.createElement("div");
    header.className = "server-panel__header";
    this.container.appendChild(header);

    const title = document.createElement("div");
    title.className = "server-panel__title";
    title.textContent = "Server Panel";
    header.appendChild(title);

    const headerControls = document.createElement("div");
    headerControls.className = "server-panel__header-controls";
    header.appendChild(headerControls);

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "server-panel__toggle";
    toggleLabel.textContent = "Demo Mode";

    this.toggleInput = document.createElement("input");
    this.toggleInput.type = "checkbox";
    this.toggleInput.checked = initialDemoMode;
    this.toggleInput.addEventListener("change", () => {
      this.onDemoModeToggle(Boolean(this.toggleInput.checked));
    });

    toggleLabel.appendChild(this.toggleInput);
    headerControls.appendChild(toggleLabel);

    const minimizeButton = document.createElement("button");
    minimizeButton.type = "button";
    minimizeButton.className = "server-panel__minimize";
    minimizeButton.setAttribute("aria-label", "Toggle server panel visibility");
    minimizeButton.textContent = initialCollapsed ? "+" : "−";
    minimizeButton.addEventListener("click", () => {
      const collapsed = this.container.classList.toggle("server-panel--collapsed");
      minimizeButton.textContent = collapsed ? "+" : "−";
    });
    headerControls.appendChild(minimizeButton);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "server-panel__close";
    closeButton.setAttribute("aria-label", "Hide server panel");
    closeButton.textContent = "×";
    closeButton.addEventListener("click", () => this.hide());
    headerControls.appendChild(closeButton);
  }

  buildBody() {
    const body = document.createElement("div");
    body.className = "server-panel__body";
    this.container.appendChild(body);

    const logSection = document.createElement("div");
    logSection.className = "server-panel__log";
    body.appendChild(logSection);

    const logHeader = document.createElement("div");
    logHeader.className = "server-panel__log-header";
    logSection.appendChild(logHeader);

    const logTitle = document.createElement("div");
    logTitle.className = "server-panel__log-title";
    logTitle.textContent = "Relay Log";
    logHeader.appendChild(logTitle);

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "server-panel__clear-log";
    clearButton.textContent = "Clear";
    clearButton.addEventListener("click", () => {
      this.logList.textContent = "";
    });
    logHeader.appendChild(clearButton);

    this.logList = document.createElement("div");
    this.logList.className = "server-panel__log-list";
    logSection.appendChild(this.logList);
  }

  appendLog(direction, type, payload) {
    const entry = createLogEntry(direction, type, payload);
    this.logList.appendChild(entry);
    this.logList.scrollTop = this.logList.scrollHeight;
  }

  setDemoMode(enabled) {
    const normalized = Boolean(enabled);
    if (this.toggleInput.checked !== normalized) {
      this.toggleInput.checked = normalized;
    }
  }

  applyVisibility(next, { force = false } = {}) {
    const normalized = Boolean(next);
    if (!force && normalized === this.visible) {
      return;
    }
    this.visible = normalized;
    this.container.classList.toggle("server-panel--hidden", !normalized);
    this.onVisibilityChange(this.visible);
  }

  show() {
    this.applyVisibility(true);
  }

  hide() {
    this.applyVisibility(false);
  }

  isVisible() {
    return Boolean(this.visible);
  }

  destroy() {
    this.container.remove();
  }
}

function createLogEntry(direction, type, payload) {
  const entry = document.createElement("div");
  entry.className = `server-panel__log-entry server-panel__log-entry--${direction}`;

  const header = document.createElement("div");
  const directionLabel = document.createElement("span");
  directionLabel.className = "server-panel__log-direction";
  directionLabel.textContent =
    direction === "incoming" ? "Server → App" : "App → Server";
  header.appendChild(directionLabel);

  const typeLabel = document.createElement("span");
  typeLabel.className = "server-panel__log-type";
  typeLabel.textContent = type ?? "unknown";
  header.appendChild(typeLabel);

  entry.appendChild(header);

  const payloadNode = document.createElement("pre");
  payloadNode.className = "server-panel__log-payload";
  payloadNode.textContent = JSON.stringify(payload ?? {}, null, 2);
  entry.appendChild(payloadNode);

  return entry;
}
