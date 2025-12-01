import { ServerRelay } from "../serverRelay.js";
import { ServerPanel } from "./serverPanel.js";

function ensureRelay(relay) {
  if (!relay) {
    throw new Error("A ServerRelay instance is required");
  }
  if (!(relay instanceof ServerRelay)) {
    throw new Error("Server expects a ServerRelay instance");
  }
  return relay;
}

export function createServer(relay, options = {}) {
  const serverRelay = ensureRelay(relay);
  const {
    mount = document.querySelector(".app-wrapper") ?? document.body,
    onDemoModeToggle = () => {},
    onVisibilityChange = () => {},
    initialDemoMode = true,
    initialCollapsed = false,
    initialHidden = false,
  } = options;

  const serverPanel = new ServerPanel({
    mount,
    initialDemoMode: Boolean(initialDemoMode),
    initialCollapsed: Boolean(initialCollapsed),
    initialHidden: Boolean(initialHidden),
    onDemoModeToggle,
    onVisibilityChange,
  });

  const outgoingHandler = (event) => {
    const { type, payload } = event.detail ?? {};
    serverPanel.appendLog("outgoing", type, payload);
  };

  const incomingHandler = (event) => {
    const { type, payload } = event.detail ?? {};
    serverPanel.appendLog("incoming", type, payload);
  };

  serverRelay.addEventListener("outgoing", outgoingHandler);
  serverRelay.addEventListener("incoming", incomingHandler);

  serverRelay.addEventListener("demomodechange", (event) => {
    serverPanel.setDemoMode(Boolean(event.detail?.value));
  });

  return {
    element: serverPanel.container,
    setDemoMode: (enabled) => serverPanel.setDemoMode(enabled),
    show: () => serverPanel.show(),
    hide: () => serverPanel.hide(),
    isVisible: () => serverPanel.isVisible(),
    destroy() {
      serverRelay.removeEventListener("outgoing", outgoingHandler);
      serverRelay.removeEventListener("incoming", incomingHandler);
      serverPanel.destroy();
    },
  };
}
