import { createGame } from "./game/game.js";
import { ControlPanel } from "./controlPanel/controlPanel.js";
import { ServerRelay } from "./serverRelay.js";
import { createServerDummy } from "./serverDummy/serverDummy.js";

import gameStartSoundUrl from "../assets/sounds/GameStart.wav";
import winSoundUrl from "../assets/sounds/Win.wav";

let game;
let controlPanel;
let autoBetTimeoutId = null;
let autoBetStopRequested = false;
let isAutoBetRunning = false;
const serverRelay = new ServerRelay();
let demoMode = serverRelay.demoMode;
let serverDummy = null;
let lastRollMode = "over";
let awaitingServerBetOutcome = false;
let awaitingServerAutoOutcome = false;
let lastWinChancePercent = null;
const bottomPanelLocks = {
  manual: false,
  auto: false,
};

const opts = {
  // Window visuals
  backgroundColor: "#091B26",
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Arial",

  // Sounds
  gameStartSoundPath: gameStartSoundUrl,
  winSoundPath: winSoundUrl,

  // Win pop-up
  winPopupShowDuration: 260,
  winPopupWidth: 260,
  winPopupHeight: 200,

  // API Events Callbacks
  onWin: () => {
    game?.showWinPopup?.(24.75, "0.00000003");
    const betValue = controlPanel?.getBetValue?.() ?? 0;
    const estimatedProfit = betValue * 0.015;
    controlPanel?.setProfitValue(estimatedProfit);
    controlPanel?.setProfitOnWinDisplay?.(`$${estimatedProfit.toFixed(2)}`);
  },
  onLost: () => {},
  onStateChange: () => {},
  onSliderValueChange: (target) => {
    const sliderValue = Number(target);
    const normalizedTarget = Number.isFinite(sliderValue) ? sliderValue : 0;
    const winChancePercent =
      lastRollMode === "under"
        ? clampPercent(normalizedTarget)
        : clampPercent(100 - normalizedTarget);
    const winChanceRatio = winChancePercent / 100;
    lastWinChancePercent = winChancePercent;
    const multiplier =
      winChancePercent > 0 ? 99 / winChancePercent : Infinity;

    console.debug(
      `Main calculated win chance: ${winChancePercent.toFixed(2)}%`
    );

    sendRelayMessage("game:slider-change", {
      target: normalizedTarget,
      rollMode: lastRollMode,
      winChancePercent,
      winChance: winChanceRatio,
      multiplier,
    });
  },
  onRollModeChange: (mode) => {
    lastRollMode = mode;
    console.debug(`Roll mode changed to ${mode}`);
    sendRelayMessage("game:roll-mode-change", { mode });
  },
};

serverRelay.addEventListener("incoming", (event) => {
  handleIncomingMessage(event?.detail);
});

serverRelay.addEventListener("demomodechange", (event) => {
  applyDemoMode(Boolean(event?.detail?.value));
});

