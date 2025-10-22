import { createGame } from "./game/game.js";
import { ControlPanel } from "./controlPanel/controlPanel.js";
import { ServerRelay } from "./serverRelay.js";
import { createServerDummy } from "./serverDummy/serverDummy.js";

import gameStartSoundUrl from "../assets/sounds/GameStart.wav";
import winSoundUrl from "../assets/sounds/Win.wav";

let game;
let controlPanel;
let demoMode = true;
const serverRelay = new ServerRelay();
let serverDummyUI = null;
let suppressRelay = false;
let roundPending = false;

const DEFAULT_SLIDER_TARGET = 50;

let lastSliderState = {
  value: DEFAULT_SLIDER_TARGET,
  rollMode: "over",
  winChance: 50,
  multiplier: Number((99 / 50).toFixed(4)),
};

function withRelaySuppressed(callback) {
  suppressRelay = true;
  try {
    return callback?.();
  } finally {
    suppressRelay = false;
  }
}

function sendRelayMessage(type, payload = {}) {
  if (demoMode || suppressRelay) {
    return;
  }
  serverRelay.send(type, payload);
}

function computeWinChancePercent(target, mode) {
  const numericTarget = Number(target);
  const safeTarget = Number.isFinite(numericTarget)
    ? Math.max(0, Math.min(100, numericTarget))
    : DEFAULT_SLIDER_TARGET;
  return mode === "under" ? safeTarget : Math.max(0, 100 - safeTarget);
}

function normalizeRollMode(mode) {
  return mode === "under" ? "under" : "over";
}

function updateSliderState(partial = {}) {
  const nextMode = normalizeRollMode(
    partial.rollMode ?? lastSliderState.rollMode
  );
  const hasExplicitWinChance =
    typeof partial.winChance === "number" &&
    Number.isFinite(partial.winChance);
  const nextValueRaw =
    typeof partial.value === "number" && Number.isFinite(partial.value)
      ? partial.value
      : lastSliderState.value;
  const nextValue = Math.max(0, Math.min(100, nextValueRaw));
  const computedWinChance = hasExplicitWinChance
    ? Math.max(0, Math.min(100, partial.winChance))
    : computeWinChancePercent(nextValue, nextMode);
  const hasExplicitMultiplier =
    typeof partial.multiplier === "number" &&
    Number.isFinite(partial.multiplier);
  const computedMultiplier = computedWinChance > 0
    ? Number((99 / computedWinChance).toFixed(4))
    : Infinity;

  lastSliderState = {
    value: nextValue,
    rollMode: nextMode,
    winChance: computedWinChance,
    multiplier: hasExplicitMultiplier ? partial.multiplier : computedMultiplier,
  };

  return lastSliderState;
}

function getSliderPayload() {
  return {
    target: lastSliderState.value,
    rollMode: lastSliderState.rollMode,
    winChance: lastSliderState.winChance,
    multiplier: lastSliderState.multiplier,
  };
}

function broadcastSliderState() {
  if (demoMode) {
    return;
  }
  const payload = getSliderPayload();
  sendRelayMessage("game:slider-change", payload);
  sendRelayMessage("game:manual-selection", payload);
}

function setDemoMode(value) {
  const next = Boolean(value);
  if (demoMode === next) {
    serverRelay.setDemoMode(next);
    serverDummyUI?.setDemoMode?.(next);
    return;
  }

  demoMode = next;
  serverRelay.setDemoMode(next);
  serverDummyUI?.setDemoMode?.(next);
  if (demoMode) {
    roundPending = false;
  }
}

function formatCurrency(amount) {
  const numeric = Number(amount);
  const value = Number.isFinite(numeric) ? numeric : 0;
  return `$${value.toFixed(2)}`;
}

