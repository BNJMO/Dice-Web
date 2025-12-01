import { createGame } from "./game/game.js";
import { ControlPanel } from "./controlPanel/controlPanel.js";
import { ServerRelay } from "./serverRelay.js";
import {
  createServer,
  initializeSessionId,
  initializeGameSession,
  submitBet,
  submitStep,
  submitCashout,
  submitAutoplay,
  submitStopAutoplay,
  leaveGameSession,
  getGameSessionDetails,
  DEFAULT_SCRATCH_GAME_ID,
} from "./server/server.js";

import diamondTextureUrl from "../assets/sprites/Diamond.png";
import bombTextureUrl from "../assets/sprites/Bomb.png";
import explosionSheetUrl from "../assets/sprites/Explosion_Spritesheet.png";
import tileTapDownSoundUrl from "../assets/sounds/TileTapDown.wav";
import tileFlipSoundUrl from "../assets/sounds/TileFlip.wav";
import tileHoverSoundUrl from "../assets/sounds/TileHover.wav";
import diamondRevealedSoundUrl from "../assets/sounds/DiamondRevealed.wav";
import bombRevealedSoundUrl from "../assets/sounds/BombRevealed.wav";
import winSoundUrl from "../assets/sounds/Win.wav";

let game;
let controlPanel;
let demoMode = false;
const serverRelay = new ServerRelay();
let serverUI = null;
let suppressRelay = false;
let betButtonMode = "bet";
let roundActive = false;
let cashoutAvailable = false;
let lastKnownGameState = null;
let selectionDelayHandle = null;
let selectionPending = false;
let minesSelectionLocked = false;
let controlPanelMode = "manual";
let autoSelectionCount = 0;
let storedAutoSelections = [];
let autoRunActive = false;
let autoRunFlag = false;
let autoRoundInProgress = false;
let autoBetsRemaining = Infinity;
let autoResetTimer = null;
let autoStopShouldComplete = false;
let autoStopFinishing = false;
let autoRoundWinPopupHandled = false;
let autoStopRequestInFlight = false;
let autoRoundReadyForNext = false;
let manualRoundNeedsReset = false;
let sessionIdInitialized = false;
let gameSessionInitialized = false;
let leaveSessionInProgress = false;
let leaveSessionPromise = null;
let gameInitialized = false;

const controlPanelInteractivityState = {
  betButton: false,
  randomButton: false,
  minesSelect: false,
  autoStartButton: false,
  modeToggle: false,
  betControls: false,
  numberOfBets: false,
  advancedToggle: false,
  advancedStrategy: false,
  stopOnProfit: false,
  stopOnLoss: false,
  animationsToggle: true,
};

function hasPositiveBetAmount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function getCurrentBetValue() {
  return controlPanel?.getBetValue?.() ?? 0;
}

function syncDemoModeWithBetAmount(value = getCurrentBetValue()) {
  const shouldUseServerMode = hasPositiveBetAmount(value);
  setDemoMode(!shouldUseServerMode);
}

function handleKeyboardShortcuts(event) {
  const isServerPanelShortcut =
    event.ctrlKey &&
    event.altKey &&
    !event.metaKey &&
    String(event.key || "").toLowerCase() === "o";

  if (!isServerPanelShortcut) {
    return;
  }

  event.preventDefault();
  serverUI?.show?.();
}

function isControlPanelInteractivityAllowed() {
  if (!gameInitialized) {
    return false;
  }
  return demoMode || gameSessionInitialized;
}

function isAutoControlsInteractivityAllowed() {
  return isControlPanelInteractivityAllowed();
}

const gameRoot = document.querySelector("#game");
let gameLoadingOverlay = gameRoot?.querySelector(".loading") ?? null;
if (!demoMode && gameRoot && gameLoadingOverlay) {
  gameRoot.classList.add("is-loading");
}

let totalProfitMultiplierValue = 1;
let totalProfitAmountDisplayValue = "0.00000000";

const AUTO_RESET_DELAY_MS = 1500;
let autoResetDelayMs = AUTO_RESET_DELAY_MS;

const SERVER_RESPONSE_DELAY_MS = 0;
const SERVER_INITIALIZATION_RETRY_DELAY_MS = 3000;

let serverInitializationGeneration = 0;
let serverInitializationPromise = null;

function delay(duration) {
  const timeout = Number(duration);
  const normalized = Number.isFinite(timeout) && timeout >= 0 ? timeout : 0;
  return new Promise((resolve) => {
    setTimeout(resolve, normalized);
  });
}

function ensureGameLoadingOverlay() {
  if (!gameLoadingOverlay) {
    gameLoadingOverlay = document.createElement("div");
    gameLoadingOverlay.className = "loading";
    gameLoadingOverlay.textContent = "Loading Game";
  } else if (!gameLoadingOverlay.textContent) {
    gameLoadingOverlay.textContent = "Loading Game";
  }
  return gameLoadingOverlay;
}

function showGameLoadingOverlay() {
  if (!gameRoot) {
    return;
  }
  const overlay = ensureGameLoadingOverlay();
  if (!overlay.isConnected) {
    gameRoot.prepend(overlay);
  }
  gameRoot.classList.add("is-loading");
}

function hideGameLoadingOverlay() {
  if (gameLoadingOverlay?.isConnected) {
    gameLoadingOverlay.remove();
  }
  gameRoot?.classList.remove("is-loading");
}

async function runServerInitializationLoop({ showLoading = true } = {}) {
  const currentGeneration = ++serverInitializationGeneration;

  if (showLoading) {
    showGameLoadingOverlay();
  }

  while (currentGeneration === serverInitializationGeneration) {
    sessionIdInitialized = false;
    gameSessionInitialized = false;
    refreshStoredControlPanelInteractivity();

    try {
      await initializeSessionId({ relay: serverRelay });
      sessionIdInitialized = true;
    } catch (error) {
      sessionIdInitialized = false;
      console.error("Session ID initialization failed:", error);
      if (currentGeneration !== serverInitializationGeneration) {
        return false;
      }
      refreshStoredControlPanelInteractivity();
      await delay(SERVER_INITIALIZATION_RETRY_DELAY_MS);
      continue;
    }

    if (currentGeneration !== serverInitializationGeneration) {
      return false;
    }

    await delay(600);

    if (currentGeneration !== serverInitializationGeneration) {
      return false;
    }

    try {
      await initializeGameSession({ relay: serverRelay });
      gameSessionInitialized = true;
      refreshStoredControlPanelInteractivity();
    } catch (error) {
      gameSessionInitialized = false;
      console.error("Game session initialization failed:", error);
      if (currentGeneration !== serverInitializationGeneration) {
        return false;
      }
      refreshStoredControlPanelInteractivity();
      await delay(SERVER_INITIALIZATION_RETRY_DELAY_MS);
      continue;
    }

    if (gameSessionInitialized) {
      hideGameLoadingOverlay();
      return true;
    }
  }

  return false;
}

