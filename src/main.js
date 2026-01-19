import buildConfig from "../buildConfig.json";
import { createGame } from "./game/game.js";
import { ControlPanel } from "./controlPanel/controlPanel.js";
import { ServerRelay } from "./serverRelay.js";
import { createServer, submitBet } from "./server/server.js";

import winSoundUrl from "../assets/sounds/Win.wav";

const buildId = buildConfig?.buildId ?? "0.0.0";
const buildDate = buildConfig?.buildDate ?? "Unknown";
const buildEnvironment = buildConfig?.environment ?? "Production";

console.info(`🚀 Build: ${buildId}`);
console.info(`📅 Date: ${buildDate}`);
console.info(`🌐 Environment: ${buildEnvironment}`);

let game;
let controlPanel;
let autoBetTimeoutId = null;
let autoBetStopRequested = false;
let isAutoBetRunning = false;
let serverAutoTimeoutId = null;
const serverRelay = new ServerRelay();
let demoMode = serverRelay.demoMode;
let serverPanel = null;
let lastRollMode = "inside";
let awaitingServerBetOutcome = false;
let awaitingServerAutoOutcome = false;
let lastWinChance = null;
let lastTargetMultiplier = null;
const bottomPanelLocks = {
  manual: false,
  auto: false,
};

const betControlLocks = {
  manual: false,
  auto: false,
};

let autoBetsRemaining = null;
let serverAutoStopPending = false;

let serverAutoSessionProfit = 0;

let autoNumberOfBetsLocked = false;

const opts = {
  // Window visuals
  backgroundColor: "#091B26",
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Arial",

  // Sounds
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
  onSliderValueChange: (details) => {
    const normalizedDetails =
      details && typeof details === "object" ? details : {};
    const winChance = clampPercent(Number(normalizedDetails.winChance));
    const multiplier = Number(normalizedDetails.multiplier);
    const values = Array.isArray(normalizedDetails.values)
      ? normalizedDetails.values.map((value) => Number(value))
      : [];
    lastRollMode = normalizedDetails.rollMode ?? lastRollMode;
    lastWinChance = winChance;
    lastTargetMultiplier =
      Number.isFinite(multiplier) && multiplier > 0
        ? multiplier
        : winChance > 0
        ? 99 / winChance
        : Infinity;

    console.debug(`Main calculated win chance: ${winChance.toFixed(2)}%`);

    sendRelayMessage("game:slider-change", {
      targets: values,
      rollMode: lastRollMode,
      winChance,
      multiplier: lastTargetMultiplier,
    });
  },
  onRollModeChange: (mode) => {
    lastRollMode = mode;
    console.debug(`Roll mode changed to ${mode}`);
    sendRelayMessage("game:roll-mode-change", { mode });
    controlPanel?.setRollMode?.(mode, { emit: false });
  },
};

serverRelay.addEventListener("incoming", (event) => {
  handleIncomingMessage(event?.detail);
});

serverRelay.addEventListener("demomodechange", (event) => {
  applyDemoMode(Boolean(event?.detail?.value));
});

window.addEventListener("keydown", (event) => {
  const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
  if (event.ctrlKey && event.altKey && key === "o") {
    event.preventDefault();
    serverPanel?.show?.();
  }
});