(async () => {
  // Initialize Control Panel
  try {
    controlPanel = new ControlPanel("#control-panel", {
      gameName: "Dice",
    });
    controlPanel.addEventListener("modechange", (event) => {
      const mode = event?.detail?.mode;
      console.debug(`Control panel mode changed to ${mode}`);
      sendRelayMessage("control:modechange", { mode });
    });
    controlPanel.addEventListener("betvaluechange", (event) => {
      const detail = event?.detail ?? {};
      console.debug(`Bet value updated to ${detail.value}`);
      sendRelayMessage("control:betvaluechange", detail);
    });
    controlPanel.addEventListener("numberofbetschange", (event) => {
      sendRelayMessage("control:numberofbetschange", event?.detail ?? {});
    });
    controlPanel.addEventListener("strategychange", (event) => {
      sendRelayMessage("control:strategychange", event?.detail ?? {});
    });
    controlPanel.addEventListener("strategyvaluechange", (event) => {
      sendRelayMessage("control:strategyvaluechange", event?.detail ?? {});
    });
    controlPanel.addEventListener("stoponprofitchange", (event) => {
      sendRelayMessage("control:stoponprofitchange", event?.detail ?? {});
    });
    controlPanel.addEventListener("stoponlosschange", (event) => {
      sendRelayMessage("control:stoponlosschange", event?.detail ?? {});
    });
    controlPanel.addEventListener("bet", () => {
      if (demoMode) {
        handleBet();
      } else {
        handleServerBetRequest();
      }
    });
    controlPanel.addEventListener("startautobet", () => {
      if (demoMode) {
        if (controlPanel?.getMode?.() === "auto") {
          controlPanel?.setAutoStartButtonMode?.("stop");
        }
        startAutoBet();
      } else {
        handleServerAutoBetStart();
      }
    });
    controlPanel.addEventListener("stopautobet", () => {
      if (demoMode) {
        stopAutoBet();
      } else {
        sendRelayMessage("control:stop-autobet");
      }
    });
    controlPanel.setBetAmountDisplay("$0.00");
    controlPanel.setProfitOnWinDisplay("$0.00");
    controlPanel.setProfitValue("0.00000000");
  } catch (err) {
    console.error("Control panel initialization failed:", err);
  }

  // Initialize Game
  try {
    game = await createGame("#game", opts);
    window.game = game;
  } catch (e) {
    console.error("Game initialization failed:", e);
    const gameDiv = document.querySelector("#game");
    if (gameDiv) {
      gameDiv.innerHTML = `
        <div style="color: #f44336; padding: 20px; background: rgba(0,0,0,0.8); border-radius: 8px;">
          <h3>❌ Game Failed to Initialize</h3>
          <p><strong>Error:</strong> ${e.message}</p>
          <p>Check console (F12) for full details.</p>
        </div>
      `;
    }
  }

  serverDummy = createServerDummy(serverRelay, {
    initialDemoMode: demoMode,
    onDemoModeToggle: (value) => serverRelay.setDemoMode(value),
  });

  applyDemoMode(demoMode);
  window.serverRelay = serverRelay;
})();

function handleBet() {
  if (!demoMode) {
    return;
  }
  const roll = Math.random() * 100;
  const winChance = Math.max(0, (100 - roll) / 100);
  console.debug(
    `Bet placed. Revealing roll ${roll.toFixed(1)} with ${(winChance * 100).toFixed(
      2
    )}% win chance.`
  );

  const betValue = controlPanel?.getBetValue?.() ?? 0;
  controlPanel?.setBetAmountDisplay?.(`$${betValue.toFixed(2)}`);
  const potentialProfit = betValue * winChance;
  controlPanel?.setProfitOnWinDisplay?.(`$${potentialProfit.toFixed(2)}`);
  controlPanel?.setProfitValue?.(potentialProfit);

  game?.revealDiceOutcome?.({ roll });
}

function handleServerBetRequest() {
  if (demoMode) {
    return;
  }
  if (awaitingServerBetOutcome) {
    return;
  }
  if (controlPanel?.getMode?.() === "manual") {
    lockManualBetControls();
  }
  awaitingServerBetOutcome = true;
  lockBottomPanelControls("manual");
  const payload = buildServerBetPayload();
  sendRelayMessage("control:bet", payload);
}

function handleServerAutoBetStart() {
  if (demoMode) {
    return;
  }
  if (awaitingServerAutoOutcome) {
    return;
  }
  if (controlPanel?.getMode?.() === "auto") {
    controlPanel?.setAutoStartButtonMode?.("stop");
  }
  awaitingServerAutoOutcome = true;
  lockBottomPanelControls("auto");
  const payload = buildServerBetPayload();
  sendRelayMessage("control:start-autobet", payload);
}

function startAutoBet() {
  if (!demoMode) {
    return;
  }
  if (isAutoBetRunning || autoBetStopRequested) {
    return;
  }
  isAutoBetRunning = true;
  autoBetStopRequested = false;
  clearTimeout(autoBetTimeoutId);
  controlPanel?.setAutoStartButtonMode?.("stop");
  controlPanel?.setAutoStartButtonState?.("clickable");
  runAutoBetCycle();
}

