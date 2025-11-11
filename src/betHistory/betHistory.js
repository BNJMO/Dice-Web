import { Container, Graphics, Text, TextStyle } from "pixi.js";
import Ease from "../ease.js";

const DEFAULT_HISTORY_CONFIG = {
  topPadding: 25,
  leftPadding: 0,
  rightPadding: 28,
  heightRatio: 0.09,
  minBubbleHeight: 26,
  maxBubbleHeight: 36,
  widthToHeightRatio: 2.0,
  spacingRatio: 0.13,
  fontSizeRatio: 0.4,
  fadeInDuration: 320,
  fadeOutDuration: 260, 
};

const DEFAULT_HISTORY_COLORS = {
  winFill: 0xf0ff31,
  winText: 0x000000,
  lossFill: 0x223845,
  lossText: 0xffffff,
};

function defaultTween(app, { duration = 300, update, complete, ease = (t) => t }) {
  if (!app?.ticker) {
    return () => {};
  }

  const start = performance.now();
  const step = () => {
    const t = Math.min(1, (performance.now() - start) / duration);
    update?.(ease(t));
    if (t >= 1) {
      app.ticker.remove(step);
      complete?.();
    }
  };
  app.ticker.add(step);
  return () => app.ticker.remove(step);
}

function normalizeColor(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }

    const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return parseInt(hex, 16);
    }

    if (trimmed.startsWith("0x") && /^[0-9a-fA-F]{8}$/.test(trimmed.slice(2))) {
      return parseInt(trimmed.slice(2), 16);
    }
  }

  return fallback;
}

function readCssColorOverrides(rootElement) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {};
  }

  const isElementType = typeof Element !== "undefined";
  const element = isElementType && rootElement instanceof Element
    ? rootElement
    : typeof rootElement === "string"
    ? document.querySelector(rootElement)
    : document.documentElement;

  if (!element) {
    return {};
  }

  const computed = getComputedStyle(element);
  return {
    winFill: normalizeColor(computed.getPropertyValue("--bet-history-win-fill")),
    winText: normalizeColor(computed.getPropertyValue("--bet-history-win-text")),
    lossFill: normalizeColor(computed.getPropertyValue("--bet-history-loss-fill")),
    lossText: normalizeColor(computed.getPropertyValue("--bet-history-loss-text")),
  };
}

