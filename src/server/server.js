import { ServerRelay } from "../serverRelay.js";
import { ServerPanel } from "./serverPanel.js";

export const DEFAULT_SERVER_URL = "https://dev.securesocket.net:8443";
export const DEFAULT_SCRATCH_GAME_ID = "CrashDice";

let sessionId = null;
let sessionGameDetails = null;
let sessionGameUrl = null;
let sessionUserToken = null;
let lastBetResult = null;
let lastBetRoundId = null;
let lastBetBalance = null;
let lastBetRegisteredBets = [];

function normalizeBaseUrl(url) {
  if (typeof url !== "string") {
    return DEFAULT_SERVER_URL;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return DEFAULT_SERVER_URL;
  }

  return trimmed.replace(/\/+$/, "");
}

function normalizeScratchGameId(id) {
  if (typeof id !== "string") {
    return DEFAULT_SCRATCH_GAME_ID;
  }

  const trimmed = id.trim();
  if (!trimmed) {
    return DEFAULT_SCRATCH_GAME_ID;
  }

  return trimmed;
}

export function getSessionId() {
  return sessionId;
}

export function getGameSessionDetails() {
  return sessionGameDetails;
}

export function getGameUrl() {
  return sessionGameUrl;
}

export function getUserToken() {
  return sessionUserToken;
}

function ensureRelay(relay) {
  if (!relay) {
    throw new Error("A ServerRelay instance is required");
  }
  if (!(relay instanceof ServerRelay)) {
    throw new Error("Server expects a ServerRelay instance");
  }
  return relay;
}

function isServerRelay(candidate) {
  return candidate instanceof ServerRelay;
}

function normalizeBetAmount(amount) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, numeric);
}

function formatBetAmountLiteral(amount) {
  const normalized = normalizeBetAmount(amount);
  const safeDecimals = 8;
  try {
    return normalized.toFixed(safeDecimals);
  } catch (error) {
    const fallback = String(normalized);
    if (/e/i.test(fallback)) {
      return Number.isFinite(normalized)
        ? normalized.toLocaleString("en-US", {
            useGrouping: false,
            minimumFractionDigits: safeDecimals,
            maximumFractionDigits: safeDecimals,
          })
        : "0.00000000";
    }
    return fallback;
  }
}

function serializeBetRequestBody({ type = "bet", amountLiteral, betInfo }) {
  const safeType = typeof type === "string" && type.length ? type : "bet";
  const literal =
    typeof amountLiteral === "string" && amountLiteral.length > 0
      ? amountLiteral
      : "0.00000000";
  const betInfoJson = JSON.stringify(betInfo ?? {});
  return `{"type":${JSON.stringify(safeType)},"amount":${literal},"betInfo":${betInfoJson}}`;
}

function normalizeBetRate(rate) {
  const numeric = Number(rate);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  return Math.max(1, Math.floor(numeric));
}

export async function initializeSessionId({
  url = DEFAULT_SERVER_URL,
  relay,
} = {}) {
  const baseUrl = normalizeBaseUrl(url);
  const endpoint = `${baseUrl}/get_session_id`;

  const requestPayload = {
    method: "GET",
    url: endpoint,
  };

  if (isServerRelay(relay)) {
    relay.send("api:get_session_id:request", requestPayload);
  }

  let response;

  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
      },
    });
  } catch (networkError) {
    if (isServerRelay(relay)) {
      relay.deliver("api:get_session_id:response", {
        ok: false,
        error: networkError?.message ?? "Network error",
        request: requestPayload,
      });
    }
    throw networkError;
  }

  const rawBody = await response.text();
  let nextSessionId = rawBody;

  const responsePayload = {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body: rawBody,
    request: requestPayload,
  };

  try {
    const parsed = JSON.parse(rawBody);
    if (typeof parsed === "string") {
      nextSessionId = parsed;
    } else if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.sessionId === "string"
    ) {
      nextSessionId = parsed.sessionId;
    }
  } catch (error) {
    // Response is not JSON; treat raw body as the session id string.
  }

  if (typeof nextSessionId !== "string" || nextSessionId.length === 0) {
    if (isServerRelay(relay)) {
      relay.deliver("api:get_session_id:response", {
        ...responsePayload,
        ok: false,
        error: "Session id response did not include a session id value",
      });
    }
    throw new Error("Session id response did not include a session id value");
  }

  if (!response.ok) {
    if (isServerRelay(relay)) {
      relay.deliver("api:get_session_id:response", {
        ...responsePayload,
        ok: false,
        error: `Failed to initialize session id: ${response.status} ${response.statusText}`,
      });
    }
    throw new Error(
      `Failed to initialize session id: ${response.status} ${response.statusText}`
    );
  }

  sessionId = nextSessionId;

  if (isServerRelay(relay)) {
    relay.deliver("api:get_session_id:response", {
      ...responsePayload,
      ok: true,
      sessionId,
    });
  }

  return sessionId;
}