function prepareRoundDisplays(selection = lastSliderState) {
  const betValue = controlPanel?.getBetValue?.() ?? 0;
  const chancePercent = Number.isFinite(selection?.winChance)
    ? selection.winChance
    : computeWinChancePercent(selection?.value, selection?.rollMode);
  const normalizedChance = chancePercent > 0 ? chancePercent / 100 : 0;
  const potentialProfit = betValue * normalizedChance;

  controlPanel?.setBetAmountDisplay?.(formatCurrency(betValue));
  controlPanel?.setProfitOnWinDisplay?.(formatCurrency(potentialProfit));
  controlPanel?.setProfitValue?.(potentialProfit);
}

function applyRoundResult(payload = {}) {
  const selection = payload.selection
    ? updateSliderState({
        value: Number(payload.selection.target ?? payload.selection.value),
        rollMode: payload.selection.rollMode,
        winChance: payload.selection.winChance,
        multiplier: payload.selection.multiplier,
      })
    : lastSliderState;

  const betValue = controlPanel?.getBetValue?.() ?? 0;
  const rollValue = Number(payload.roll);
  const resolvedRoll = Number.isFinite(rollValue)
    ? rollValue
    : Number(selection?.value ?? DEFAULT_SLIDER_TARGET);
  const chancePercent =
    typeof payload.winChance === "number" && Number.isFinite(payload.winChance)
      ? payload.winChance
      : selection?.winChance;
  const chanceRatio = chancePercent > 0 ? chancePercent / 100 : 0;
  const profitValue =
    typeof payload.profit === "number" && Number.isFinite(payload.profit)
      ? payload.profit
      : betValue * chanceRatio;

  controlPanel?.setBetAmountDisplay?.(formatCurrency(betValue));
  controlPanel?.setProfitOnWinDisplay?.(formatCurrency(profitValue));
  controlPanel?.setProfitValue?.(profitValue);

  game?.revealDiceOutcome?.({
    roll: resolvedRoll,
    label: payload.label,
    displayValue: payload.displayValue,
  });
  roundPending = false;
}

function performDemoBet() {
  roundPending = true;
  const snapshot = { ...lastSliderState };
  prepareRoundDisplays(snapshot);
  const roll = Math.random() * 100;
  applyRoundResult({ roll, selection: snapshot });
}

function requestRemoteBet() {
  roundPending = true;
  const snapshot = { ...lastSliderState };
  prepareRoundDisplays(snapshot);
  sendRelayMessage("game:manual-selection", snapshot);
  sendRelayMessage("control:bet", {
    betValue: controlPanel?.getBetValue?.() ?? 0,
    slider: snapshot,
  });
}

function handleIncomingStartRound(payload = {}) {
  const selection = payload?.selection;
  if (selection) {
    updateSliderState({
      value: Number(selection.target ?? selection.value),
      rollMode: selection.rollMode,
      winChance: selection.winChance,
      multiplier: selection.multiplier,
    });
  }
  prepareRoundDisplays();
  roundPending = true;
}

function handleIncomingRoundResult(payload = {}) {
  applyRoundResult(payload);
}

function handleIncomingAutoRoundResult(payload = {}) {
  console.debug("Received auto-round result from server", payload);
}

function handleIncomingStopAutobet(payload = {}) {
  console.debug("Server requested autobet stop", payload);
  roundPending = false;
}

function handleStartAutobet() {
  if (demoMode) {
    console.debug("Start Autobet triggered in demo mode");
    return;
  }

  const numberOfBets =
    typeof controlPanel?.getNumberOfBetsValue === "function"
      ? controlPanel.getNumberOfBetsValue()
      : null;

  sendRelayMessage("control:start-autobet", {
    betValue: controlPanel?.getBetValue?.() ?? 0,
    numberOfBets,
    slider: getSliderPayload(),
  });
}
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
    controlPanel?.setProfitOnWinDisplay?.(
      `$${estimatedProfit.toFixed(2)}`
    );
  },
  onLost: () => {},
  onStateChange: () => {},
  onSliderValueChange: (target) => {
    const numericTarget = Number(target);
    const snapshot = updateSliderState({ value: numericTarget });
    const winChance = snapshot?.winChance ?? 0;
    const targetLabel = Number.isFinite(numericTarget)
      ? numericTarget.toFixed(2)
      : `${target}`;
    console.debug(
      `Main calculated win chance: ${winChance.toFixed(2)}% (target: ${targetLabel})`
    );
    broadcastSliderState();
  },
  onRollModeChange: (mode) => {
    const nextMode = normalizeRollMode(mode);
    updateSliderState({ rollMode: nextMode });
    console.debug(`Roll mode changed to ${nextMode}`);
    broadcastSliderState();
  },
};