export function createBetHistory({
  app,
  fontFamily = "Inter, system-ui, -apple-system, Segoe UI, Arial",
  tween = defaultTween,
  historyConfig = {},
  colorOverrides = {},
  cssRoot,
  animationsEnabled: initialAnimationsEnabled = true,
} = {}) {
  if (!app) {
    throw new Error("createBetHistory requires a PIXI application instance.");
  }

  const config = { ...DEFAULT_HISTORY_CONFIG, ...(historyConfig ?? {}) };
  const cssColors = readCssColorOverrides(cssRoot);
  const colors = {
    ...DEFAULT_HISTORY_COLORS,
    ...Object.fromEntries(
      Object.entries({ ...cssColors, ...(colorOverrides ?? {}) }).map(
        ([key, value]) => [key, normalizeColor(value, DEFAULT_HISTORY_COLORS[key])]
      )
    ),
  };

  const historyContainer = new Container();
  historyContainer.eventMode = "none";
  historyContainer.zIndex = 150;

  let entries = [];
  let bubbleHeight = config.minBubbleHeight;
  let bubbleWidth = bubbleHeight * config.widthToHeightRatio;
  let bubbleSpacing = Math.max(8, bubbleWidth * config.spacingRatio);
  let maxVisible = 1;
  const activeEntries = new Set();
  let animationsEnabled = Boolean(initialAnimationsEnabled);

  function computeMetrics() {
    const width = app.renderer.width;
    bubbleHeight = Math.max(
      config.minBubbleHeight,
      Math.min(config.maxBubbleHeight, width * config.heightRatio)
    );
    bubbleWidth = bubbleHeight * config.widthToHeightRatio;
    bubbleSpacing = Math.max(8, bubbleWidth * config.spacingRatio);

    const availableWidth = Math.max(
      bubbleWidth,
      width - (config.leftPadding + config.rightPadding)
    );

    const maxCount = Math.floor(
      (availableWidth + bubbleSpacing) / (bubbleWidth + bubbleSpacing)
    );
    maxVisible = Math.max(1, maxCount);

    historyContainer.position.set(
      width - config.rightPadding - bubbleWidth / 2,
      config.topPadding + bubbleHeight / 2
    );
  }

  function createEntry(label, isWin) {
    const container = new Container();
    container.eventMode = "none";
    container.alpha = 0;

    const background = new Graphics();
    container.addChild(background);

    const text = new Text({
      text: label,
      style: new TextStyle({
        fill: isWin ? colors.winText : colors.lossText,
        fontFamily,
        fontSize: 20,
        fontWeight: "700",
        align: "center",
      }),
    });
    text.anchor.set(0.5);
    container.addChild(text);

    const entry = {
      container,
      background,
      text,
      isWin,
      cancelTween: null,
      applySize({ width, height }) {
        const radius = height / 2;
        background.clear();
        background
          .roundRect(-width / 2, -height / 2, width, height, radius)
          .fill(isWin ? colors.winFill : colors.lossFill);
        const fontSize = Math.round(Math.max(12, height * config.fontSizeRatio));
        if (text.style.fontSize !== fontSize) {
          text.style.fontSize = fontSize;
        }
        text.style.fill = isWin ? colors.winText : colors.lossText;
      },
      setLabel(value) {
        text.text = value;
      },
      stopTween() {
        if (entry.cancelTween) {
          entry.cancelTween();
          entry.cancelTween = null;
        }
      },
    };

    activeEntries.add(entry);
    return entry;
  }

  function moveEntry(entry, targetX, { animate = true, targetAlpha = 1 } = {}) {
    const { container } = entry;
    entry.stopTween();

    const startX = container.position.x;
    const startAlpha = container.alpha;
    container.position.y = 0;

    const shouldAnimate = Boolean(animate && animationsEnabled);

    if (!shouldAnimate) {
      container.position.set(targetX, 0);
      container.alpha = targetAlpha;
      return;
    }

    entry.cancelTween = tween(app, {
      duration: config.fadeInDuration,
      ease: (t) => Ease.easeOutQuad(t),
      update: (p) => {
        container.position.x = startX + (targetX - startX) * p;
        container.position.y = 0;
        container.alpha = startAlpha + (targetAlpha - startAlpha) * p;
      },
      complete: () => {
        container.position.set(targetX, 0);
        container.alpha = targetAlpha;
        entry.cancelTween = null;
      },
    });
  }

  function removeEntry(entry, { animate = true } = {}) {
    const { container } = entry;
    entry.stopTween();

    const startX = container.position.x;
    const startAlpha = container.alpha;
    const offscreenX = -(
      maxVisible * (bubbleWidth + bubbleSpacing) + bubbleWidth + bubbleSpacing
    );

    const shouldAnimate = Boolean(animate && animationsEnabled);

    if (!shouldAnimate) {
      container.position.set(offscreenX, 0);
      container.alpha = 0;
      historyContainer.removeChild(container);
      activeEntries.delete(entry);
      return;
    }

    entry.cancelTween = tween(app, {
      duration: config.fadeOutDuration,
      ease: (t) => Ease.easeInQuad(t),
      update: (p) => {
        container.position.x = startX + (offscreenX - startX) * p;
        container.alpha = startAlpha * (1 - p);
      },
      complete: () => {
        container.alpha = 0;
        historyContainer.removeChild(container);
        activeEntries.delete(entry);
        entry.cancelTween = null;
      },
    });
  }

  function layout({ animate = false } = {}) {
    computeMetrics();

    const kept = entries.slice(0, maxVisible);
    const overflow = entries.slice(maxVisible);

    kept.forEach((entry, index) => {
      entry.applySize({ width: bubbleWidth, height: bubbleHeight });
      const targetX = -index * (bubbleWidth + bubbleSpacing);
      moveEntry(entry, targetX, {
        animate: Boolean(animate && animationsEnabled),
        targetAlpha: 1,
      });
    });

    overflow.forEach((entry) => {
      entry.applySize({ width: bubbleWidth, height: bubbleHeight });
      removeEntry(entry, { animate: Boolean(animate && animationsEnabled) });
    });

    entries = kept;
  }

  function addEntry({ label, isWin }) {
    computeMetrics();

    const safeLabel = label === null || label === undefined ? "" : `${label}`;
    const displayLabel = safeLabel === "" ? "—" : safeLabel;
    const entry = createEntry(displayLabel, isWin);
    entry.applySize({ width: bubbleWidth, height: bubbleHeight });
    entry.container.position.set(bubbleWidth + bubbleSpacing, 0);
    entry.container.alpha = 0;

    historyContainer.addChild(entry.container);
    entries = [entry, ...entries];

    moveEntry(entry, 0, {
      animate: animationsEnabled,
      targetAlpha: 1,
    });

    for (let i = 1; i < entries.length; i += 1) {
      const existing = entries[i];
      existing.applySize({ width: bubbleWidth, height: bubbleHeight });
      const targetX = -i * (bubbleWidth + bubbleSpacing);
      moveEntry(existing, targetX, {
        animate: animationsEnabled,
        targetAlpha: 1,
      });
    }

    if (entries.length > maxVisible) {
      const overflow = entries.slice(maxVisible);
      entries = entries.slice(0, maxVisible);
      overflow.forEach((item) => {
        item.applySize({ width: bubbleWidth, height: bubbleHeight });
        removeEntry(item, { animate: animationsEnabled });
      });
    }
  }

  function clear() {
    activeEntries.forEach((entry) => {
      entry.stopTween();
      historyContainer.removeChild(entry.container);
    });
    entries = [];
    activeEntries.clear();
  }

  function setAnimationsEnabled(value) {
    const normalized = Boolean(value);
    if (animationsEnabled === normalized) {
      return animationsEnabled;
    }
    animationsEnabled = normalized;
    if (!animationsEnabled) {
      activeEntries.forEach((entry) => {
        entry.stopTween();
      });
      layout({ animate: false });
    }
    return animationsEnabled;
  }

  function destroy() {
    clear();
  }

  return {
    container: historyContainer,
    addEntry,
    layout,
    clear,
    destroy,
    setAnimationsEnabled,
  };
}