(async () => {
  // Initialize Control Panel
  try {
    controlPanel = new ControlPanel("#control-panel", {
      gameName: "Dice",
    });
    controlPanel?.setInteractable?.(false);
    controlPanel.addEventListener("animationschange", (event) => {
      const enabled = Boolean(event.detail?.enabled);
      opts.disableAnimations = !enabled;
      game?.setAnimationsEnabled?.(enabled);
    });
    controlPanel.addEventListener("showserver", () => {
      serverPanel?.show?.();
    });
    controlPanel.addEventListener("modechange", (event) => {
      const mode = event?.detail?.mode;
      console.debug(`Control panel mode changed to ${mode}`);
      sendRelayMessage("control:modechange", { mode });
    });
    controlPanel.addEventListener("betvaluechange", (event) => {
      const detail = event?.detail ?? {};
      console.debug(`Bet value updated to ${detail.value}`);
      const numericBetValue = Number(detail.numericValue);
      if (Number.isFinite(numericBetValue)) {
        if (numericBetValue > 0 && demoMode) {
          serverRelay.setDemoMode(false);
        } else if (numericBetValue === 0 && !demoMode) {
          serverRelay.setDemoMode(true);
        }
      }
      sendRelayMessage("control:betvaluechange", detail);
    });
    controlPanel.addEventListener("rollmodechange", (event) => {
      const mode = event?.detail?.mode;
      if (!mode) {
        return;
      }
      lastRollMode = mode;
      game?.setRollMode?.(mode);
      sendRelayMessage("control:rollmodechange", { mode });
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
        requestServerAutoBetStop();
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
    const initialWinChance = toFiniteNumber(game?.getWinChance?.());
    if (initialWinChance !== null) {
      lastWinChance = initialWinChance;
      lastTargetMultiplier = initialWinChance > 0 ? 99 / initialWinChance : null;
    }
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
  } finally {
    controlPanel?.setInteractable?.(true);
  }

  serverPanel = createServer(serverRelay, {
    initialDemoMode: demoMode,
    onDemoModeToggle: (value) => serverRelay.setDemoMode(value),
    initialDemoMode: demoMode,
    initialHidden: true,
    onVisibilityChange: (isVisible) => {
      controlPanel?.setServerPanelVisibility?.(isVisible);
    },
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
    `Bet placed. Revealing roll ${roll.toFixed(1)} with ${(
      winChance * 100
    ).toFixed(2)}% win chance.`
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
  const betAmount = toFiniteNumber(controlPanel?.getBetValue?.());
  if (betAmount === null || betAmount <= 0) {
    return;
  }
  if (controlPanel?.getMode?.() === "manual") {
    lockManualBetControls();
  }
  awaitingServerBetOutcome = true;
  lockBottomPanelControls("manual");
  const payload = buildServerBetPayload();
  payload.betAmount = betAmount;
  sendRelayMessage("control:bet", payload);

  (async () => {
    try {
      const betResponse = await submitBet({
        amount: betAmount,
        rate: payload.winChance ?? 0,
        targetMultiplier: payload.targetMultiplier,
        relay: serverRelay,
      });

      const state = betResponse?.state ?? betResponse?.responseData?.state ?? null;
      const rawResultValue =
        state?.resultValue?.value ?? state?.resultValue ?? payload.resultValue;
      const resultValue = toFiniteNumber(rawResultValue);
      const rollValue = resultValue === null ? null : resultValue * 100;
      const winAmount = state?.winAmount ?? betResponse?.responseData?.state?.winAmount;

      onManualBetOutcomeReceived();
      processServerRoll({
        roll: rollValue,
        betValue: betAmount,
        winChance: payload.winChance,
        totalProfit: winAmount,
        totalProfitValue: winAmount,
      });
    } catch (error) {
      console.error("Failed to submit bet", error);
      awaitingServerBetOutcome = false;
      unlockManualBetControls();
      unlockBottomPanelControls("manual");
    }
  })();
}

function handleServerAutoBetStart() {
  if (demoMode) {
    return;
  }
  if (awaitingServerAutoOutcome) {
    return;
  }
  initializeAutoBetCounter();
  serverAutoStopPending = false;
  resetServerAutoSessionProfit();
  clearTimeout(serverAutoTimeoutId);
  serverAutoTimeoutId = null;
  if (controlPanel?.getMode?.() === "auto") {
    controlPanel?.setAutoStartButtonMode?.("stop");
  }
  lockBetControls("auto");
  lockAutoNumberOfBets();
  lockBottomPanelControls("auto");
  const payload = buildServerBetPayload();
  const numberOfBetsValue = controlPanel?.getNumberOfBetsValue?.();
  payload.numberOfBets = Number.isFinite(numberOfBetsValue)
    ? Math.max(0, Math.floor(numberOfBetsValue))
    : null;
  sendRelayMessage("control:start-autobet", payload);
  runServerAutoBetRound();
}

function runServerAutoBetRound() {
  if (demoMode) {
    return;
  }
  if (serverAutoStopPending) {
    finalizeServerAutoLoop();
    return;
  }
  if (awaitingServerAutoOutcome) {
    return;
  }

  const betAmount = toFiniteNumber(controlPanel?.getBetValue?.());
  if (betAmount === null || betAmount <= 0) {
    finalizeServerAutoLoop();
    return;
  }

  awaitingServerAutoOutcome = true;
  const payload = buildServerBetPayload();
  payload.betAmount = betAmount;
  sendRelayMessage("control:auto-bet", payload);

  (async () => {
    try {
      const betResponse = await submitBet({
        amount: betAmount,
        rate: payload.winChance ?? 0,
        targetMultiplier: payload.targetMultiplier,
        relay: serverRelay,
      });

      const state = betResponse?.state ?? betResponse?.responseData?.state ?? null;
      const rawResultValue =
        state?.resultValue?.value ?? state?.resultValue ?? payload.resultValue;
      const resultValue = toFiniteNumber(rawResultValue);
      const rollValue = resultValue === null ? null : resultValue * 100;
      const winAmount = state?.winAmount ?? betResponse?.responseData?.state?.winAmount;
      const outcomeStatus =
        typeof state?.status === "string"
          ? state.status.toLowerCase()
          : null;
      const didWin = outcomeStatus === "won" || (toFiniteNumber(winAmount) ?? 0) > 0;
      const roundProfit = calculateServerAutoRoundProfit({
        betAmount,
        winAmount,
      });

      awaitingServerAutoOutcome = false;
      processServerRoll({
        roll: rollValue,
        betValue: betAmount,
        winChance: payload.winChance,
        totalProfit: winAmount,
        totalProfitValue: winAmount,
      });
      updateServerAutoSessionProfit(roundProfit);
      applyServerAutoAdvancedStrategies({ didWin, didLose: !didWin, betAmount });
      const shouldStopForProfit = shouldStopServerAutoForProfitOrLoss();
      if (shouldStopForProfit) {
        finalizeServerAutoLoop();
        return;
      }
      const shouldStop = decrementAutoBetsRemaining();
      if (shouldStop || serverAutoStopPending) {
        finalizeServerAutoLoop();
        return;
      }
      scheduleNextServerAutoBet();
    } catch (error) {
      console.error("Failed to submit auto bet", error);
      awaitingServerAutoOutcome = false;
      finalizeServerAutoLoop();
    }
  })();
}

function scheduleNextServerAutoBet() {
  clearTimeout(serverAutoTimeoutId);
  serverAutoTimeoutId = setTimeout(() => {
    runServerAutoBetRound();
  }, 1000);
}

function finalizeServerAutoLoop() {
  clearTimeout(serverAutoTimeoutId);
  serverAutoTimeoutId = null;
  onServerStopAutobetSignal();
}

function stopServerAutoLoop() {
  clearTimeout(serverAutoTimeoutId);
  serverAutoTimeoutId = null;
  if (awaitingServerAutoOutcome) {
    serverAutoStopPending = true;
    return;
  }
  finalizeServerAutoLoop();
  serverAutoStopPending = false;
}

function calculateServerAutoRoundProfit({ betAmount = 0, winAmount = 0 } = {}) {
  const wager = toFiniteNumber(betAmount) ?? 0;
  const winnings = toFiniteNumber(winAmount) ?? 0;
  return winnings - wager;
}

function updateServerAutoSessionProfit(delta) {
  const change = toFiniteNumber(delta);
  if (change === null) {
    return;
  }
  serverAutoSessionProfit += change;
}

function resetServerAutoSessionProfit() {
  serverAutoSessionProfit = 0;
}

function applyServerAutoAdvancedStrategies({ didWin = false, didLose = false, betAmount = null } = {}) {
  if (!controlPanel?.isAutoAdvancedEnabled?.()) {
    return;
  }

  if (didWin && controlPanel?.getOnWinMode?.() === "increase") {
    increaseBetAmountByPercent(controlPanel?.getOnWinIncreaseValue?.(), betAmount);
  }

  if (didLose && controlPanel?.getOnLossMode?.() === "increase") {
    increaseBetAmountByPercent(controlPanel?.getOnLossIncreaseValue?.(), betAmount);
  }
}

function shouldStopServerAutoForProfitOrLoss() {
  if (!controlPanel?.isAutoAdvancedEnabled?.()) {
    return false;
  }
  const profitThreshold = getServerAutoStopOnProfitThreshold();
  if (profitThreshold > 0 && serverAutoSessionProfit >= profitThreshold) {
    return true;
  }

  const lossThreshold = getServerAutoStopOnLossThreshold();
  if (lossThreshold > 0 && -serverAutoSessionProfit >= lossThreshold) {
    return true;
  }

  return false;
}

function getServerAutoStopOnProfitThreshold() {
  const threshold = toFiniteNumber(controlPanel?.getStopOnProfitValue?.());
  return threshold !== null ? Math.max(0, threshold) : 0;
}

function getServerAutoStopOnLossThreshold() {
  const threshold = toFiniteNumber(controlPanel?.getStopOnLossValue?.());
  return threshold !== null ? Math.max(0, threshold) : 0;
}

function increaseBetAmountByPercent(percent, currentBetFallback = null) {
  const percentValue = Math.max(0, toFiniteNumber(percent) ?? 0);
  const betValue = toFiniteNumber(controlPanel?.getBetValue?.());
  const baseBet = betValue !== null ? betValue : toFiniteNumber(currentBetFallback);
  if (baseBet === null || baseBet === undefined || baseBet < 0) {
    return;
  }
  const nextBet = baseBet * (1 + percentValue / 100);
  if (!Number.isFinite(nextBet)) {
    return;
  }
  controlPanel?.setBetInputValue?.(nextBet);
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
  initializeAutoBetCounter();
  controlPanel?.setAutoStartButtonMode?.("stop");
  controlPanel?.setAutoStartButtonState?.("clickable");
  runAutoBetCycle();
}

function runAutoBetCycle() {
  if (!isAutoBetRunning || !demoMode) {
    return;
  }
  handleBet();
  const shouldStop = decrementAutoBetsRemaining();
  if (shouldStop) {
    finalizeAutoBetStop();
    return;
  }
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
  resetAutoBetCounter();
}

function applyDemoMode(enabled) {
  demoMode = Boolean(enabled);
  window.demoMode = demoMode;
  awaitingServerBetOutcome = false;
  awaitingServerAutoOutcome = false;
  stopAutoBetImmediately();
  stopServerAutoLoop();
  serverPanel?.setDemoMode?.(demoMode);
  unlockManualBetControls();
  resetBetControlLocks();
  unlockAutoNumberOfBets();
  resetBottomPanelLocks();
  serverAutoStopPending = false;
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
      handleServerAutoBetProgress();
      break;
    case "profit:update-total":
      applyServerProfitUpdate(payload);
      break;
    case "profit:update-multiplier":
      applyServerMultiplierUpdate(payload);
      break;
    case "stop-autobet":
      onServerStopAutobetSignal();
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

function onServerStopAutobetSignal() {
  const currentAutoMode = controlPanel?.getAutoStartButtonMode?.();
  if (currentAutoMode && currentAutoMode !== "start") {
    controlPanel.setAutoStartButtonMode("start");
  }
  controlPanel?.setAutoStartButtonState?.("clickable");
  awaitingServerAutoOutcome = false;
  unlockBottomPanelControls("auto");
  unlockBetControls("auto");
  unlockAutoNumberOfBets();
  resetAutoBetCounter();
  serverAutoStopPending = false;
}

function processServerRoll(payload = {}) {
  const numericRoll = toFiniteNumber(payload.roll);
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
      return ratioCandidate > 1
        ? ratioCandidate / 100
        : Math.max(0, ratioCandidate);
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

  if (
    payload.totalProfit !== undefined ||
    payload.totalProfitValue !== undefined
  ) {
    const totalProfit = payload.totalProfit ?? payload.totalProfitValue;
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
  lockBetControls("manual");
  controlPanel?.setBetButtonState?.("non-clickable");
}

function unlockManualBetControls() {
  controlPanel?.setModeToggleClickable?.(true);
  unlockBetControls("manual");
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

function getTargetMultiplierValue() {
  const winChance = (() => {
    const value = toFiniteNumber(game?.getWinChance?.());
    if (value !== null) {
      return value;
    }
    if (toFiniteNumber(lastWinChance) !== null) {
      return lastWinChance;
    }
    return null;
  })();

  if (winChance === null || winChance <= 0) {
    return toFiniteNumber(lastTargetMultiplier);
  }

  return 99 / winChance;
}

function buildServerBetPayload() {
  const payload = {};
  const betValue = toFiniteNumber(controlPanel?.getBetValue?.());
  if (betValue !== null) {
    payload.betValue = betValue;
  }
  const rollMode =
    typeof game?.getRollMode === "function" ? game.getRollMode() : lastRollMode;
  if (rollMode) {
    payload.rollMode = rollMode;
  }
  const winChanceValue = (() => {
    if (typeof game?.getWinChance === "function") {
      const value = Number(game.getWinChance());
      if (Number.isFinite(value)) {
        return value;
      }
    }
    if (Number.isFinite(lastWinChance)) {
      return lastWinChance;
    }
    return null;
  })();
  if (Number.isFinite(winChanceValue)) {
    payload.winChance = winChanceValue;
  }
  const targetMultiplier = getTargetMultiplierValue();
  if (targetMultiplier !== null) {
    payload.targetMultiplier = targetMultiplier;
  }
  return payload;
}

function lockBetControls(key) {
  if (!betControlLocks[key]) {
    betControlLocks[key] = true;
    updateBetControlsClickableState();
  }
}

function unlockBetControls(key) {
  if (betControlLocks[key]) {
    betControlLocks[key] = false;
    updateBetControlsClickableState();
  }
}

function resetBetControlLocks() {
  betControlLocks.manual = false;
  betControlLocks.auto = false;
  updateBetControlsClickableState();
}

function updateBetControlsClickableState() {
  const shouldLock = betControlLocks.manual || betControlLocks.auto;
  controlPanel?.setBetControlsClickable?.(!shouldLock);
}

function lockAutoNumberOfBets() {
  if (!autoNumberOfBetsLocked) {
    autoNumberOfBetsLocked = true;
    controlPanel?.setNumberOfBetsClickable?.(false);
  }
}

function unlockAutoNumberOfBets() {
  if (autoNumberOfBetsLocked) {
    autoNumberOfBetsLocked = false;
    controlPanel?.setNumberOfBetsClickable?.(true);
  }
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

function initializeAutoBetCounter() {
  const rawValue = controlPanel?.getNumberOfBetsValue?.();
  if (Number.isFinite(rawValue) && rawValue > 0) {
    autoBetsRemaining = Math.floor(rawValue);
  } else {
    autoBetsRemaining = null;
  }
}

function resetAutoBetCounter() {
  autoBetsRemaining = null;
}

function decrementAutoBetsRemaining() {
  if (!(Number.isFinite(autoBetsRemaining) && autoBetsRemaining > 0)) {
    return false;
  }
  autoBetsRemaining = Math.max(0, autoBetsRemaining - 1);
  controlPanel?.setNumberOfBetsValue?.(autoBetsRemaining);
  sendRelayMessage("control:numberofbetschange", {
    value: autoBetsRemaining,
  });
  return autoBetsRemaining <= 0;
}

function handleServerAutoBetProgress() {
  if (demoMode) {
    return;
  }
  const shouldStop = decrementAutoBetsRemaining();
  if (shouldStop && !serverAutoStopPending) {
    requestServerAutoBetStop();
  }
}

function requestServerAutoBetStop() {
  const currentMode = controlPanel?.getAutoStartButtonMode?.();
  if (currentMode !== "finish") {
    controlPanel?.setAutoStartButtonMode?.("finish");
  }
  controlPanel?.setAutoStartButtonState?.("non-clickable");
  if (!serverAutoStopPending) {
    sendRelayMessage("control:stop-autobet");
    serverAutoStopPending = true;
  }
  stopServerAutoLoop();
}
