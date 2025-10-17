export class ServerRelay extends EventTarget {
  constructor() {
    super();
    this._demoMode = true;
  }

  get demoMode() {
    return this._demoMode;
  }

  setDemoMode(value) {
    const next = Boolean(value);
    if (this._demoMode === next) {
      return;
    }
    this._demoMode = next;
    this.dispatchEvent(
      new CustomEvent("demomodechange", { detail: { value: this._demoMode } })
    );
  }

  send(type, payload = {}) {
    const message = { type, payload };
    this.dispatchEvent(new CustomEvent("outgoing", { detail: message }));
  }

  deliver(type, payload = {}) {
    const message = { type, payload };
    this.dispatchEvent(new CustomEvent("incoming", { detail: message }));
  }
}