const serverDummyMount =
  document.querySelector(".app-wrapper") ?? document.body;
serverDummyUI = createServerDummy(serverRelay, {
  mount: serverDummyMount,
  onDemoModeToggle: (value) => setDemoMode(value),
  initialDemoMode: demoMode,
});

serverRelay.setDemoMode(demoMode);

serverRelay.addEventListener("incoming", (event) => {
  const { type, payload } = event.detail ?? {};
  withRelaySuppressed(() => {
    switch (type) {
      case "start-round":
        handleIncomingStartRound(payload ?? {});
        break;
      case "round-result":
        handleIncomingRoundResult(payload ?? {});
        break;
      case "auto-round-result":
        handleIncomingAutoRoundResult(payload ?? {});
        break;
      case "stop-autobet":
        handleIncomingStopAutobet(payload ?? {});
        break;
      case "cashout":
        console.debug("Received cashout command from server", payload);
        break;
      default:
        break;
    }
  });
});

serverRelay.addEventListener("demomodechange", (event) => {
  const value = Boolean(event.detail?.value);
  if (demoMode === value) {
    return;
  }
  demoMode = value;
  serverDummyUI?.setDemoMode?.(value);
  if (demoMode) {
    roundPending = false;
  }
});


(async () => {
  // Initialize Control Panel
  try {
    controlPanel = new ControlPanel("#control-panel", {
      gameName: "Dice",
    });
    controlPanel.addEventListener("modechange", (event) => {
      const mode = event.detail?.mode;
      console.debug(`Control panel mode changed to ${mode}`);
      sendRelayMessage("control:mode-change", { mode });
    });
    controlPanel.addEventListener("betvaluechange", (event) => {
      const { value, numericValue } = event.detail ?? {};
      console.debug(`Bet value updated to ${value}`);
      sendRelayMessage("control:bet-value-change", {
        value,
        numericValue,
      });
    });
    controlPanel.addEventListener("numberofbetschange", (event) => {
      const total = event.detail?.value;
      console.debug(`Number of bets changed to ${total}`);
      sendRelayMessage("control:number-of-bets-change", { value: total });
    });
    controlPanel.addEventListener("strategychange", (event) => {
      const { key, mode } = event.detail ?? {};
      sendRelayMessage("control:strategy-change", { key, mode });
    });
    controlPanel.addEventListener("strategyvaluechange", (event) => {
      const { key, value } = event.detail ?? {};
      sendRelayMessage("control:strategy-value-change", { key, value });
    });
    controlPanel.addEventListener("stoponprofitchange", (event) => {
      const value = event.detail?.value;
      sendRelayMessage("control:stop-on-profit-change", { value });
    });
    controlPanel.addEventListener("stoponlosschange", (event) => {
      const value = event.detail?.value;
      sendRelayMessage("control:stop-on-loss-change", { value });
    });
    controlPanel.addEventListener("startautobet", () => handleStartAutobet());
    controlPanel.addEventListener("bet", () => handleBet());
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
})();

function handleBet() {
  if (!demoMode && roundPending) {
    console.debug("Bet action ignored: awaiting previous round result");
    return;
  }

  if (demoMode) {
    console.debug("Bet triggered in demo mode");
    performDemoBet();
    return;
  }

  console.debug("Bet requested, forwarding to server through relay");
  requestRemoteBet();
}
