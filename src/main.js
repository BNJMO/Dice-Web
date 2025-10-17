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

let controlPanelMode = "manual";
let betButtonMode = "bet";
let roundActive = false;
let autoRunActive = false;
let autoStopFinishing = false;
let autoRoundInProgress = false;
let autoResetTimer = null;
let autoBetsRemaining = Infinity;
let totalAutoProfit = 0;

const AUTO_RESET_DELAY_MS = 1500;
const SERVER_RESPONSE_DELAY_MS = 250;

let currentSliderState = {
  value: 50,
  rollMode: "over",
  winChance: 50,
  multiplier: 1.98,
};

let currentRoundConfig = null;

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
    stopAutoBetProcess({ completed: false });
    finalizeRound();
  }
}

function formatCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "$0.00";
  }
  return `$${numeric.toFixed(2)}`;
}

function parseCurrencyValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value !== "string") {
    return 0;
  }
  const sanitized = value.replace(/[^0-9.\-]+/g, "");
  const numeric = Number(sanitized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function refreshSliderState() {
  const details = game?.getSliderDetails?.();
  if (details) {
    currentSliderState = {
      value: Number(details.value) || currentSliderState.value,
      rollMode: details.rollMode || currentSliderState.rollMode,
      winChance: Number(details.winChance) || currentSliderState.winChance,
      multiplier:
        Number(details.multiplier) || currentSliderState.multiplier || 0,
    };
  }
}

function updatePotentialProfitDisplay() {
  refreshSliderState();
  const betAmount = controlPanel?.getBetValue?.() ?? 0;
  const payout = betAmount * (currentSliderState.multiplier || 0);
  controlPanel?.setBetAmountDisplay?.(formatCurrency(betAmount));
  controlPanel?.setProfitOnWinDisplay?.(formatCurrency(payout));
  if (!roundActive) {
    controlPanel?.setProfitValue?.(0);
  }
}

function setControlPanelBetMode(mode) {
  betButtonMode = mode === "bet" ? "bet" : "cashout";
  controlPanel?.setBetButtonMode?.(betButtonMode);
}

function setControlPanelBetState(isClickable) {
  controlPanel?.setBetButtonState?.(
    isClickable ? "clickable" : "non-clickable"
  );
}

function setControlPanelAutoStartState(isClickable) {
  controlPanel?.setAutoStartButtonState?.(
    isClickable ? "clickable" : "non-clickable"
  );
}

function setControlPanelModeToggleClickable(isClickable) {
  controlPanel?.setModeToggleClickable?.(isClickable);
}

function setControlPanelBetControlsClickable(isClickable) {
  controlPanel?.setBetControlsClickable?.(isClickable);
}

function setAutoRunUIState(active) {
  if (!controlPanel) {
    return;
  }

  if (active) {
    if (autoStopFinishing) {
      controlPanel.setAutoStartButtonMode?.("finish");
      setControlPanelAutoStartState(false);
    } else {
      controlPanel.setAutoStartButtonMode?.("stop");
      setControlPanelAutoStartState(true);
    }
    controlPanel.setModeToggleClickable?.(false);
    controlPanel.setBetControlsClickable?.(false);
    controlPanel.setNumberOfBetsClickable?.(false);
    controlPanel.setAdvancedToggleClickable?.(false);
    controlPanel.setAdvancedStrategyControlsClickable?.(false);
    controlPanel.setStopOnProfitClickable?.(false);
    controlPanel.setStopOnLossClickable?.(false);
  } else {
    controlPanel.setAutoStartButtonMode?.("start");
    autoStopFinishing = false;
    setControlPanelAutoStartState(true);
    controlPanel.setModeToggleClickable?.(true);
    controlPanel.setBetControlsClickable?.(true);
    controlPanel.setNumberOfBetsClickable?.(true);
    controlPanel.setAdvancedToggleClickable?.(true);
    controlPanel.setAdvancedStrategyControlsClickable?.(true);
    controlPanel.setStopOnProfitClickable?.(true);
    controlPanel.setStopOnLossClickable?.(true);
  }
}

function captureRoundConfig() {
  refreshSliderState();
  const betAmount = controlPanel?.getBetValue?.() ?? 0;
  const payout = betAmount * (currentSliderState.multiplier || 0);
  currentRoundConfig = {
    betAmount,
    targetValue: currentSliderState.value,
    rollMode: currentSliderState.rollMode,
    winChance: currentSliderState.winChance,
    multiplier: currentSliderState.multiplier,
    potentialPayout: payout,
  };
}

function prepareForNewRoundState() {
  captureRoundConfig();
  roundActive = true;
  setControlPanelBetState(false);
  setControlPanelModeToggleClickable(false);
  setControlPanelBetControlsClickable(false);
  updatePotentialProfitDisplay();
}

function finalizeRound() {
  if (!roundActive) {
    return;
  }

  roundActive = false;
  currentRoundConfig = null;

  if (controlPanelMode === "manual") {
    setControlPanelBetMode("bet");
    setControlPanelBetState(true);
    setControlPanelModeToggleClickable(true);
    setControlPanelBetControlsClickable(true);
  }

  if (!autoRunActive) {
    controlPanel?.setAutoStartButtonMode?.("start");
    setControlPanelAutoStartState(controlPanelMode === "auto");
  }
}

function handleRoundOutcome({
  roll,
  label,
  displayValue,
  multiplier: payloadMultiplier,
  profit: payloadProfit,
  isWin: payloadIsWin,
}) {
  if (!roundActive) {
    return null;
  }

  const outcome = game?.revealDiceOutcome?.({ roll, label, displayValue });
  const isWin = payloadIsWin ?? outcome?.isWin ?? false;
  const betAmount =
    currentRoundConfig?.betAmount ?? controlPanel?.getBetValue?.() ?? 0;
  const multiplier =
    Number(payloadMultiplier) || currentRoundConfig?.multiplier || 0;
  const payout = Number(payloadProfit);
  const resolvedPayout = Number.isFinite(payout)
    ? payout
    : betAmount * (multiplier || 0);

  if (isWin) {
    controlPanel?.setProfitValue?.(resolvedPayout);
    controlPanel?.setProfitOnWinDisplay?.(formatCurrency(resolvedPayout));
    if (multiplier) {
      game?.showWinPopup?.(multiplier, resolvedPayout);
    }
  } else {
    controlPanel?.setProfitValue?.(0);
  }

  return {
    isWin,
    betAmount,
    multiplier,
    payout: resolvedPayout,
    roll,
  };
}

function applyServerReveal(payload = {}) {
  const result = handleRoundOutcome(payload);
  finalizeRound();
  if (autoRunActive && result) {
    handleAutoRoundFinished(result);
  }
}

function applyAutoResultsFromServer(results = []) {
  if (!Array.isArray(results) || results.length === 0) {
    return;
  }
  const last = results[results.length - 1] ?? {};
  const result = handleRoundOutcome(last);
  finalizeRound();
  if (result) {
    handleAutoRoundFinished(result);
  }
}

function scheduleNextAutoBetRound() {
  clearTimeout(autoResetTimer);
  if (!autoRunActive) {
    return;
  }
  autoResetTimer = setTimeout(() => {
    if (!autoRunActive) {
      return;
    }
    if (demoMode) {
      executeDemoAutoRound();
    } else {
      sendRelayMessage("action:request-next-round", {});
    }
  }, AUTO_RESET_DELAY_MS);
}

function handleAutoRoundFinished(outcome = {}) {
  autoRoundInProgress = false;

  if (!autoRunActive) {
    return;
  }

  if (Number.isFinite(autoBetsRemaining)) {
    autoBetsRemaining = Math.max(0, autoBetsRemaining - 1);
    controlPanel?.setNumberOfBetsValue?.(autoBetsRemaining);
  }

  const betAmount = Number(outcome?.betAmount ?? controlPanel?.getBetValue?.() ?? 0);
  const profitDelta = Number(outcome?.payout);
  if (Number.isFinite(profitDelta)) {
    totalAutoProfit += profitDelta - betAmount;
  } else if (outcome?.isWin) {
    const multiplier = Number(outcome?.multiplier) || 0;
    totalAutoProfit += betAmount * multiplier - betAmount;
  } else {
    totalAutoProfit -= betAmount;
  }

  const stopOnProfit = parseCurrencyValue(
    controlPanel?.getStopOnProfitValue?.()
  );
  const stopOnLoss = parseCurrencyValue(controlPanel?.getStopOnLossValue?.());

  const reachedProfit = stopOnProfit > 0 && totalAutoProfit >= stopOnProfit;
  const reachedLoss = stopOnLoss > 0 && totalAutoProfit <= -Math.abs(stopOnLoss);

  if (
    (Number.isFinite(autoBetsRemaining) && autoBetsRemaining <= 0) ||
    reachedProfit ||
    reachedLoss
  ) {
    const completed = Number.isFinite(autoBetsRemaining)
      ? autoBetsRemaining <= 0
      : reachedProfit;
    autoRunActive = false;
    autoStopFinishing = true;
    setAutoRunUIState(true);
    if (!demoMode && !suppressRelay) {
      sendRelayMessage("action:stop-autobet", {
        completed,
        reason: completed ? "completed" : reachedLoss ? "loss" : "profit",
      });
    }
    return;
  }

  scheduleNextAutoBetRound();
}

function beginAutoBetProcess() {
  refreshSliderState();
  const selectionsValid = true;
  if (!selectionsValid) {
    return;
  }

  const configuredBets = controlPanel?.getNumberOfBetsValue?.();
  if (Number.isFinite(configuredBets) && configuredBets > 0) {
    autoBetsRemaining = Math.floor(configuredBets);
    controlPanel?.setNumberOfBetsValue?.(autoBetsRemaining);
  } else {
    autoBetsRemaining = Infinity;
  }

  totalAutoProfit = 0;
  autoRunActive = true;
  autoRoundInProgress = false;
  autoStopFinishing = false;

  if (!demoMode && !suppressRelay) {
    const payload = {
      bet: controlPanel?.getBetValue?.() ?? 0,
      slider: { ...currentSliderState },
      numberOfBets: Number.isFinite(autoBetsRemaining)
        ? autoBetsRemaining
        : 0,
      strategy: {
        onWin: controlPanel?.getOnWinStrategy?.(),
        onLoss: controlPanel?.getOnLossStrategy?.(),
      },
      stops: {
        profit: controlPanel?.getStopOnProfitValue?.(),
        loss: controlPanel?.getStopOnLossValue?.(),
      },
    };
    sendRelayMessage("action:start-autobet", payload);
  }

  setAutoRunUIState(true);

  if (demoMode) {
    executeDemoAutoRound();
  }
}

function stopAutoBetProcess({ completed = false } = {}) {
  clearTimeout(autoResetTimer);
  autoResetTimer = null;
  autoRunActive = false;
  autoRoundInProgress = false;
  autoStopFinishing = false;
  totalAutoProfit = 0;
  setAutoRunUIState(false);
  if (completed) {
    controlPanel?.setNumberOfBetsValue?.(0);
  }
}

function executeDemoAutoRound() {
  if (!autoRunActive || autoRoundInProgress) {
    return;
  }

  autoRoundInProgress = true;
  prepareForNewRoundState();

  setTimeout(() => {
    if (!roundActive) {
      return;
    }
    const roll = Math.random() * 100;
    const result = handleRoundOutcome({ roll });
    finalizeRound();
    if (result) {
      handleAutoRoundFinished(result);
    }
  }, SERVER_RESPONSE_DELAY_MS);
}

function handleStartAutobetClick() {
  if (autoRunActive) {
    if (!autoStopFinishing) {
      autoRunActive = false;
      autoStopFinishing = true;
      setAutoRunUIState(true);
      sendRelayMessage("action:stop-autobet", { reason: "user" });
    }
    return;
  }

  if (controlPanelMode !== "auto") {
    return;
  }

  beginAutoBetProcess();
}

function simulateDemoBetOutcome() {
  prepareForNewRoundState();
  setTimeout(() => {
    if (!roundActive) {
      return;
    }
    const roll = Math.random() * 100;
    handleRoundOutcome({ roll });
    finalizeRound();
  }, SERVER_RESPONSE_DELAY_MS);
}

function handleBet() {
  if (betButtonMode === "cashout") {
    sendRelayMessage("action:cashout", {});
    return;
  }

  if (!demoMode && !suppressRelay) {
    const payload = {
      bet: controlPanel?.getBetValue?.() ?? 0,
      slider: { ...currentSliderState },
    };
    sendRelayMessage("action:bet", payload);
    return;
  }

  simulateDemoBetOutcome();
}

function performBetRound() {
  prepareForNewRoundState();
}

function handleSliderChangeEvent(value) {
  refreshSliderState();
  currentSliderState.value = Number(value) || currentSliderState.value;
  updatePotentialProfitDisplay();
}

function handleControlPanelModeChange(mode) {
  controlPanelMode = mode === "auto" ? "auto" : "manual";
  if (controlPanelMode === "manual") {
    setControlPanelBetMode("bet");
    setControlPanelBetState(true);
    setControlPanelBetControlsClickable(true);
    setControlPanelModeToggleClickable(true);
    setControlPanelAutoStartState(false);
  } else {
    setControlPanelBetState(false);
    setControlPanelBetControlsClickable(true);
    setControlPanelModeToggleClickable(true);
    setControlPanelAutoStartState(true);
    setAutoRunUIState(false);
  }
}

function handleBetValueChange(event) {
  updatePotentialProfitDisplay();
  const numeric = Number(event.detail?.numericValue ?? 0);
  sendRelayMessage("control:bet-value", { value: numeric });
}

function handleNumberOfBetsChange(event) {
  const value = event.detail?.value;
  const numeric = Number(value);
  const toSend = Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
  sendRelayMessage("control:number-of-bets", { value: toSend });
}

function handleStrategyModeChange(event) {
  const key = event.detail?.key;
  const mode = event.detail?.mode;
  sendRelayMessage("control:strategy-mode", { key, mode });
}

function handleStrategyValueChange(event) {
  const key = event.detail?.key;
  const value = event.detail?.value;
  sendRelayMessage("control:strategy-value", { key, value });
}

function handleStopOnProfitChange(event) {
  const value = event.detail?.value;
  sendRelayMessage("control:stop-on-profit", { value });
}

function handleStopOnLossChange(event) {
  const value = event.detail?.value;
  sendRelayMessage("control:stop-on-loss", { value });
}

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
        performBetRound(payload);
        break;
      case "reveal-roll":
      case "reveal-card":
        applyServerReveal(payload);
        break;
      case "auto-round-result":
        applyAutoResultsFromServer(payload?.results);
        break;
      case "stop-autobet":
        stopAutoBetProcess({ completed: Boolean(payload?.completed) });
        break;
      case "finalize-round":
        finalizeRound();
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
    stopAutoBetProcess({ completed: false });
    finalizeRound();
  }
});