export async function initializeGameSession({
  url = DEFAULT_SERVER_URL,
  scratchGameId = DEFAULT_SCRATCH_GAME_ID,
  relay,
} = {}) {
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    const error = new Error(
      "Cannot join game session before the session id is initialized"
    );
    if (isServerRelay(relay)) {
      relay.deliver("api:join:response", {
        ok: false,
        error: error.message,
      });
    }
    throw error;
  }

  const baseUrl = normalizeBaseUrl(url);
  const gameId = normalizeScratchGameId(scratchGameId);
  const endpoint = `${baseUrl}/join/${encodeURIComponent(gameId)}/`;

  sessionGameDetails = null;
  sessionGameUrl = null;
  sessionUserToken = null;

  const requestPayload = {
    method: "GET",
    url: endpoint,
    gameId,
  };

  if (isServerRelay(relay)) {
    relay.send("api:join:request", requestPayload);
  }

  let response;

  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "X-CASINOTV-TOKEN": sessionId,
        "X-CASINOTV-PROTOCOL-VERSION": "1.1",
      },
    });
  } catch (networkError) {
    if (isServerRelay(relay)) {
      relay.deliver("api:join:response", {
        ok: false,
        error: networkError?.message ?? "Network error",
        request: requestPayload,
      });
    }
    throw networkError;
  }

  const rawBody = await response.text();
  let parsedBody = null;

  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch (error) {
      // Response body was not JSON; leave parsedBody as null.
    }
  }

  const responsePayload = {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body: parsedBody ?? rawBody,
    request: requestPayload,
  };

  if (!response.ok) {
    if (isServerRelay(relay)) {
      relay.deliver("api:join:response", {
        ...responsePayload,
        ok: false,
        error: `Failed to join game session: ${response.status} ${response.statusText}`,
      });
    }
    throw new Error(
      `Failed to join game session: ${response.status} ${response.statusText}`
    );
  }

  if (!parsedBody || typeof parsedBody !== "object") {
    if (isServerRelay(relay)) {
      relay.deliver("api:join:response", {
        ...responsePayload,
        ok: false,
        error: "Join game session response was not valid JSON",
      });
    }
    throw new Error("Join game session response was not valid JSON");
  }

  const isSuccess = Boolean(parsedBody?.IsSuccess);
  const responseData = parsedBody?.ResponseData ?? null;

  if (!isSuccess || !responseData) {
    if (isServerRelay(relay)) {
      relay.deliver("api:join:response", {
        ...responsePayload,
        ok: false,
        error: "Join game session response did not indicate success",
      });
    }
    throw new Error("Join game session response did not indicate success");
  }

  const gameData = responseData?.GameData ?? null;
  const userData = responseData?.UserData ?? null;
  const userDataList = responseData?.UserDataList ?? null;
  const gameIds = Array.isArray(responseData?.GameIds)
    ? [...responseData.GameIds]
    : [];

  sessionGameDetails = {
    isSuccess,
    gameIds,
    gameData,
    userData,
    userDataList,
    raw: parsedBody,
  };

  sessionGameUrl =
    typeof gameData?.gameUrl === "string" && gameData.gameUrl
      ? gameData.gameUrl
      : null;
  sessionUserToken =
    typeof gameData?.userToken === "string" && gameData.userToken
      ? gameData.userToken
      : null;

  if (isServerRelay(relay)) {
    relay.deliver("api:join:response", {
      ...responsePayload,
      ok: true,
      gameSession: sessionGameDetails,
      gameUrl: sessionGameUrl,
      userToken: sessionUserToken,
    });
  }

  return sessionGameDetails;
}