function startServerInitialization(options = {}) {
  if (serverInitializationPromise) {
    return serverInitializationPromise;
  }

  const promise = runServerInitializationLoop(options)
    .catch((error) => {
      console.error("Server initialization encountered an error:", error);
      return false;
    })
    .finally(() => {
      if (serverInitializationPromise === promise) {
        serverInitializationPromise = null;
      }
    });

  serverInitializationPromise = promise;
  return promise;
}

function withRelaySuppressed(callback) {
  suppressRelay = true;
  try {
    return callback?.();
  } finally {
    suppressRelay = false;
  }
}

function coerceNumericValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (value != null) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function setTotalProfitMultiplierValue(value) {
  const numeric = coerceNumericValue(value);
  const normalized = numeric != null && numeric > 0 ? numeric : 1;
  totalProfitMultiplierValue = normalized;
  controlPanel?.setTotalProfitMultiplier?.(normalized);
}

function normalizeTotalProfitAmount(value) {
  const numeric = coerceNumericValue(value);
  if (numeric != null) {
    const clamped = Math.max(0, numeric);
    return clamped.toFixed(8);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return "0.00000000";
}

function setTotalProfitAmountValue(value) {
  const normalized = normalizeTotalProfitAmount(value);
  totalProfitAmountDisplayValue = normalized;
  controlPanel?.setProfitValue?.(normalized);
}

function updateProfitFromServerState(state) {
  if (!state || typeof state !== "object") {
    return;
  }

  if (state.multiplier != null) {
    setTotalProfitMultiplierValue(state.multiplier);
  }

  if (state.winAmount != null) {
    setTotalProfitAmountValue(state.winAmount);
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
    serverUI?.setDemoMode?.(next);
    refreshStoredControlPanelInteractivity();
    return;
  }

  demoMode = next;
  serverRelay.setDemoMode(next);
  serverUI?.setDemoMode?.(next);
  refreshStoredControlPanelInteractivity();

  if (demoMode) {
    hideGameLoadingOverlay();
    clearSelectionDelay();
  }
}

function applyServerReveal(payload = {}) {
  const result = String(payload?.result ?? "").toLowerCase();
  clearSelectionDelay();
  selectionPending = false;
  if (result === "lost") {
    game?.SetSelectedCardIsBomb?.();
  } else {
    game?.setSelectedCardIsDiamond?.();
  }
}

function applyAutoResultsFromServer(results = [], { map = null } = {}) {
  clearSelectionDelay();
  selectionPending = false;
  if (map && typeof game?.setServerRevealMap === "function") {
    game.setServerRevealMap(map);
  }
  if (!Array.isArray(results) || results.length === 0) {
    return;
  }
  game?.revealAutoSelections?.(results);
}

function tryScheduleAutoRound() {
  if (!autoRunActive || !autoRoundReadyForNext) {
    return;
  }

  if (!demoMode && !suppressRelay && autoStopRequestInFlight) {
    return;
  }

  scheduleNextAutoBetRound();
}

function requestServerStopAutoplay() {
  autoStopRequestInFlight = true;

  submitStopAutoplay({
    gameId: getActiveGameId(),
    relay: serverRelay,
  })
    .catch((error) => {
      console.error("Failed to submit stop autoplay", error);
    })
    .finally(() => {
      autoStopRequestInFlight = false;
      tryScheduleAutoRound();
    });
}

function normalizeAutoplayStatus(status) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "win" || normalized === "won") {
    return "win";
  }
  if (normalized === "lost" || normalized === "loss") {
    return "lost";
  }
  return null;
}

function normalizeGridSize(value) {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 5;
}

function normalizeMinesForGrid(mines, gridSize) {
  const totalTiles = gridSize * gridSize;
  const maxMines = Math.max(1, totalTiles - 1);
  const numeric = Math.floor(Number(mines));
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  return Math.min(Math.max(numeric, 1), maxMines);
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildAutoRoundAssignments({ status, selections, gridSize, mines }) {
  const size = normalizeGridSize(gridSize);
  const mineCount = normalizeMinesForGrid(mines, size);
  const isWin = status === "win";
  const selectionKeys = new Set();

  const normalizedSelections = Array.isArray(selections)
    ? selections
        .map((selection) => ({
          row: Math.floor(Number(selection?.row)),
          col: Math.floor(Number(selection?.col)),
        }))
        .filter((selection) =>
          Number.isInteger(selection.row) &&
          Number.isInteger(selection.col) &&
          selection.row >= 0 &&
          selection.col >= 0 &&
          selection.row < size &&
          selection.col < size
        )
        .filter((selection) => {
          const key = `${selection.row},${selection.col}`;
          if (selectionKeys.has(key)) {
            return false;
          }
          selectionKeys.add(key);
          return true;
        })
    : [];

  const allPositions = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      allPositions.push({ row, col });
    }
  }

  const bombPositions = new Set();
  const selectionArray = Array.from(selectionKeys);

  if (isWin) {
    const available = allPositions.filter(
      (pos) => !selectionKeys.has(`${pos.row},${pos.col}`)
    );
    shuffleInPlace(available);
    const bombsToAssign = Math.min(mineCount, available.length);
    for (let i = 0; i < bombsToAssign; i++) {
      const position = available[i];
      bombPositions.add(`${position.row},${position.col}`);
    }
  } else {
    if (selectionArray.length > 0) {
      const forcedBombIndex = Math.floor(Math.random() * selectionArray.length);
      bombPositions.add(selectionArray[forcedBombIndex]);
    }

    const available = allPositions.filter(
      (pos) => !bombPositions.has(`${pos.row},${pos.col}`)
    );
    shuffleInPlace(available);
    const bombsRemaining = Math.max(mineCount - bombPositions.size, 0);
    for (let i = 0; i < bombsRemaining && i < available.length; i++) {
      const position = available[i];
      bombPositions.add(`${position.row},${position.col}`);
    }
  }

  const results = normalizedSelections.map((selection) => {
    const key = `${selection.row},${selection.col}`;
    const isBomb = bombPositions.has(key);
    return {
      row: selection.row,
      col: selection.col,
      result: isBomb ? "bomb" : "diamond",
    };
  });

  const serverMap = [];
  for (let row = 0; row < size; row++) {
    const rowValues = [];
    for (let col = 0; col < size; col++) {
      const key = `${row},${col}`;
      rowValues.push(bombPositions.has(key) ? 0 : 2);
    }
    serverMap.push(rowValues);
  }

  return { results, serverMap };
}