function runAutoBetCycle() {
  if (!isAutoBetRunning || !demoMode) {
    return;
  }
  handleBet();
  scheduleNextAutoBet();
}

function scheduleNextAutoBet() {
  clearTimeout(autoBetTimeoutId);
  autoBetTimeoutId = setTimeout(() => {
    if (!demoMode) {
      stopAutoBetImmediately();
      return;
    }
    if (autoBetStopRequested) {
      finalizeAutoBetStop();
      return;
    }
    runAutoBetCycle();
  }, 1000);
}

function stopAutoBet() {
  if (!demoMode) {
    return;
  }
  if (!isAutoBetRunning || autoBetStopRequested) {
    return;
  }
  autoBetStopRequested = true;
  controlPanel?.setAutoStartButtonMode?.("finish");
  controlPanel?.setAutoStartButtonState?.("non-clickable");
}

function finalizeAutoBetStop() {
  stopAutoBetImmediately();
}

function stopAutoBetImmediately() {
  clearTimeout(autoBetTimeoutId);
  autoBetTimeoutId = null;
  isAutoBetRunning = false;
  autoBetStopRequested = false;
  controlPanel?.setAutoStartButtonMode?.("start");
  controlPanel?.setAutoStartButtonState?.("clickable");
}

function applyDemoMode(enabled) {
  demoMode = Boolean(enabled);
  window.demoMode = demoMode;
  awaitingServerBetOutcome = false;
  awaitingServerAutoOutcome = false;
  stopAutoBetImmediately();
  serverDummy?.setDemoMode?.(demoMode);
  unlockManualBetControls();
  resetBottomPanelLocks();
}

function sendRelayMessage(type, payload = {}) {
  if (demoMode) {
    return;
  }
  serverRelay.send(type, payload);
}

function handleIncomingMessage(message) {
  if (!message) return;
  const { type, payload } = message;
  switch (type) {
    case "game:bet-outcome":
      onManualBetOutcomeReceived();
      processServerRoll(payload);
      break;
    case "game:auto-bet-outcome":
      onServerAutoBetOutcomeReceived();
      processServerRoll(payload);
      break;
    case "profit:update-total":
      applyServerProfitUpdate(payload);
      break;
    case "profit:update-multiplier":
      applyServerMultiplierUpdate(payload);
      break;
    default:
      break;
  }
}

function onManualBetOutcomeReceived() {
  if (!awaitingServerBetOutcome) {
    return;
  }
  awaitingServerBetOutcome = false;
  unlockManualBetControls();
  unlockBottomPanelControls("manual");
}

function onServerAutoBetOutcomeReceived() {
  if (!awaitingServerAutoOutcome) {
    return;
  }
  awaitingServerAutoOutcome = false;
  unlockBottomPanelControls("auto");
}