export async function submitBet({
  url = DEFAULT_SERVER_URL,
  gameId = DEFAULT_SCRATCH_GAME_ID,
  amount = 0,
  rate = 0,
  targetMultiplier = null,
  relay,
} = {}) {
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    const error = new Error(
      "Cannot submit bet before the session id is initialized"
    );
    if (isServerRelay(relay)) {
      relay.deliver("api:bet:response", {
        ok: false,
        error: error.message,
      });
    }
    throw error;
  }

  const baseUrl = normalizeBaseUrl(url);
  const normalizedGameId = normalizeScratchGameId(gameId);
  const endpoint = `${baseUrl}/post/${encodeURIComponent(
    normalizedGameId
  )}?betInfo`;

  lastBetResult = null;
  lastBetRoundId = null;
  lastBetBalance = null;
  lastBetRegisteredBets = [];

  const normalizedAmount = normalizeBetAmount(amount);
  const normalizedRate = normalizeBetRate(rate);
  const amountLiteral = formatBetAmountLiteral(normalizedAmount);
  const normalizedTargetMultiplier = Number.isFinite(targetMultiplier)
    ? targetMultiplier
    : null;

  const betInfo = {
    id: 4,
    title: {
      key: "straight",
      value: {},
    },
    type: "straight",
    items: [],
    rate: normalizedRate,
    state: "Active",
  };

  if (normalizedTargetMultiplier !== null) {
    betInfo.targetMultiplier = normalizedTargetMultiplier;
  }

  const requestBody = {
    type: "bet",
    amount: normalizedAmount,
    betInfo,
  };

  const serializedRequestBody = serializeBetRequestBody({
    type: requestBody.type,
    amountLiteral,
    betInfo,
  });

  const requestPayload = {
    method: "POST",
    url: endpoint,
    gameId: normalizedGameId,
    body: requestBody,
    bodyLiteral: serializedRequestBody,
  };

  if (isServerRelay(relay)) {
    relay.send("api:bet:request", requestPayload);
  }

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "X-CASINOTV-TOKEN": sessionId,
        "X-CASINOTV-PROTOCOL-VERSION": "1.1",
      },
      body: serializedRequestBody,
    });
  } catch (networkError) {
    if (isServerRelay(relay)) {
      relay.deliver("api:bet:response", {
        ok: false,
        error: networkError?.message ?? "Network error",
        request: requestPayload,
      });
    }
    throw networkError;
  }

  const rawBody = await response.text();
  let parsedBody = null;

  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch (error) {
      // Response body was not JSON; leave parsedBody as null.
    }
  }

  const responsePayload = {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body: parsedBody ?? rawBody,
    request: requestPayload,
  };

  if (!response.ok) {
    if (isServerRelay(relay)) {
      relay.deliver("api:bet:response", {
        ...responsePayload,
        ok: false,
        error: `Failed to submit bet: ${response.status} ${response.statusText}`,
      });
    }
    throw new Error(
      `Failed to submit bet: ${response.status} ${response.statusText}`
    );
  }

  if (!parsedBody || typeof parsedBody !== "object") {
    if (isServerRelay(relay)) {
      relay.deliver("api:bet:response", {
        ...responsePayload,
        ok: false,
        error: "Bet response was not valid JSON",
      });
    }
    throw new Error("Bet response was not valid JSON");
  }

  const isSuccess = Boolean(parsedBody?.IsSuccess);
  const responseData = parsedBody?.ResponseData ?? null;
  const registeredBets = Array.isArray(responseData?.registeredBets)
    ? responseData.registeredBets.map((bet) => ({ ...(bet ?? {}) }))
    : [];
  const balance = responseData?.balance ?? null;
  const state = responseData?.state ?? null;
  const roundId = responseData?.roundId ?? null;

  if (!responseData) {
    if (isServerRelay(relay)) {
      relay.deliver("api:bet:response", {
        ...responsePayload,
        ok: false,
        error: "Bet response did not include response data",
      });
    }
    throw new Error("Bet response did not include response data");
  }

  lastBetResult = state ?? null;
  lastBetRoundId = roundId ?? null;
  lastBetBalance = balance ?? null;
  lastBetRegisteredBets = registeredBets;

  if (isServerRelay(relay)) {
    relay.deliver("api:bet:response", {
      ...responsePayload,
      ok: true,
      bet: {
        success: isSuccess,
        state,
        roundId,
        registeredBets,
        balance,
      },
    });
  }

  return {
    isSuccess,
    responseData,
    state,
    roundId,
    registeredBets,
    balance,
    raw: parsedBody,
  };
}

export async function initializeServerConnection({
  relay,
  url = DEFAULT_SERVER_URL,
  scratchGameId = DEFAULT_SCRATCH_GAME_ID,
} = {}) {
  const serverRelay = ensureRelay(relay);
  const gameSessionId = await initializeSessionId({ url, relay: serverRelay });
  const gameSession = await initializeGameSession({
    url,
    scratchGameId,
    relay: serverRelay,
  });

  return {
    sessionId: gameSessionId,
    gameSession,
    gameUrl: getGameUrl(),
    userToken: getUserToken(),
  };
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
    serverUrl = DEFAULT_SERVER_URL,
    scratchGameId = DEFAULT_SCRATCH_GAME_ID,
    autoInitialize = true,
  } = options;

  const serverPanel = new ServerPanel({
    mount,
    initialDemoMode: Boolean(initialDemoMode),
    initialCollapsed: Boolean(initialCollapsed),
    initialHidden: Boolean(initialHidden),
    onDemoModeToggle,
    onVisibilityChange,
  });

  serverRelay.addEventListener("demomodechange", (event) => {
    serverPanel.setDemoMode(Boolean(event.detail?.value));
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

  const initializationPromise = autoInitialize
    ? initializeServerConnection({
        relay: serverRelay,
        url: serverUrl,
        scratchGameId,
      }).catch((error) => {
        console.error("Server initialization failed", error);
        throw error;
      })
    : null;

  return {
    element: serverPanel.container,
    setDemoMode: (enabled) => serverPanel.setDemoMode(enabled),
    show: () => serverPanel.show(),
    hide: () => serverPanel.hide(),
    isVisible: () => serverPanel.isVisible(),
    initialize: () =>
      initializeServerConnection({
        relay: serverRelay,
        url: serverUrl,
        scratchGameId,
      }),
    initialization: initializationPromise,
    destroy() {
      serverRelay.removeEventListener("outgoing", outgoingHandler);
      serverRelay.removeEventListener("incoming", incomingHandler);
      serverPanel.destroy();
    },
  };
}