function buildAutoResultsFromState(state, selections) {
  const normalizedStatus = normalizeAutoplayStatus(state?.status);
  const gridSize = normalizeGridSize(opts?.grid);
  const mines = normalizeMinesForGrid(opts?.mines, gridSize);

  const { results, serverMap } = buildAutoRoundAssignments({
    status: normalizedStatus,
    selections,
    gridSize,
    mines,
  });

  return { results, serverMap, status: normalizedStatus };
}

const serverMount =
  document.querySelector(".app-wrapper") ?? document.body;
serverUI = createServer(serverRelay, {
  mount: serverMount,
  onDemoModeToggle: (value) => {
    const betValue = getCurrentBetValue();
    if (!hasPositiveBetAmount(betValue) && !value) {
      setDemoMode(true);
      return;
    }
    setDemoMode(value);
  },
  initialDemoMode: demoMode,
  initialHidden: true,
  onVisibilityChange: (isVisible) => {
    controlPanel?.setServerPanelVisibility?.(isVisible);
  },
});
controlPanel?.setServerPanelVisibility?.(
  serverUI?.isVisible?.() ?? false
);
serverRelay.setDemoMode(demoMode);

document.addEventListener("keydown", handleKeyboardShortcuts);

serverRelay.addEventListener("incoming", (event) => {
  const { type, payload } = event.detail ?? {};
  withRelaySuppressed(() => {
    switch (type) {
      case "start-bet":
        performBet();
        setControlPanelRandomState(true);
        break;
      case "bet-result":
        applyServerReveal(payload);
        break;
      case "auto-bet-result":
        applyAutoResultsFromServer(payload?.results, { map: payload?.map });
        break;
      case "stop-autobet":
        stopAutoBetProcess({ completed: Boolean(payload?.completed) });
        break;
      case "finalize-bet":
        finalizeRound({ preserveAutoSelections: controlPanelMode === "auto" });
        break;
      case "cashout":
        if (roundActive && cashoutAvailable) {
          handleCashout();
        }
        break;
      case "profit:update-multiplier": {
        const incomingValue =
          payload?.numericValue ?? payload?.value ?? null;
        setTotalProfitMultiplierValue(incomingValue);
        break;
      }
      case "profit:update-total": {
        const incomingValue =
          payload?.numericValue ?? payload?.value ?? null;
        setTotalProfitAmountValue(incomingValue);
        break;
      }
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
  serverUI?.setDemoMode?.(value);
  refreshStoredControlPanelInteractivity();
  if (demoMode) {
    clearSelectionDelay();
  }
});

function setControlPanelBetMode(mode) {
  betButtonMode = mode === "bet" ? "bet" : "cashout";
  controlPanel?.setBetButtonMode?.(betButtonMode);
}

function setControlPanelBetState(isClickable, { store = true } = {}) {
  const normalized = Boolean(isClickable);
  if (store) {
    controlPanelInteractivityState.betButton = normalized;
  }
  const clickable = normalized && isControlPanelInteractivityAllowed();
  controlPanel?.setBetButtonState?.(
    clickable ? "clickable" : "non-clickable"
  );
}

function setControlPanelRandomState(isClickable, { store = true } = {}) {
  const normalized = Boolean(isClickable);
  if (store) {
    controlPanelInteractivityState.randomButton = normalized;
  }
  const clickable = normalized && isControlPanelInteractivityAllowed();
  controlPanel?.setRandomPickState?.(
    clickable ? "clickable" : "non-clickable"
  );
}

function setControlPanelAutoStartState(isClickable, { store = true } = {}) {
  if (store) {
    controlPanelInteractivityState.autoStartButton = Boolean(isClickable);
  }
  const shouldEnable = Boolean(isClickable) && !autoStopFinishing;
  const clickable = shouldEnable && isControlPanelInteractivityAllowed();
  controlPanel?.setAutoStartButtonState?.(
    clickable ? "clickable" : "non-clickable"
  );
}

function setControlPanelMinesState(isClickable, { store = true } = {}) {
  const normalized = Boolean(isClickable);
  if (store) {
    controlPanelInteractivityState.minesSelect = normalized;
  }
  const clickable = normalized && isControlPanelInteractivityAllowed();
  controlPanel?.setMinesSelectState?.(
    clickable ? "clickable" : "non-clickable"
  );
}

function setControlPanelModeToggleClickable(isClickable, { store = true } = {}) {
  const normalized = Boolean(isClickable);
  if (store) {
    controlPanelInteractivityState.modeToggle = normalized;
  }
  const clickable = normalized && isControlPanelInteractivityAllowed();
  controlPanel?.setModeToggleClickable?.(clickable);
}

function setControlPanelBetControlsClickable(
  isClickable,
  { store = true } = {}
) {
  const normalized = Boolean(isClickable);
  if (store) {
    controlPanelInteractivityState.betControls = normalized;
  }
  const clickable = normalized && isControlPanelInteractivityAllowed();
  controlPanel?.setBetControlsClickable?.(clickable);
}

function setControlPanelNumberOfBetsClickable(
  isClickable,
  { store = true } = {}
) {
  const normalized = Boolean(isClickable);
  if (store) {
    controlPanelInteractivityState.numberOfBets = normalized;
  }
  const clickable = normalized && isAutoControlsInteractivityAllowed();
  controlPanel?.setNumberOfBetsClickable?.(clickable);
}

function setControlPanelAdvancedToggleClickable(
  isClickable,
  { store = true } = {}
) {
  const normalized = Boolean(isClickable);
  if (store) {
    controlPanelInteractivityState.advancedToggle = normalized;
  }
  const clickable = normalized && isAutoControlsInteractivityAllowed();
  controlPanel?.setAdvancedToggleClickable?.(clickable);
}

function setControlPanelAdvancedStrategyControlsClickable(
  isClickable,
  { store = true } = {}
) {
  const normalized = Boolean(isClickable);
  if (store) {
    controlPanelInteractivityState.advancedStrategy = normalized;
  }
  const clickable = normalized && isAutoControlsInteractivityAllowed();
  controlPanel?.setAdvancedStrategyControlsClickable?.(clickable);
}

function setControlPanelStopOnProfitClickable(
  isClickable,
  { store = true } = {}
) {
  const normalized = Boolean(isClickable);
  if (store) {
    controlPanelInteractivityState.stopOnProfit = normalized;
  }
  const clickable = normalized && isAutoControlsInteractivityAllowed();
  controlPanel?.setStopOnProfitClickable?.(clickable);
}

function setControlPanelStopOnLossClickable(
  isClickable,
  { store = true } = {}
) {
  const normalized = Boolean(isClickable);
  if (store) {
    controlPanelInteractivityState.stopOnLoss = normalized;
  }
  const clickable = normalized && isAutoControlsInteractivityAllowed();
  controlPanel?.setStopOnLossClickable?.(clickable);
}

function setControlPanelAnimationsToggleClickable(
  isClickable,
  { store = true } = {}
) {
  const normalized = Boolean(isClickable);
  if (store) {
    controlPanelInteractivityState.animationsToggle = normalized;
  }
  const clickable = normalized && isControlPanelInteractivityAllowed();
  controlPanel?.setAnimationsToggleClickable?.(clickable);
}

function refreshStoredControlPanelInteractivity() {
  setControlPanelBetState(controlPanelInteractivityState.betButton, {
    store: false,
  });
  setControlPanelRandomState(controlPanelInteractivityState.randomButton, {
    store: false,
  });
  setControlPanelMinesState(controlPanelInteractivityState.minesSelect, {
    store: false,
  });
  setControlPanelAutoStartState(
    controlPanelInteractivityState.autoStartButton,
    { store: false }
  );
  setControlPanelModeToggleClickable(controlPanelInteractivityState.modeToggle, {
    store: false,
  });
  setControlPanelBetControlsClickable(
    controlPanelInteractivityState.betControls,
    { store: false }
  );
  setControlPanelNumberOfBetsClickable(
    controlPanelInteractivityState.numberOfBets,
    { store: false }
  );
  setControlPanelAdvancedToggleClickable(
    controlPanelInteractivityState.advancedToggle,
    { store: false }
  );
  setControlPanelAdvancedStrategyControlsClickable(
    controlPanelInteractivityState.advancedStrategy,
    { store: false }
  );
  setControlPanelStopOnProfitClickable(
    controlPanelInteractivityState.stopOnProfit,
    { store: false }
  );
  setControlPanelStopOnLossClickable(
    controlPanelInteractivityState.stopOnLoss,
    { store: false }
  );
  setControlPanelAnimationsToggleClickable(
    controlPanelInteractivityState.animationsToggle,
    { store: false }
  );
}

function disableServerRoundSetupControls() {
  setControlPanelBetState(false);
  setControlPanelRandomState(false);
  setControlPanelMinesState(false);
  setControlPanelModeToggleClickable(false);
  setControlPanelBetControlsClickable(false);
}

function normalizeMinesValue(value, maxMines) {
  const numeric = Math.floor(Number(value));
  let mines = Number.isFinite(numeric) ? numeric : 1;
  mines = Math.max(1, mines);
  if (Number.isFinite(maxMines)) {
    mines = Math.min(mines, maxMines);
  }
  return mines;
}

function applyMinesOption(value, { syncGame = false } = {}) {
  const maxMines = controlPanel?.getMaxMines?.();
  const mines = normalizeMinesValue(value, maxMines);

  opts.mines = mines;

  if (syncGame) {
    if (typeof game?.setMines === "function") {
      game.setMines(mines);
    } else {
      game?.reset?.();
    }
  }

  return mines;
}

function setGameBoardInteractivity(enabled) {
  const gameNode = document.querySelector("#game");
  if (!gameNode) {
    return;
  }
  gameNode.classList.toggle("is-round-complete", !enabled);
}

function clearSelectionDelay() {
  if (selectionDelayHandle) {
    clearTimeout(selectionDelayHandle);
    selectionDelayHandle = null;
  }
  selectionPending = false;
}

function beginSelectionDelay() {
  clearSelectionDelay();
  selectionPending = true;
  setControlPanelBetState(false);
  setControlPanelRandomState(false);
}

function scheduleSelectionResolution({ isBomb = false, serverMap = null } = {}) {
  if (selectionDelayHandle) {
    clearTimeout(selectionDelayHandle);
    selectionDelayHandle = null;
  }

  selectionDelayHandle = setTimeout(() => {
    selectionDelayHandle = null;

    if (!roundActive) {
      selectionPending = false;
      return;
    }

    if (serverMap && typeof game?.setServerRevealMap === "function") {
      game.setServerRevealMap(serverMap);
    }

    if (isBomb) {
      game?.SetSelectedCardIsBomb?.();
    } else {
      game?.setSelectedCardIsDiamond?.();
    }

    selectionPending = false;
  }, SERVER_RESPONSE_DELAY_MS);
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
    setControlPanelModeToggleClickable(false);
    setControlPanelBetControlsClickable(false);
    setControlPanelMinesState(false);
    setControlPanelNumberOfBetsClickable(false);
    setControlPanelAdvancedToggleClickable(false);
    setControlPanelAdvancedStrategyControlsClickable(false);
    setControlPanelStopOnProfitClickable(false);
    setControlPanelStopOnLossClickable(false);
  } else {
    controlPanel.setAutoStartButtonMode?.("start");
    autoStopFinishing = false;
    setControlPanelAutoStartState(true);
    setControlPanelModeToggleClickable(true);
    setControlPanelBetControlsClickable(true);
    setControlPanelNumberOfBetsClickable(true);
    setControlPanelAdvancedToggleClickable(true);
    setControlPanelAdvancedStrategyControlsClickable(true);
    setControlPanelStopOnProfitClickable(true);
    setControlPanelStopOnLossClickable(true);
    if (roundActive && !minesSelectionLocked) {
      setControlPanelMinesState(true);
    }
    handleAutoSelectionChange(autoSelectionCount);
  }
}

function startAutoRoundIfNeeded() {
  if (storedAutoSelections.length === 0) {
    return false;
  }

  if (!roundActive) {
    game?.reset?.({ preserveAutoSelections: true });
    prepareForNewRoundState({ preserveAutoSelections: true });
  }

  if (typeof game?.applyAutoSelections === "function") {
    game.applyAutoSelections(storedAutoSelections, { emit: true });
  }

  return true;
}

function executeAutoBetRound({ ensurePrepared = true } = {}) {
  if (!autoRunActive) {
    return;
  }

  if (storedAutoSelections.length === 0) {
    stopAutoBetProcess();
    return;
  }

  autoRoundReadyForNext = false;

  if (ensurePrepared && !startAutoRoundIfNeeded()) {
    stopAutoBetProcess({ completed: autoStopShouldComplete });
    autoStopShouldComplete = false;
    return;
  }

  const selections = storedAutoSelections.map((selection) => ({
    ...selection,
  }));
  if (selections.length === 0) {
    stopAutoBetProcess();
    return;
  }

  autoRoundWinPopupHandled = false;
  autoRoundInProgress = true;
  selectionPending = true;
  setControlPanelBetState(false);
  setControlPanelRandomState(false);
  setControlPanelMinesState(false);
  setGameBoardInteractivity(false);
  setControlPanelAutoStartState(true);

  clearSelectionDelay();

  if (!demoMode && !suppressRelay) {
    const payload = {
      selections: selections.map((selection) => ({
        ...selection,
      })),
    };
    sendRelayMessage("game:auto-round-request", payload);

    (async () => {
      try {
        const autoplayResult = await submitAutoplay({
          amount: controlPanel?.getBetValue?.(),
          steps: selections.length,
          difficulty: 1,
          gameId: getActiveGameId(),
          relay: serverRelay,
        });

        const state =
          autoplayResult?.state ?? autoplayResult?.responseData?.state ?? null;
        const { results, serverMap, status } = buildAutoResultsFromState(
          state,
          selections
        );

        applyAutoResultsFromServer(results, { map: serverMap });

        if (status === "win" && typeof game?.showWinPopup === "function") {
          autoRoundWinPopupHandled = true;
          game.showWinPopup(state?.multiplier, state?.winAmount);
        }

        requestServerStopAutoplay();
      } catch (error) {
        console.error("Failed to submit autoplay", error);
        selectionPending = false;
        autoRoundInProgress = false;
        stopAutoBetProcess();
      }
    })();
    return;
  }

  const results = [];
  let bombAssigned = false;

  for (const selection of selections) {
    const revealBomb = !bombAssigned && Math.random() < 0.15;
    if (revealBomb) {
      bombAssigned = true;
    }
    results.push({
      row: selection.row,
      col: selection.col,
      result: revealBomb ? "bomb" : "diamond",
    });
  }

  selectionDelayHandle = setTimeout(() => {
    selectionDelayHandle = null;
    selectionPending = false;

    if (!autoRunActive || !roundActive) {
      autoRoundInProgress = false;
      return;
    }

    game?.revealAutoSelections?.(results);
  }, SERVER_RESPONSE_DELAY_MS);
}

function scheduleNextAutoBetRound() {
  if (!autoRunActive) {
    return;
  }

  clearTimeout(autoResetTimer);
  autoResetTimer = setTimeout(() => {
    autoResetTimer = null;

    if (!autoRunActive) {
      return;
    }

    if (!autoRunFlag || autoStopShouldComplete) {
      if (
        !demoMode &&
        !suppressRelay &&
        controlPanelMode === "auto" &&
        autoStopFinishing &&
        autoRoundInProgress
      ) {
        return;
      }

      const completed = autoStopShouldComplete;
      autoStopShouldComplete = false;
      stopAutoBetProcess({ completed });
      return;
    }

      autoStopFinishing = false;
      setAutoRunUIState(true);
      executeAutoBetRound({ ensurePrepared: true });
    }, autoResetDelayMs);
}

function handleAutoRoundFinished() {
  autoRoundInProgress = false;

  autoRoundReadyForNext = true;

  if (!autoRunActive) {
    return;
  }

  if (Number.isFinite(autoBetsRemaining)) {
    autoBetsRemaining = Math.max(0, autoBetsRemaining - 1);
    controlPanel?.setNumberOfBetsValue?.(autoBetsRemaining);
  }

  if (Number.isFinite(autoBetsRemaining) && autoBetsRemaining <= 0) {
    const shouldSignalCompletion = !autoStopShouldComplete;
    autoRunFlag = false;
    autoStopShouldComplete = true;
    autoStopFinishing = true;
    setAutoRunUIState(true);

    if (shouldSignalCompletion && !demoMode && !suppressRelay) {
      sendRelayMessage("action:stop-autobet", {
        reason: "completed",
        completed: true,
      });
    }
  }

  tryScheduleAutoRound();
}

function beginAutoBetProcess() {
  if (selectionPending || autoSelectionCount <= 0) {
    return;
  }

  const selections = game?.getAutoSelections?.() ?? storedAutoSelections;
  if (!Array.isArray(selections) || selections.length === 0) {
    return;
  }

  storedAutoSelections = selections.map((selection) => ({ ...selection }));

  const configuredBets = controlPanel?.getNumberOfBetsValue?.();
  if (Number.isFinite(configuredBets) && configuredBets > 0) {
    autoBetsRemaining = Math.floor(configuredBets);
    controlPanel?.setNumberOfBetsValue?.(autoBetsRemaining);
  } else {
    autoBetsRemaining = Infinity;
  }

  autoRunFlag = true;
  autoRunActive = true;
  autoRoundInProgress = false;
  autoStopShouldComplete = false;
  autoStopFinishing = false;

  if (!demoMode && !suppressRelay) {
    const createAutobetPayload = () => ({
      selections: storedAutoSelections.map((selection) => ({
        ...selection,
      })),
      numberOfBets: Number.isFinite(autoBetsRemaining)
        ? autoBetsRemaining
        : 0,
    });
    sendRelayMessage("control:start-autobet", createAutobetPayload());
    sendRelayMessage("action:start-autobet", createAutobetPayload());
  }

  setAutoRunUIState(true);
  executeAutoBetRound();
}

function stopAutoBetProcess({ completed = false } = {}) {
  if (selectionDelayHandle) {
    clearTimeout(selectionDelayHandle);
    selectionDelayHandle = null;
    selectionPending = false;
  }

  clearTimeout(autoResetTimer);
  autoResetTimer = null;

  const wasActive = autoRunActive;
  autoRunActive = false;
  autoRunFlag = false;
  autoRoundInProgress = false;
  autoRoundReadyForNext = false;
  autoStopShouldComplete = false;
  if (!wasActive && !completed) {
    autoStopFinishing = false;
    handleAutoSelectionChange(autoSelectionCount);
    return;
  }

  const shouldPreserveSelections = controlPanelMode === "auto" || wasActive;
  const currentSelections = shouldPreserveSelections
    ? game?.getAutoSelections?.()
    : null;
  const preservedSelections = shouldPreserveSelections
    ? (Array.isArray(currentSelections) && currentSelections.length > 0
        ? currentSelections
        : storedAutoSelections
      ).map((selection) => ({ ...selection }))
    : [];

  finalizeRound({
    preserveAutoSelections:
      shouldPreserveSelections && preservedSelections.length > 0,
  });

  game?.reset?.({ preserveAutoSelections: false });

  autoStopFinishing = false;
  setAutoRunUIState(false);

  if (shouldPreserveSelections && preservedSelections.length > 0) {
    storedAutoSelections = preservedSelections;
    prepareForNewRoundState({ preserveAutoSelections: true });
    if (
      Array.isArray(storedAutoSelections) &&
      storedAutoSelections.length > 0 &&
      typeof game?.applyAutoSelections === "function"
    ) {
      game.applyAutoSelections(storedAutoSelections, { emit: true });
    }
  } else if (shouldPreserveSelections) {
    prepareForNewRoundState({ preserveAutoSelections: false });
  }
}

function applyRoundInteractiveState(state) {
  if (!roundActive) {
    return;
  }

  setControlPanelBetMode("cashout");

  if (selectionPending || state?.waitingForChoice) {
    setControlPanelBetState(false);
    setControlPanelRandomState(false);
    cashoutAvailable = (state?.revealedSafe ?? 0) > 0;
    return;
  }

  const hasRevealedSafe = (state?.revealedSafe ?? 0) > 0;
  cashoutAvailable = hasRevealedSafe;
  setControlPanelBetState(hasRevealedSafe);
  setControlPanelRandomState(true);
}

function prepareForNewRoundState({ preserveAutoSelections = false } = {}) {
  roundActive = true;
  cashoutAvailable = false;
  clearSelectionDelay();
  setControlPanelBetMode("cashout");
  setControlPanelBetState(false);
  setControlPanelRandomState(true);
  setGameBoardInteractivity(true);
  minesSelectionLocked = false;

  if (controlPanelMode !== "auto") {
    manualRoundNeedsReset = false;
    setControlPanelMinesState(false);
    setControlPanelModeToggleClickable(false);
    setControlPanelBetControlsClickable(false);
  } else if (!autoRunActive) {
    setControlPanelMinesState(true);
    setControlPanelModeToggleClickable(true);
    setControlPanelBetControlsClickable(true);
  }

  if (preserveAutoSelections) {
    autoSelectionCount = storedAutoSelections.length;
    if (!autoRunActive && controlPanelMode === "auto") {
      const canClick = autoSelectionCount > 0 && !selectionPending;
      setControlPanelAutoStartState(canClick);
    }
  } else {
    autoSelectionCount = 0;
    if (!autoRunActive) {
      setControlPanelAutoStartState(false);
    }
    game?.clearAutoSelections?.();
  }
}

function finalizeRound({ preserveAutoSelections = false } = {}) {
  roundActive = false;
  cashoutAvailable = false;
  clearSelectionDelay();
  setControlPanelBetMode("bet");
  setControlPanelRandomState(false);
  setGameBoardInteractivity(false);
  minesSelectionLocked = false;
  setControlPanelMinesState(true);

  if (autoRunActive) {
    setControlPanelBetState(false);
    setControlPanelMinesState(false);
    setControlPanelModeToggleClickable(false);
    setControlPanelBetControlsClickable(false);
  } else {
    setControlPanelBetState(true);
    setControlPanelMinesState(true);
    setControlPanelModeToggleClickable(true);
    setControlPanelBetControlsClickable(true);
  }

  if (preserveAutoSelections) {
    autoSelectionCount = storedAutoSelections.length;
    if (!autoRunActive && controlPanelMode === "auto") {
      const canClick = autoSelectionCount > 0 && !selectionPending;
      setControlPanelAutoStartState(canClick);
    }
  } else {
    autoSelectionCount = 0;
    if (!autoRunActive) {
      setControlPanelAutoStartState(false);
    }
  }
}

function handleBetButtonClick() {
  if (betButtonMode === "cashout") {
    handleCashout();
  } else {
    handleBet();
  }
}

function markManualRoundForReset() {
  if (controlPanelMode === "manual") {
    manualRoundNeedsReset = true;
  }
}

function handleCashout() {
  if (!roundActive || !cashoutAvailable) {
    return;
  }

  if (!demoMode && !suppressRelay) {
    sendRelayMessage("action:cashout", {});
    setControlPanelBetState(false);
    setControlPanelRandomState(false);

    (async () => {
      try {
        const cashoutResult = await submitCashout({
          gameId: getActiveGameId(),
          relay: serverRelay,
        });

        const state = cashoutResult?.state ?? cashoutResult?.responseData?.state ?? null;
        updateProfitFromServerState(state);

        const serverMap = Array.isArray(state?.map) ? state.map : null;
        if (serverMap && typeof game?.setServerRevealMap === "function") {
          game.setServerRevealMap(serverMap);
        }

        markManualRoundForReset();
        game?.revealRemainingTiles?.();
        showCashoutPopup();
        finalizeRound({ preserveAutoSelections: controlPanelMode === "auto" });
        handleAutoRoundFinished();
      } catch (error) {
        console.error("Failed to submit cashout", error);
        setControlPanelBetState(true);
        setControlPanelRandomState(true);
      }
    })();

    return;
  }

  markManualRoundForReset();
  game?.revealRemainingTiles?.();
  showCashoutPopup();
  finalizeRound({ preserveAutoSelections: controlPanelMode === "auto" });
}

function getActiveGameId() {
  const sessionDetails = getGameSessionDetails();
  if (Array.isArray(sessionDetails?.gameIds) && sessionDetails.gameIds.length > 0) {
    return sessionDetails.gameIds[0];
  }
  return DEFAULT_SCRATCH_GAME_ID;
}

function performBet() {
  applyMinesOption(controlPanel?.getMinesValue?.(), {
    syncGame: true,
  });
  prepareForNewRoundState();
  manualRoundNeedsReset = false;
}

async function handleBet() {
  if (!demoMode && !gameSessionInitialized) {
    console.warn("Cannot submit bet: game session is not initialized yet.");
    return;
  }

  if (!demoMode && !suppressRelay) {
    disableServerRoundSetupControls();
    const betAmount = controlPanel?.getBetValue?.();
    const minesValue = controlPanel?.getMinesValue?.();
    sendRelayMessage("action:bet", {
      bet: betAmount,
      mines: minesValue,
    });

    try {
      await submitBet({
        amount: betAmount,
        rate: minesValue,
        gameId: getActiveGameId(),
        relay: serverRelay,
      });
      performBet();
    } catch (error) {
      console.error("Failed to submit bet", error);
      setControlPanelBetState(true);
      setControlPanelRandomState(controlPanelMode === "manual");
      setControlPanelMinesState(true);
      setControlPanelModeToggleClickable(true);
      setControlPanelBetControlsClickable(true);
    }
    return;
  }

  performBet();
}

function requestLeaveGameSession(options = {}) {
  const force = Boolean(options.force);
  if (leaveSessionInProgress) {
    return leaveSessionPromise ?? Promise.resolve(false);
  }

  if (!force && (demoMode || !gameSessionInitialized)) {
    return Promise.resolve(false);
  }

  if (!gameSessionInitialized) {
    sessionIdInitialized = false;
    return Promise.resolve(false);
  }

  leaveSessionInProgress = true;

  const promise = leaveGameSession({
    gameId: getActiveGameId(),
    relay: serverRelay,
    keepalive: Boolean(options.keepalive),
  })
    .then(() => {
      gameSessionInitialized = false;
      sessionIdInitialized = false;
      refreshStoredControlPanelInteractivity();
      return true;
    })
    .catch((error) => {
      console.error("Failed to leave game session", error);
      return false;
    })
    .finally(() => {
      leaveSessionInProgress = false;
      if (leaveSessionPromise === promise) {
        leaveSessionPromise = null;
      }
    });

  leaveSessionPromise = promise;
  return promise;
}

window.addEventListener("beforeunload", () => {
  requestLeaveGameSession({ keepalive: true });
});

window.addEventListener("pagehide", (event) => {
  if (event?.persisted) {
    return;
  }
  requestLeaveGameSession({ keepalive: true });
});

function handleGameStateChange(state) {
  lastKnownGameState = state;
  if (!roundActive) {
    return;
  }

  if (state?.gameOver) {
    finalizeRound({ preserveAutoSelections: controlPanelMode === "auto" });
    return;
  }

  applyRoundInteractiveState(state);
}

function handleGameOver() {
  markManualRoundForReset();
  finalizeRound({ preserveAutoSelections: controlPanelMode === "auto" });
  handleAutoRoundFinished();
}

function handleGameWin() {
  game?.revealRemainingTiles?.();
  const shouldSkipWinPopup =
    !demoMode && autoRoundInProgress && autoRoundWinPopupHandled;

  if (!shouldSkipWinPopup) {
    game?.showWinPopup?.(
      totalProfitMultiplierValue,
      totalProfitAmountDisplayValue
    );
  }
  markManualRoundForReset();
  finalizeRound({ preserveAutoSelections: controlPanelMode === "auto" });
  handleAutoRoundFinished();
}

function handleRandomPickClick() {
  if (!roundActive || selectionPending) {
    return;
  }

  game?.selectRandomTile?.();
}

async function requestServerSelectionReveal(selection) {
  const row = Number(selection?.row);
  const col = Number(selection?.col);

  if (!Number.isFinite(row) || !Number.isFinite(col)) {
    console.error("Invalid selection coordinates", selection);
    scheduleSelectionResolution({ isBomb: true });
    return;
  }

  try {
    const stepResult = await submitStep({
      row,
      col,
      gameId: getActiveGameId(),
      relay: serverRelay,
    });

    const state = stepResult?.state ?? stepResult?.responseData?.state ?? null;
    updateProfitFromServerState(state);

    const normalizedStatus = String(state?.status ?? "").toLowerCase();
    const serverMap = Array.isArray(state?.map) ? state.map : null;
    const isBomb = normalizedStatus === "lost";
    const roundCompleteStatuses = new Set([
      "lost",
      "won",
      "win",
      "completed",
      "finished",
    ]);
    const shouldRevealMap = serverMap && roundCompleteStatuses.has(normalizedStatus);

    scheduleSelectionResolution({
      isBomb,
      serverMap: shouldRevealMap ? serverMap : null,
    });
  } catch (error) {
    console.error("Failed to reveal tile via server:", error);
    scheduleSelectionResolution({ isBomb: true });
  }
}

function handleCardSelected(selection) {
  if (!roundActive) {
    return;
  }

  if (controlPanelMode === "auto") {
    return;
  }

  if (!minesSelectionLocked) {
    minesSelectionLocked = true;
    setControlPanelMinesState(false);
  }

  beginSelectionDelay();
  const payload = {
    row: selection?.row,
    col: selection?.col,
  };

  if (!demoMode && !suppressRelay) {
    sendRelayMessage("game:manual-selection", payload);
    requestServerSelectionReveal(payload);
    return;
  }

  const revealBomb = Math.random() < 0.15;
  scheduleSelectionResolution({ isBomb: revealBomb });
}

function handleAutoSelectionChange(count) {
  autoSelectionCount = count;

  if (controlPanelMode === "auto") {
    const selections = game?.getAutoSelections?.() ?? [];
    if (Array.isArray(selections)) {
      if (count > 0) {
        storedAutoSelections = selections.map((selection) => ({
          ...selection,
        }));
      } else if (!autoRunActive && !autoRoundInProgress) {
        storedAutoSelections = selections.map((selection) => ({
          ...selection,
        }));
      }
    }
  }

  if (controlPanelMode !== "auto") {
    setControlPanelAutoStartState(false);
    return;
  }

  if (!roundActive) {
    if (!autoRunActive) {
      setControlPanelAutoStartState(false);
    }
    return;
  }

  if (count > 0 && !minesSelectionLocked) {
    minesSelectionLocked = true;
    setControlPanelMinesState(false);
  } else if (count === 0 && !autoRunActive) {
    minesSelectionLocked = false;
    setControlPanelMinesState(true);
  }

  if (autoRunActive) {
    setControlPanelAutoStartState(!autoStopFinishing);
    return;
  }

  const canClick = count > 0 && !selectionPending;
  setControlPanelAutoStartState(canClick);

  if (!demoMode && !suppressRelay && controlPanelMode === "auto") {
    const selectionsToSend = storedAutoSelections.map((selection) => ({
      ...selection,
    }));
    sendRelayMessage("game:auto-selections", {
      selections: selectionsToSend,
    });
  }
}

function handleStartAutobetClick() {
  if (autoRunActive) {
    if (!autoStopFinishing) {
      autoRunFlag = false;
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

function showCashoutPopup() {
  game?.showWinPopup?.(
    totalProfitMultiplierValue,
    totalProfitAmountDisplayValue
  );
}
const opts = {
  // Window visuals
  size: 600,
  backgroundColor: "#091B26",
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Arial",

  // Game setup
  grid: 5,
  mines: 5,
  autoResetDelayMs: AUTO_RESET_DELAY_MS,

  // Visuals
  diamondTexturePath: diamondTextureUrl,
  bombTexturePath: bombTextureUrl,
  iconSizePercentage: 0.7,
  iconRevealedSizeOpacity: 0.2,
  iconRevealedSizeFactor: 0.7,
  cardsSpawnDuration: 350,
  revealAllIntervalDelay: 40,
  strokeWidth: 1,
  gapBetweenTiles: 0.013,

  // Animations feel
  hoverEnabled: true,
  hoverEnterDuration: 120,
  hoverExitDuration: 200,
  hoverTiltAxis: "x",
  hoverSkewAmount: 0.00,
  disableAnimations: false,

  // Card Selected Wiggle
  wiggleSelectionEnabled: true,
  wiggleSelectionDuration: 900,
  wiggleSelectionTimes: 6,
  wiggleSelectionIntensity: 0.02,
  wiggleSelectionScale: 0.1,

  // Card Reveal Flip
  flipDelayMin: 150,
  flipDelayMax: 500,
  flipDuration: 300,
  flipEaseFunction: "easeInOutSine",

  // Bomb Explosion shake
  explosionShakeEnabled: true,
  explosionShakeDuration: 1000,
  explosionShakeAmplitude: 12,
  explosionShakerotationAmplitude: 0.012,
  explosionShakeBaseFrequency: 8,
  explosionShakeSecondaryFrequency: 13,

  // Bomb Explosion spritesheet
  explosionSheetEnabled: true,
  explosionSheetPath: explosionSheetUrl,
  explosionSheetCols: 7,
  explosionSheetRows: 3,
  explosionSheetFps: 24,
  explosionSheetScaleFit: 1.0,
  explosionSheetOpacity: 0.2,

  // Sounds
  tileTapDownSoundPath: tileTapDownSoundUrl,
  tileFlipSoundPath: tileFlipSoundUrl,
  tileHoverSoundPath: tileHoverSoundUrl,
  diamondRevealedSoundPath: diamondRevealedSoundUrl,
  bombRevealedSoundPath: bombRevealedSoundUrl,
  winSoundPath: winSoundUrl,
  diamondRevealPitchMin: 1.0,
  diamondRevealPitchMax: 1.25,

  // Win pop-up
  winPopupShowDuration: 260,
  winPopupWidth: 260,
  winPopupHeight: 200,

  // Event callback for when a card is selected
  getMode: () => controlPanelMode,
  onAutoSelectionChange: (count) => handleAutoSelectionChange(count),
  onCardSelected: (selection) => handleCardSelected(selection),
  onWin: handleGameWin,
  onGameOver: handleGameOver,
  onChange: handleGameStateChange,
  isRoundActive: () => roundActive,
};

(async () => {
  let serverInitializationTask = null;
  serverInitializationTask = startServerInitialization({
    showLoading: true,
  });

  const totalTiles = opts.grid * opts.grid;
  const maxMines = Math.max(1, totalTiles - 1);
  const initialMines = Math.max(1, Math.min(opts.mines ?? 1, maxMines));
  opts.mines = initialMines;

  // Initialize Control Panel
  try {
    controlPanel = new ControlPanel("#control-panel", {
      gameName: "Mines",
      totalTiles,
      maxMines,
      initialMines,
    });
    refreshStoredControlPanelInteractivity();
    syncDemoModeWithBetAmount(controlPanel?.getBetValue?.());
    controlPanelMode = controlPanel?.getMode?.() ?? "manual";
    controlPanel.addEventListener("modechange", (event) => {
      const nextMode = event.detail?.mode === "auto" ? "auto" : "manual";
      const previousMode = controlPanelMode;
      const currentSelections = game?.getAutoSelections?.() ?? [];
      if (controlPanelMode === "auto" && Array.isArray(currentSelections)) {
        storedAutoSelections = currentSelections.map((selection) => ({
          ...selection,
        }));
      }

      controlPanelMode = nextMode;

      if (nextMode !== "auto") {
        if (autoRunActive) {
          stopAutoBetProcess();
        }
        autoSelectionCount = 0;
        setControlPanelAutoStartState(false);
        game?.clearAutoSelections?.();
        finalizeRound();
      } else {
        if (previousMode === "manual" && manualRoundNeedsReset) {
          game?.reset?.({ preserveAutoSelections: true });
          manualRoundNeedsReset = false;
        }
        if (!roundActive && !autoRunActive) {
          prepareForNewRoundState({ preserveAutoSelections: true });
        }
        if (storedAutoSelections.length > 0) {
          game?.applyAutoSelections?.(storedAutoSelections, { emit: true });
        }
        handleAutoSelectionChange(storedAutoSelections.length);
      }
    });
    controlPanel.addEventListener("betvaluechange", (event) => {
      syncDemoModeWithBetAmount(
        event.detail?.numericValue ?? event.detail?.value
      );
      console.debug(`Bet value updated to ${event.detail.value}`);
      sendRelayMessage("control:bet-value", {
        value: event.detail?.value,
        numericValue: event.detail?.numericValue,
      });
    });
    controlPanel.addEventListener("mineschanged", (event) => {
      const shouldSyncGame =
        controlPanelMode === "auto" && !autoRunActive && !autoRoundInProgress;

      applyMinesOption(event.detail.value, { syncGame: shouldSyncGame });
      sendRelayMessage("control:mines", {
        value: event.detail?.value,
        totalTiles: event.detail?.totalTiles,
        gems: event.detail?.gems,
      });
    });
    controlPanel.addEventListener("numberofbetschange", (event) => {
      sendRelayMessage("control:number-of-bets", {
        value: event.detail?.value,
      });
    });
    controlPanel.addEventListener("strategychange", (event) => {
      sendRelayMessage("control:strategy-mode", {
        key: event.detail?.key,
        mode: event.detail?.mode,
      });
    });
    controlPanel.addEventListener("strategyvaluechange", (event) => {
      sendRelayMessage("control:strategy-value", {
        key: event.detail?.key,
        value: event.detail?.value,
      });
    });
    controlPanel.addEventListener("stoponprofitchange", (event) => {
      sendRelayMessage("control:stop-on-profit", {
        value: event.detail?.value,
      });
    });
    controlPanel.addEventListener("stoponlosschange", (event) => {
      sendRelayMessage("control:stop-on-loss", {
        value: event.detail?.value,
      });
    });
    controlPanel.addEventListener("animationschange", (event) => {
      const enabled = Boolean(event.detail?.enabled);
      opts.disableAnimations = !enabled;
      game?.setAnimationsEnabled?.(enabled);
    });
    controlPanel.addEventListener("showserver", () => {
      serverUI?.show?.();
    });
    controlPanel.addEventListener("bet", handleBetButtonClick);
    controlPanel.addEventListener("randompick", handleRandomPickClick);
    controlPanel.addEventListener("startautobet", handleStartAutobetClick);
    finalizeRound();
    controlPanel.setBetAmountDisplay("$0.00");
    setTotalProfitMultiplierValue(0.0);
    controlPanel.setProfitOnWinDisplay("$0.00");
    setTotalProfitAmountValue("0.00000000");
    handleAutoSelectionChange(autoSelectionCount);
    opts.disableAnimations = !(controlPanel.getAnimationsEnabled?.() ?? true);
    controlPanel.setServerPanelVisibility(
      serverUI?.isVisible?.() ?? false
    );
  } catch (err) {
    console.error("Control panel initialization failed:", err);
  }

  if (serverInitializationTask) {
    serverInitializationTask = serverInitializationTask.then((result) => {
      refreshStoredControlPanelInteractivity();
      return result;
    });
    await serverInitializationTask;
  } else {
    refreshStoredControlPanelInteractivity();
  }

  // Initialize Game
  try {
    game = await createGame("#game", opts);
    gameInitialized = true;
    refreshStoredControlPanelInteractivity();
    window.game = game;
    autoResetDelayMs = Number(
      game?.getAutoResetDelay?.() ?? AUTO_RESET_DELAY_MS
    );
    const state = game?.getState?.();
    if (state) {
      controlPanel?.setTotalTiles?.(state.grid * state.grid, { emit: false });
      controlPanel?.setMinesValue?.(state.mines, { emit: false });
    }
    const animationsEnabled = controlPanel?.getAnimationsEnabled?.();
    if (animationsEnabled != null) {
      game?.setAnimationsEnabled?.(Boolean(animationsEnabled));
    }
  } catch (e) {
    console.error("Game initialization failed:", e);
    gameInitialized = false;
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
    refreshStoredControlPanelInteractivity();
  }
})();