function processServerRoll(payload = {}) {
  const numericRoll = toFiniteNumber(
    payload.roll ?? payload.value ?? payload.numericValue
  );
  if (numericRoll === null) {
    console.warn("Received invalid roll payload", payload);
    return;
  }
  const roll = clampPercent(numericRoll);

  const providedBetValue = toFiniteNumber(
    payload.betValue ?? payload.numericBetValue
  );
  let betValue = controlPanel?.getBetValue?.() ?? 0;
  if (providedBetValue !== null) {
    betValue = providedBetValue;
    controlPanel?.setBetInputValue?.(betValue, { emit: false });
  }

  const betAmountDisplay =
    payload.betAmountDisplay ?? `$${betValue.toFixed(2)}`;
  controlPanel?.setBetAmountDisplay?.(betAmountDisplay);

  const winChanceRatio = (() => {
    const ratioCandidate = toFiniteNumber(
      payload.winChance ?? payload.winChanceRatio
    );
    if (ratioCandidate !== null) {
      return ratioCandidate > 1 ? ratioCandidate / 100 : Math.max(0, ratioCandidate);
    }
    const percentCandidate = toFiniteNumber(payload.winChancePercent);
    if (percentCandidate !== null) {
      return Math.max(0, percentCandidate) / 100;
    }
    return Math.max(0, (100 - roll) / 100);
  })();

  const potentialProfitOverride = toFiniteNumber(payload.potentialProfit);
  const potentialProfit =
    potentialProfitOverride !== null
      ? potentialProfitOverride
      : betValue * winChanceRatio;

  const profitOnWinDisplay =
    payload.profitOnWinDisplay ??
    `$${(Number.isFinite(potentialProfit) ? potentialProfit : 0).toFixed(2)}`;
  controlPanel?.setProfitOnWinDisplay?.(profitOnWinDisplay);

  if (payload.totalProfit !== undefined || payload.totalProfitValue !== undefined) {
    const totalProfit =
      payload.totalProfit ?? payload.totalProfitValue;
    controlPanel?.setProfitValue?.(totalProfit);
  } else if (payload.totalProfitDisplay !== undefined) {
    controlPanel?.setProfitValue?.(payload.totalProfitDisplay);
  } else {
    controlPanel?.setProfitValue?.(potentialProfit);
  }

  game?.revealDiceOutcome?.({
    roll,
    label: payload.label ?? payload.displayLabel,
    displayValue: payload.displayValue,
  });
}

function lockManualBetControls() {
  controlPanel?.setModeToggleClickable?.(false);
  controlPanel?.setBetControlsClickable?.(false);
  controlPanel?.setBetButtonState?.("non-clickable");
}

function unlockManualBetControls() {
  controlPanel?.setModeToggleClickable?.(true);
  controlPanel?.setBetControlsClickable?.(true);
  controlPanel?.setBetButtonState?.("clickable");
}

function applyServerProfitUpdate(payload = {}) {
  if (!controlPanel) return;
  if (payload.display !== undefined) {
    controlPanel.setProfitValue(payload.display);
    return;
  }
  if (payload.numericValue !== undefined) {
    controlPanel.setProfitValue(payload.numericValue);
    return;
  }
  if (payload.value !== undefined) {
    controlPanel.setProfitValue(payload.value);
  }
}

function applyServerMultiplierUpdate(payload = {}) {
  if (!controlPanel) return;
  const multiplier =
    toFiniteNumber(payload.numericValue) ?? toFiniteNumber(payload.value);
  if (multiplier !== null) {
    controlPanel.setTotalProfitMultiplier(multiplier);
  }
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(100, numeric));
}

function buildServerBetPayload() {
  const payload = {};
  const rollMode = typeof game?.getRollMode === "function"
    ? game.getRollMode()
    : lastRollMode;
  if (rollMode) {
    payload.rollMode = rollMode;
  }
  const winChancePercent = (() => {
    if (typeof game?.getWinChance === "function") {
      const value = Number(game.getWinChance());
      if (Number.isFinite(value)) {
        return value;
      }
    }
    if (Number.isFinite(lastWinChancePercent)) {
      return lastWinChancePercent;
    }
    return null;
  })();
  if (Number.isFinite(winChancePercent)) {
    payload.winChancePercent = winChancePercent;
    payload.winChance = winChancePercent / 100;
  }
  return payload;
}

function lockBottomPanelControls(key) {
  if (!bottomPanelLocks[key]) {
    bottomPanelLocks[key] = true;
    updateBottomPanelClickableState();
  }
}

function unlockBottomPanelControls(key) {
  if (bottomPanelLocks[key]) {
    bottomPanelLocks[key] = false;
    updateBottomPanelClickableState();
  }
}

function resetBottomPanelLocks() {
  bottomPanelLocks.manual = false;
  bottomPanelLocks.auto = false;
  updateBottomPanelClickableState();
}

function updateBottomPanelClickableState() {
  const shouldLock = bottomPanelLocks.manual || bottomPanelLocks.auto;
  const clickable = !shouldLock;
  game?.setBottomPanelControlsClickable?.(clickable);
}