const opts = {
  backgroundColor: "#0C0B0F",
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Arial",
  gameStartSoundPath: gameStartSoundUrl,
  winSoundPath: winSoundUrl,
  onSliderValueChange: (value) => handleSliderChangeEvent(value),
  onRollModeChange: (mode) => {
    refreshSliderState();
    currentSliderState.rollMode = mode;
    updatePotentialProfitDisplay();
    sendRelayMessage("control:roll-mode", { mode });
  },
};

(async () => {
  try {
    controlPanel = new ControlPanel("#control-panel", {
      gameName: "Dice",
    });
    controlPanel.addEventListener("modechange", (event) => {
      handleControlPanelModeChange(event.detail?.mode);
    });
    controlPanel.addEventListener("betvaluechange", (event) => {
      handleBetValueChange(event);
    });
    controlPanel.addEventListener("bet", () => handleBet());
    controlPanel.addEventListener("numberofbetschange", (event) => {
      handleNumberOfBetsChange(event);
    });
    controlPanel.addEventListener("strategychange", (event) => {
      handleStrategyModeChange(event);
    });
    controlPanel.addEventListener("strategyvaluechange", (event) => {
      handleStrategyValueChange(event);
    });
    controlPanel.addEventListener("stoponprofitchange", (event) => {
      handleStopOnProfitChange(event);
    });
    controlPanel.addEventListener("stoponlosschange", (event) => {
      handleStopOnLossChange(event);
    });
    controlPanel.addEventListener("startautobet", () => handleStartAutobetClick());
    controlPanel.setBetAmountDisplay("$0.00");
    controlPanel.setProfitOnWinDisplay("$0.00");
    controlPanel.setProfitValue("0.00000000");
    setControlPanelAutoStartState(controlPanelMode === "auto");
    updatePotentialProfitDisplay();
  } catch (err) {
    console.error("Control panel initialization failed:", err);
  }

  try {
    game = await createGame("#game", opts);
    window.game = game;
    refreshSliderState();
    updatePotentialProfitDisplay();
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
