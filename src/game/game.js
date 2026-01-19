import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
  Texture,
  Rectangle,
  AnimatedSprite,
  Assets,
  Sprite,
} from "pixi.js";

import Ease from "../ease.js";
import { createBetHistory } from "../betHistory/betHistory.js";
import { createBottomGamePanel } from "../bottomGamePanel/bottomGamePanel.js";
import winSoundUrl from "../../assets/sounds/Win.wav";
import loseSoundUrl from "../../assets/sounds/Lost.wav";
import diceRollSoundUrl from "../../assets/sounds/DiceRoll.wav";
import sliderDownSoundUrl from "../../assets/sounds/SliderDown.wav";
import sliderUpSoundUrl from "../../assets/sounds/SliderUp.wav";
import sliderDragSoundUrl from "../../assets/sounds/SliderDrag.wav";
import toggleRollModeSoundUrl from "../../assets/sounds/ToggleRollMode.wav";
import sliderBackgroundUrl from "../../assets/sprites/SliderBackground.svg";
import sliderHandleUrl from "../../assets/sprites/SliderHandle.svg";
import diceSpriteUrl from "../../assets/sprites/Dice.svg";

const PALETTE = {
  appBg: 0x020401,
  winPopupBorder: 0xeaff00,
  winPopupBackground: 0x0f0f0f,
  winPopupMultiplierText: 0xeaff00,
};

const SLIDER = {
  minValue: 2,
  maxValue: 98,
  rangeMin: 0,
  rangeMax: 100,
  step: 1,
  leftColor: 0xf40029,
  rightColor: 0xf0ff31,
  trackHeightRatio: 0.15,
  trackPaddingRatio: 0.035,
  trackOffsetRatio: 0.05,
  // Adjusts how closely the track follows the segmented background stretch.
  // 1 keeps the previous behaviour, 0 locks the track to its base width.
  trackWidthCompensationStrength: 0.5,
  handleOffsetRatio: 0.06,
  // Shifts the entire slider (background, track, handle, dice) vertically.
  containerOffsetRatio: -0.45,
  tickEdgePaddingRatio: -6,
  tickPadding: -28,
  tickTextSizeRatio: 0.27,
  backgroundOffsetRatio: 0,
};

const SLIDER_BACKGROUND_FIXED_SEGMENTS = [
  { start: 0, end: 0.05 },
  { start: 0.262, end: 0.281 },
  { start: 0.489, end: 0.508 },
  { start: 0.717, end: 0.736 },
  { start: 0.945, end: 1 },
];

const DICE_ANIMATION = {
  fadeInDuration: 400,
  fadeOutDuration: 400,
  fadeOutDelay: 4000,
  fadeInScaleStart: 0.7,
  fadeOutScaleEnd: 0.7,
  bumpScale: 1.2,
  bumpDuration: 300,
};

const SOUND_ALIASES = {
  win: "game.win",
  lose: "game.lose",
  diceRoll: "game.diceRoll",
  sliderDown: "game.sliderDown",
  sliderUp: "game.sliderUp",
  sliderDrag: "game.sliderDrag",
  rollModeToggle: "game.rollModeToggle",
};

const DICE_LABEL_COLORS = {
  default: 0x0b212b,
  win: 0xf0ff31,
  loss: 0xf40029,
};

const DICE_LABEL_SHADOW_COLORS = {
  default: 0xcfd9eb,
  target: 0x000000,
};

const MAX_RENDERER_RESOLUTION = 3;

function numberToHexColorString(value) {
  const normalized = ((value ?? 0) >>> 0) & 0xffffff;
  return `#${normalized.toString(16).padStart(6, "0")}`;
}

function tween(app, { duration = 300, update, complete, ease = (t) => t }) {
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

function getRendererResolution() {
  if (typeof window === "undefined") {
    return 1;
  }

  const dpr = window.devicePixelRatio ?? 1;
  return Math.max(1, dpr);
}

function createDevicePixelRatioWatcher(callback) {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => {};
  }

  let mediaQuery = null;

  const handleChange = () => {
    callback();
    setupWatcher();
  };

  const setupWatcher = () => {
    if (mediaQuery) {
      mediaQuery.removeEventListener("change", handleChange);
    }

    const dpr = window.devicePixelRatio ?? 1;
    mediaQuery = window.matchMedia(`(resolution: ${dpr}dppx)`);
    mediaQuery.addEventListener("change", handleChange);
  };

  setupWatcher();

  return () => {
    mediaQuery?.removeEventListener("change", handleChange);
  };
}

function lerpColor(from, to, t) {
  const clampT = Math.max(0, Math.min(1, t));
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  const r = Math.round(fr + (tr - fr) * clampT);
  const g = Math.round(fg + (tg - fg) * clampT);
  const b = Math.round(fb + (tb - fb) * clampT);
  return (r << 16) | (g << 8) | b;
}

const VECTOR_TEXTURE_PATTERN = /\.svg(?:[#?].*)?$/i;

function normalizeTextureResolution(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(1, Math.min(value, MAX_RENDERER_RESOLUTION));
}

export async function loadTexture(path, { resolution } = {}) {
  if (!path) return null;

  const isVectorTexture =
    typeof path === "string" && VECTOR_TEXTURE_PATTERN.test(path);

  const desiredResolution = normalizeTextureResolution(
    isVectorTexture ? resolution ?? MAX_RENDERER_RESOLUTION : resolution
  );

  if (desiredResolution) {
    return Assets.load({
      src: path,
      data: { resolution: desiredResolution },
    });
  }

  return Assets.load(path);
}

export async function loadSpritesheetFrames(path, { cols = 1, rows = 1 } = {}) {
  if (!path) {
    return { frames: [], frameWidth: 0, frameHeight: 0 };
  }

  const baseTexture = await Assets.load(path);
  const sheetW = baseTexture.width;
  const sheetH = baseTexture.height;

  const frameWidth = cols > 0 ? Math.floor(sheetW / cols) : sheetW;
  const frameHeight = rows > 0 ? Math.floor(sheetH / rows) : sheetH;

  const frames = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rect = new Rectangle(
        c * frameWidth,
        r * frameHeight,
        frameWidth,
        frameHeight
      );
      frames.push(new Texture({ source: baseTexture.source, frame: rect }));
    }
  }

  return { frames, frameWidth, frameHeight };
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function createSegmentedSliderBackground(texture, { ranges = [] } = {}) {
  if (!texture) {
    return null;
  }

  const baseWidth = Math.max(1, texture.width ?? texture.orig?.width ?? 0);
  const baseHeight = Math.max(1, texture.height ?? texture.orig?.height ?? 0);
  const source =
    texture.source ??
    texture.baseTexture?.source ??
    texture.baseTexture?.resource?.source ??
    texture.baseTexture;

  if (!source || baseWidth <= 0 || baseHeight <= 0) {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    return {
      container: sprite,
      baseWidth,
      baseHeight,
      updateScale: () => {},
    };
  }

  const normalizedRanges = ranges
    .map(({ start, end }) => ({
      start: clamp01(start),
      end: clamp01(end),
    }))
    .filter(({ start, end }) => end > start)
    .sort((a, b) => a.start - b.start);

  const segmentsConfig = [];
  let cursor = 0;
  normalizedRanges.forEach(({ start, end }) => {
    const startClamped = Math.max(cursor, start);
    if (startClamped > cursor) {
      segmentsConfig.push({ start: cursor, end: startClamped, stretch: true });
    }
    const endClamped = Math.max(startClamped, end);
    segmentsConfig.push({
      start: startClamped,
      end: endClamped,
      stretch: false,
    });
    cursor = Math.max(cursor, endClamped);
  });

  if (cursor < 1) {
    segmentsConfig.push({ start: cursor, end: 1, stretch: true });
  }

  const container = new Container();
  container.eventMode = "none";
  container.pivot.set(baseWidth / 2, baseHeight / 2);
  container.position.set(0, baseHeight / 2);

  const segments = [];
  let positionX = 0;

  segmentsConfig.forEach(({ start, end, stretch }) => {
    const width = Math.max(0, end - start) * baseWidth;
    if (width <= 0) {
      return;
    }

    const frame = new Rectangle(start * baseWidth, 0, width, baseHeight);
    const segmentTexture = new Texture({ source, frame });
    const sprite = new Sprite(segmentTexture);
    sprite.pivot.set(0, baseHeight / 2);
    sprite.position.set(positionX, 0);
    container.addChild(sprite);
    segments.push({ sprite, width, stretch });
    positionX += width;
  });

  const totalWidth = segments.reduce((sum, segment) => sum + segment.width, 0);
  const preservedTotal = segments
    .filter((segment) => !segment.stretch)
    .reduce((sum, segment) => sum + segment.width, 0);
  const stretchTotal = Math.max(0, totalWidth - preservedTotal);

  const updateScale = (scaleX) => {
    const safeScale = scaleX > 0 ? scaleX : 1;
    const targetWidth = totalWidth * safeScale;
    const stretchTarget = Math.max(0, targetWidth - preservedTotal);
    const stretchFactor =
      stretchTotal > 0 ? stretchTarget / stretchTotal : safeScale;
    const preservedScale = 1 / safeScale;
    const stretchScale =
      stretchTotal > 0 ? stretchFactor / safeScale : 1 / safeScale;

    let currentX = 0;
    segments.forEach((segment) => {
      const segmentScale = segment.stretch ? stretchScale : preservedScale;
      segment.sprite.scale.x = segmentScale;
      segment.sprite.position.x = currentX;
      currentX += segment.width * segmentScale;
    });

    return {
      totalScale: safeScale,
      stretchScale: stretchFactor,
    };
  };

  return { container, baseWidth: totalWidth, baseHeight, updateScale };
}

export function createAnimatedSpriteFromFrames(
  frames,
  { fps = 24, loop = true, anchor = 0.5, alpha = 1 } = {}
) {
  const animation = new AnimatedSprite(frames);
  animation.loop = loop;
  animation.animationSpeed = fps / 60;
  if (Array.isArray(anchor)) {
    animation.anchor.set(anchor[0] ?? 0.5, anchor[1] ?? anchor[0] ?? 0.5);
  } else {
    animation.anchor.set(anchor);
  }
  animation.alpha = alpha;
  return animation;
}

export async function createGame(mount, opts = {}) {
  let sound;
  try {
    const soundModule = await import("@pixi/sound");
    sound = soundModule.sound;
    if (sound && "disableAutoPause" in sound) {
      sound.disableAutoPause = true;
    }
  } catch (e) {
    console.warn("Sounds disabled:", e.message);
    sound = {
      add: (alias, options) => {
        if (options && options.loaded) {
          setTimeout(() => options.loaded(), 0);
        }
      },
      play: () => {},
      stop: () => {},
      exists: () => false,
    };
  }

  // Options
  /* App */
  const fontFamily =
    opts.fontFamily ?? "Inter, system-ui, -apple-system, Segoe UI, Arial";
  const initialSize = Math.max(1, opts.size ?? 400);
  const backgroundColor = opts.backgroundColor ?? PALETTE.appBg;
  const backgroundTexturePath = opts.backgroundTexturePath ?? null;

  /* Sounds */
  const winSoundPath = opts.winSoundPath ?? winSoundUrl;
  const loseSoundPath = opts.loseSoundPath ?? loseSoundUrl;
  const diceRollSoundPath = opts.diceRollSoundPath ?? diceRollSoundUrl;
  const sliderDownSoundPath = opts.sliderDownSoundPath ?? sliderDownSoundUrl;
  const sliderUpSoundPath = opts.sliderUpSoundPath ?? sliderUpSoundUrl;
  const sliderDragSoundPath = opts.sliderDragSoundPath ?? sliderDragSoundUrl;
  const toggleRollModeSoundPath =
    opts.toggleRollModeSoundPath ?? toggleRollModeSoundUrl;
  const sliderDragMinPitch = Math.max(0.01, opts.sliderDragMinPitch ?? 0.9);
  const sliderDragMaxPitch = Math.max(
    sliderDragMinPitch,
    opts.sliderDragMaxPitch ?? 1.4
  );
  const sliderDragCooldownMs = Math.max(
    0,
    (opts.sliderDragCooldown ?? 0.05) * 1000
  );
  const sliderContainerOffsetRatio = Number.isFinite(
    opts.sliderContainerOffsetRatio
  )
    ? opts.sliderContainerOffsetRatio
    : SLIDER.containerOffsetRatio;
  const sliderSoundConfig = {
    dragMinPitch: sliderDragMinPitch,
    dragMaxPitch: sliderDragMaxPitch,
    dragMaxSpeed: Math.max(0.01, opts.sliderDragMaxSpeed ?? 1.5),
    dragCooldownMs: sliderDragCooldownMs,
  };

  let animationsEnabled = !(opts.disableAnimations ?? false);

  const diceFadeInDuration = Math.max(
    0,
    opts.diceFadeInDuration ?? DICE_ANIMATION.fadeInDuration
  );
  const diceFadeOutDuration = Math.max(
    0,
    opts.diceFadeOutDuration ?? DICE_ANIMATION.fadeOutDuration
  );
  const diceFadeOutDelay = Math.max(
    0,
    opts.diceFadeOutDelay ?? DICE_ANIMATION.fadeOutDelay
  );
  const clampScaleOption = (value, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.max(0, numeric);
  };
  const diceFadeInScaleStart = clampScaleOption(
    opts.diceFadeInScaleStart,
    DICE_ANIMATION.fadeInScaleStart
  );
  const diceFadeOutScaleEnd = clampScaleOption(
    opts.diceFadeOutScaleEnd,
    DICE_ANIMATION.fadeOutScaleEnd
  );
  const diceBumpScale = clampScaleOption(
    opts.diceBumpScale,
    DICE_ANIMATION.bumpScale
  );
  const diceBumpDuration = Math.max(
    0,
    opts.diceBumpDuration ?? DICE_ANIMATION.bumpDuration
  );

  /* Win Popup*/
  const winPopupShowDuration = opts.winPopupShowDuration ?? 260;
  const winPopupWidth = opts.winPopupWidth ?? 240;
  const winPopupHeight = opts.winPopupHeight ?? 170;

  const soundEffectPaths = {
    win: winSoundPath,
    lose: loseSoundPath,
    diceRoll: diceRollSoundPath,
    sliderDown: sliderDownSoundPath,
    sliderUp: sliderUpSoundPath,
    sliderDrag: sliderDragSoundPath,
    rollModeToggle: toggleRollModeSoundPath,
  };

  const enabledSoundKeys = new Set(
    Object.entries(soundEffectPaths)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key)
  );

  const root =
    typeof mount === "string" ? document.querySelector(mount) : mount;
  if (!root) throw new Error("createGame: mount element not found");
  const appContainerElement = root.closest?.(".app-container") ?? null;

  root.style.position = root.style.position || "relative";
  root.style.aspectRatio = root.style.aspectRatio || "1 / 1";
  if (!root.style.width && !root.style.height) {
    root.style.width = "100%";
  }
  if (!root.style.maxWidth) {
    root.style.maxWidth = "100%";
  }

  function measureRootSize() {
    const rect = root.getBoundingClientRect();
    const width = Math.max(1, rect.width || root.clientWidth || initialSize);
    const height = Math.max(1, rect.height || root.clientHeight || width);
    return { width, height };
  }

  let removeWindowResizeListener = () => {};
  let stopDevicePixelRatioWatcher = () => {};

  let backgroundTexture = null;
  if (backgroundTexturePath) {
    try {
      backgroundTexture = await loadTexture(backgroundTexturePath);
    } catch (e) {
      console.warn("Failed to load background texture", e);
    }
  }

  let sliderBackgroundTexture = null;
  let sliderHandleTexture = null;
  let diceTexture = null;
  try {
    sliderBackgroundTexture = await loadTexture(sliderBackgroundUrl);
  } catch (e) {
    console.warn("Failed to load slider background", e);
  }

  try {
    sliderHandleTexture = await loadTexture(sliderHandleUrl);
  } catch (e) {
    console.warn("Failed to load slider handle", e);
  }

  try {
    diceTexture = await loadTexture(diceSpriteUrl);
  } catch (e) {
    console.warn("Failed to load dice sprite", e);
  }

  try {
    await loadSoundEffects();
  } catch (e) {
    console.warn("loadSoundEffects failed (non-fatal)", e);
  }

  let rendererResolution = getRendererResolution();
  const app = new Application();
  try {
    const { width: startWidth, height: startHeight } = measureRootSize();
    await app.init({
      background: backgroundColor,
      width: startWidth,
      height: startHeight,
      antialias: true,
      resolution: rendererResolution,
    });

    root.innerHTML = "";
    root.appendChild(app.canvas);
  } catch (e) {
    console.error("PIXI init failed", e);
    throw e;
  }

  const scene = new Container();
  const ui = new Container();
  app.stage.addChild(scene, ui);
  app.stage.eventMode = "static";
  app.stage.hitArea = new Rectangle(
    0,
    0,
    app.renderer.width,
    app.renderer.height
  );

  const backgroundLayer = new Container();
  scene.addChild(backgroundLayer);

  let backgroundSprite = null;
  if (backgroundTexture) {
    backgroundSprite = new Sprite(backgroundTexture);
    backgroundSprite.anchor.set(0.5);
    backgroundLayer.addChild(backgroundSprite);
  }

  const backgroundGraphic = new Graphics();
  backgroundLayer.addChild(backgroundGraphic);

  const winPopup = createWinPopup();
  ui.addChild(winPopup.container);

  const betHistory = createBetHistory({
    app,
    fontFamily,
    tween,
    animationsEnabled,
  });
  ui.addChild(betHistory.container);

  // API callbacks
  const onWin = opts.onWin ?? (() => {});
  const onLost = opts.onLost ?? (() => {});
  const onStateChange = opts.onChange ?? (() => {});
  const onSliderValueChange = opts.onSliderValueChange ?? (() => {});
  const onRollModeChangeCallback = opts.onRollModeChange ?? (() => {});

  let handleSliderChange = () => {};

  let panelResizeObserver = null;
  let bottomPanelUi = null;

  const sliderUi = createSliderUi({
    textures: {
      background: sliderBackgroundTexture,
      handle: sliderHandleTexture,
      dice: diceTexture,
    },
    soundConfig: sliderSoundConfig,
    onRelease: (details) => {
      try {
        onSliderValueChange(details);
      } catch (err) {
        console.warn("onSliderValueChange callback failed", err);
      }
    },
    onChange: (details) => handleSliderChange(details),
    getBottomPanelHeight: () =>
      bottomPanelUi?.getScaledHeight?.() ??
      bottomPanelUi?.panel?.offsetHeight ??
      0,
    onRollModeChange: (mode) => {
      try {
        onRollModeChangeCallback(mode);
      } catch (err) {
        console.warn("onRollModeChange callback failed", err);
      }
    },
    animationsEnabled,
    appContainer: appContainerElement,
    containerOffsetRatio: sliderContainerOffsetRatio,
  });
  ui.addChild(sliderUi.container);
  betHistory.layout({ animate: false });

  bottomPanelUi = createBottomGamePanel({
    app,
    root,
    appContainerElement,
    sliderUi,
    onSliderValueChange,
    setHandleSliderChange: (handler) => {
      handleSliderChange = handler;
    },
  });
  if (bottomPanelUi?.panel) {
    try {
      panelResizeObserver = new ResizeObserver(() => {
        bottomPanelUi.layout?.();
        sliderUi.layout();
      });
      panelResizeObserver.observe(bottomPanelUi.panel);
    } catch (err) {
      console.warn("Bottom panel ResizeObserver failed", err);
    }
  }
  bottomPanelUi?.layout?.();
  sliderUi.layout();

  function createWinPopup() {
    const popupWidth = winPopupWidth;
    const popupHeight = winPopupHeight;

    const container = new Container();
    container.visible = false;
    container.scale.set(0);
    container.eventMode = "none";
    container.zIndex = 1000;

    const border = new Graphics();
    border
      .roundRect(
        -popupWidth / 2 - 10,
        -popupHeight / 2 - 10,
        popupWidth + 20,
        popupHeight + 20,
        32
      )
      .fill(PALETTE.winPopupBorder);

    const inner = new Graphics();
    inner
      .roundRect(-popupWidth / 2, -popupHeight / 2, popupWidth, popupHeight, 28)
      .fill(PALETTE.winPopupBackground);

    const multiplierVerticalOffset = -popupHeight / 2 + popupHeight * 0.28;
    const amountRowVerticalOffset = popupHeight / 2 - popupHeight * 0.25;

    const centerLine = new Graphics();
    const centerLinePadding = 70;
    const centerLineWidth = popupWidth - centerLinePadding * 2;
    const centerLineThickness = 5;
    centerLine
      .rect(
        -centerLineWidth / 2,
        -centerLineThickness / 2,
        centerLineWidth,
        centerLineThickness
      )
      .fill(0x323232);

    const multiplierText = new Text({
      text: "1.00×",
      style: new TextStyle({
        fill: PALETTE.winPopupMultiplierText,
        fontFamily,
        fontSize: 36,
        fontWeight: "700",
        align: "center",
      }),
    });
    multiplierText.anchor.set(0.5);
    multiplierText.position.set(0, multiplierVerticalOffset);

    const amountRow = new Container();

    const amountText = new Text({
      text: "0.0",
      style: new TextStyle({
        fill: 0xffffff,
        fontFamily,
        fontSize: 24,
        fontWeight: "600",
        align: "center",
      }),
    });
    amountText.anchor.set(0.5);
    amountRow.addChild(amountText);

    const coinContainer = new Container();
    const coinRadius = 16;
    const coinBg = new Graphics();
    coinBg.circle(0, 0, coinRadius).fill(0xf6a821);
    const coinText = new Text({
      text: "₿",
      style: new TextStyle({
        fill: 0xffffff,
        fontFamily,
        fontSize: 18,
        fontWeight: "700",
        align: "center",
      }),
    });
    coinText.anchor.set(0.5);
    coinContainer.addChild(coinBg, coinText);
    amountRow.addChild(coinContainer);

    const layoutAmountRow = () => {
      const spacing = 20;
      const coinDiameter = coinRadius * 2;
      const totalWidth = amountText.width + spacing + coinDiameter;

      amountText.position.set(-(spacing / 2 + coinRadius), 0);
      coinContainer.position.set(totalWidth / 2 - coinRadius, 0);

      amountRow.position.set(0, amountRowVerticalOffset);
    };

    layoutAmountRow();

    container.addChild(border, inner, centerLine, multiplierText, amountRow);

    return {
      container,
      multiplierText,
      amountText,
      layoutAmountRow,
    };
  }

  function createSliderUi({
    textures = {},
    soundConfig = {},
    onRelease = () => {},
    onChange = () => {},
    getBottomPanelHeight = () => 0,
    onRollModeChange = () => {},
    animationsEnabled: initialAnimationsEnabled = true,
    appContainer = null,
    containerOffsetRatio: overrideContainerOffsetRatio = null,
  } = {}) {
    const {
      dragMinPitch = 0.9,
      dragMaxPitch = 1.4,
      dragMaxSpeed = 0.8,
      dragCooldownMs = 200,
    } = soundConfig ?? {};
    const sliderContainer = new Container();
    sliderContainer.sortableChildren = true;
    sliderContainer.eventMode = "static";
    sliderContainer.cursor = "pointer";
    sliderContainer.zIndex = 100;

    let animationsEnabled = Boolean(initialAnimationsEnabled);
    const appContainerElement = appContainer ?? null;
    const portraitMediaQuery =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(max-width: 768px), (orientation: portrait)")
        : null;
    let removePortraitModeWatcher = () => {};

    const fallbackWidth = 560;
    const fallbackHeight = 140;

    let baseWidth = fallbackWidth;
    let baseHeight = fallbackHeight;
    const trackOffsetRatio = Number.isFinite(SLIDER.trackOffsetRatio)
      ? SLIDER.trackOffsetRatio
      : 0;
    const handleOffsetRatio = Number.isFinite(SLIDER.handleOffsetRatio)
      ? SLIDER.handleOffsetRatio
      : 0;
    const trackPaddingRatio = Number.isFinite(SLIDER.trackPaddingRatio)
      ? SLIDER.trackPaddingRatio
      : 0;
    const trackHeightRatio = Number.isFinite(SLIDER.trackHeightRatio)
      ? SLIDER.trackHeightRatio
      : 0;
    const containerOffsetRatio = Number.isFinite(overrideContainerOffsetRatio)
      ? overrideContainerOffsetRatio
      : Number.isFinite(SLIDER.containerOffsetRatio)
      ? SLIDER.containerOffsetRatio
      : 0;
    const backgroundOffsetRatio = Number.isFinite(SLIDER.backgroundOffsetRatio)
      ? SLIDER.backgroundOffsetRatio
      : 0;

    let background;
    let updateBackgroundScale;
    if (textures.background) {
      const segmented = createSegmentedSliderBackground(textures.background, {
        ranges: SLIDER_BACKGROUND_FIXED_SEGMENTS,
      });
      background = segmented?.container ?? new Sprite(textures.background);
      updateBackgroundScale = segmented?.updateScale;
      baseWidth =
        segmented?.baseWidth ??
        textures.background.width ??
        background.width ??
        fallbackWidth;
      baseHeight =
        segmented?.baseHeight ??
        textures.background.height ??
        background.height ??
        fallbackHeight;
    } else {
      background = new Graphics();
      background
        .roundRect(
          -fallbackWidth / 2,
          -fallbackHeight / 2,
          fallbackWidth,
          fallbackHeight,
          fallbackHeight / 2
        )
        .fill(0x1b1b1b);
      baseWidth = fallbackWidth;
      baseHeight = fallbackHeight;
    }
    background.eventMode = "none";
    if (background.anchor && typeof background.anchor.set === "function") {
      background.anchor.set(0.5);
    }
    if (backgroundOffsetRatio !== 0) {
      background.position.y += baseHeight * backgroundOffsetRatio;
    }
    sliderContainer.addChild(background);

    const trackCenterY = baseHeight * trackOffsetRatio;
    const handleOffsetY = baseHeight * handleOffsetRatio;
    const trackPadding = Math.max(12, baseWidth * trackPaddingRatio);
    const trackLength = Math.max(1, baseWidth - trackPadding * 2);
    const trackStart = -trackLength / 2;
    const trackEnd = trackLength / 2;
    const tickEdgePadding = Math.min(trackPadding, SLIDER.tickEdgePaddingRatio);
    const barHeight = Math.max(10, baseHeight * trackHeightRatio);
    const barRadius = barHeight / 2;

    const trackBar = new Graphics();
    trackBar.zIndex = 5;
    trackBar.eventMode = "none";
    sliderContainer.addChild(trackBar);

    const tickContainer = new Container();
    tickContainer.zIndex = 6;
    sliderContainer.addChild(tickContainer);

    const tickValues = [0, 25, 50, 75, 100];
    const tickItems = tickValues.map((value) => {
      const item = new Container();
      item.eventMode = "none";
      const label = new Text({
        text: `${value}`,
        style: new TextStyle({
          fill: 0xffffff,
          fontFamily,
          fontSize: Math.max(14, baseHeight * SLIDER.tickTextSizeRatio),
          fontWeight: "600",
          align: "center",
        }),
      });
      label.anchor.set(0.5, 1);
      label.position.set(0, SLIDER.tickPadding);

      item.addChild(label);
      tickContainer.addChild(item);

      return {
        container: item,
        label,
        value,
        labelBaseScaleX: label.scale.x ?? 1,
        labelBaseScaleY: label.scale.y ?? 1,
      };
    });

    const DICE_PORTRAIT_SCALE = 0.85;
    const DICE_ORIENTATION_EPSILON = 0.0001;
    let trackScaleFactor = 1;
    let sliderWidthScale = 1;
    let diceScaleValue = 1;
    let diceOrientationScale = 1;
    const scalePosition = (position) => position * trackScaleFactor;
    const unscalePosition = (position) =>
      trackScaleFactor !== 0 ? position / trackScaleFactor : position;

    const handles = [];
    let handleBaseScaleX = 1;
    let handleBaseScaleY = 1;

    function createHandleSprite() {
      let handle;
      if (textures.handle) {
        handle = new Sprite(textures.handle);
        handle.anchor.set(0.5);
      } else {
        const handleWidth = barHeight * 1.2;
        const handleHeight = barHeight * 1.6;
        const fallbackHandle = new Graphics();
        fallbackHandle
          .roundRect(
            -handleWidth / 2,
            -handleHeight / 2,
            handleWidth,
            handleHeight,
            handleWidth / 4
          )
          .fill(0x6d5eff);
        handle = fallbackHandle;
      }
      handle.zIndex = 20;
      handle.eventMode = "static";
      handle.cursor = "pointer";
      return handle;
    }

    for (let i = 0; i < 4; i += 1) {
      const handle = createHandleSprite();
      sliderContainer.addChild(handle);
      handles.push(handle);
      if (i === 0) {
        handleBaseScaleX = handle.scale.x ?? 1;
        handleBaseScaleY = handle.scale.y ?? 1;
      }
    }

    const diceContainer = new Container();
    diceContainer.zIndex = 40;
    diceContainer.visible = false;
    diceContainer.alpha = 0;
    diceContainer.eventMode = "none";
    sliderContainer.addChild(diceContainer);

    let diceSprite;
    let diceSpriteHeight;
    if (textures.dice) {
      diceSprite = new Sprite(textures.dice);
      diceSprite.anchor.set(0.5, 1);
      diceSpriteHeight =
        textures.dice.height ?? diceSprite.height ?? barHeight * 2.4;
    } else {
      const size = barHeight * 2.8;
      const fallbackDice = new Graphics();
      fallbackDice
        .roundRect(-size / 2, -size, size, size, size * 0.18)
        .fill(0xc5d4e5);
      diceSprite = fallbackDice;
      diceSpriteHeight = size;
    }
    diceSprite.eventMode = "none";
    diceContainer.addChild(diceSprite);

    const diceLabel = new Text({
      text: "",
      style: new TextStyle({
        fill: DICE_LABEL_COLORS.default,
        fontFamily,
        fontSize: Math.max(18, baseHeight * 0.33),
        fontWeight: "700",
        align: "center",
        dropShadow: {
          alpha: 1,
          blur: 1,
          distance: 2.0,
          angle: Math.PI / 2,
          color: numberToHexColorString(DICE_LABEL_SHADOW_COLORS.default),
        },
      }),
    });
    diceLabel.anchor.set(0.5);
    const labelOffset = diceSpriteHeight * 0.55;
    diceLabel.position.set(0, -labelOffset);
    diceContainer.addChild(diceLabel);

    const diceBottomGap = Math.max(10, barHeight * 0.25);
    diceContainer.position.y = trackCenterY - barHeight / 2 - diceBottomGap;

    const sliderRange = Math.max(1e-4, SLIDER.rangeMax - SLIDER.rangeMin);
    const sliderTrackLength = trackEnd - trackStart;

    const precision = SLIDER.step > 0 ? Math.round(1 / SLIDER.step) : 0;
    const defaultRollMode = "inside";
    const defaultInsideOutsideValues = [
      Math.min(SLIDER.maxValue, Math.max(SLIDER.minValue, 25)),
      Math.min(SLIDER.maxValue, Math.max(SLIDER.minValue, 75)),
      Math.min(SLIDER.maxValue, Math.max(SLIDER.minValue, 62.5)),
      Math.min(SLIDER.maxValue, Math.max(SLIDER.minValue, 87.5)),
    ];
    const defaultBetweenValues = [
      Math.min(SLIDER.maxValue, Math.max(SLIDER.minValue, 25)),
      Math.min(SLIDER.maxValue, Math.max(SLIDER.minValue, 50)),
      Math.min(SLIDER.maxValue, Math.max(SLIDER.minValue, 62.5)),
      Math.min(SLIDER.maxValue, Math.max(SLIDER.minValue, 87.5)),
    ];
    let sliderValues = getDefaultValuesForMode(defaultRollMode);
    let sliderDragging = false;
    let activeHandleIndex = null;
    let rollMode = defaultRollMode;
    let diceHasShown = false;
    let diceAnimationCancel = null;
    let diceFadeOutCancel = null;
    let diceFadeTimeoutId = null;
    let diceBumpCancel = null;
    let diceLabelColorCancel = null;
    let diceLabelShadowColor = DICE_LABEL_SHADOW_COLORS.default;
    let diceLastOutcome = null;
    let lastHandlePositions = sliderValues.map((value) =>
      valueToPosition(value)
    );
    let lastHandleUpdateTime = performance.now();
    let lastSliderDragSoundTime = -Infinity;

    function getChangeDetails() {
      return {
        values: getOrderedValues(getActiveValues()),
        rollMode,
        winChance: getWinChance(),
        multiplier: getMultiplier(),
      };
    }

    function emitSliderChange() {
      try {
        onChange(getChangeDetails());
      } catch (err) {
        console.warn("Slider change callback failed", err);
      }
    }

    function emitRollModeChange() {
      try {
        onRollModeChange(rollMode);
      } catch (err) {
        console.warn("Roll mode change callback failed", err);
      }
    }

    function clampRange(value) {
      return Math.min(SLIDER.rangeMax, Math.max(SLIDER.rangeMin, value));
    }

    function clampBounds(value) {
      return Math.min(SLIDER.maxValue, Math.max(SLIDER.minValue, value));
    }

    function snapValue(value) {
      if (!precision) return value;
      return Math.round(value * precision) / precision;
    }

    function normalizeRollMode(mode) {
      if (mode === "outside") return "outside";
      if (mode === "between") return "between";
      return "inside";
    }

    function getActiveHandleCount() {
      return rollMode === "between" ? 4 : 2;
    }

    function getActiveValues() {
      return sliderValues.slice(0, getActiveHandleCount());
    }

    function getDefaultValuesForMode(mode) {
      return mode === "between"
        ? [...defaultBetweenValues]
        : [...defaultInsideOutsideValues];
    }

    function getOrderedValues(values) {
      const sorted = [...values].map((value) => clampBounds(value));
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i] < sorted[i - 1]) {
          sorted[i] = sorted[i - 1];
        }
      }
      for (let i = sorted.length - 2; i >= 0; i -= 1) {
        if (sorted[i] > sorted[i + 1]) {
          sorted[i] = sorted[i + 1];
        }
      }
      return sorted;
    }

    function valueToPosition(value) {
      const ratio = (clampRange(value) - SLIDER.rangeMin) / sliderRange;
      return trackStart + ratio * sliderTrackLength;
    }

    function positionToValue(position) {
      const ratio = (position - trackStart) / sliderTrackLength;
      return clampRange(SLIDER.rangeMin + ratio * sliderRange);
    }

    function updateTickLayout() {
      const labelOffset = Math.max(12, barHeight * 0.45);
      tickItems.forEach(({ container, value }) => {
        const ratio = (clampRange(value) - SLIDER.rangeMin) / sliderRange;
        const tickTrackStart = trackStart - tickEdgePadding;
        const tickTrackLength = sliderTrackLength + tickEdgePadding * 2;
        const xBase = tickTrackStart + ratio * tickTrackLength;
        const x = scalePosition(xBase);
        container.position.set(x, trackCenterY - barHeight / 2 - labelOffset);
      });
    }

    function getTrackSegments(values, mode) {
      const ordered = getOrderedValues(values);
      const min = SLIDER.rangeMin;
      const max = SLIDER.rangeMax;
      const winColor = SLIDER.rightColor;
      const loseColor = SLIDER.leftColor;

      const segments = [];
      if (mode === "outside") {
        const [low, high] = ordered;
        segments.push(
          { start: min, end: low, color: winColor },
          { start: low, end: high, color: loseColor },
          { start: high, end: max, color: winColor }
        );
        return segments;
      }

      if (mode === "between") {
        const [a, b, c, d] = ordered;
        segments.push(
          { start: min, end: a, color: loseColor },
          { start: a, end: b, color: winColor },
          { start: b, end: c, color: loseColor },
          { start: c, end: d, color: winColor },
          { start: d, end: max, color: loseColor }
        );
        return segments;
      }

      const [low, high] = ordered;
      segments.push(
        { start: min, end: low, color: loseColor },
        { start: low, end: high, color: winColor },
        { start: high, end: max, color: loseColor }
      );
      return segments;
    }

    function updateSliderVisuals() {
      const values = getActiveValues();
      const ordered = getOrderedValues(values);
      const sliderScaleX = sliderWidthScale > 0 ? sliderWidthScale : 1;
      const widthCompensation = sliderScaleX > 0 ? 1 / sliderScaleX : 1;
      trackBar.clear();
      trackBar.scale.set(widthCompensation, 1);

      const segments = getTrackSegments(ordered, rollMode);
      segments.forEach((segment) => {
        const start = clampRange(segment.start);
        const end = clampRange(segment.end);
        if (end <= start) return;
        const drawStart = scalePosition(valueToPosition(start)) * sliderScaleX;
        const drawEnd = scalePosition(valueToPosition(end)) * sliderScaleX;
        const drawWidth = Math.max(0, drawEnd - drawStart);
        if (drawWidth <= 0) return;
        trackBar
          .roundRect(
            drawStart,
            trackCenterY - barHeight / 2,
            drawWidth,
            barHeight,
            barRadius
          )
          .fill(segment.color);
      });

      handles.forEach((handle, index) => {
        if (index < ordered.length) {
          handle.visible = true;
          handle.eventMode = "static";
          handle.position.set(
            scalePosition(valueToPosition(ordered[index])),
            trackCenterY + handleOffsetY
          );
        } else {
          handle.visible = false;
          handle.eventMode = "none";
        }
      });
    }

    function clampHandleValue(index, value) {
      const count = getActiveHandleCount();
      const minBound = index === 0 ? SLIDER.minValue : sliderValues[index - 1];
      const maxBound =
        index === count - 1 ? SLIDER.maxValue : sliderValues[index + 1];
      return Math.min(maxBound, Math.max(minBound, value));
    }

    function setHandleValue(index, value, options = {}) {
      const { snap = true } = options ?? {};
      const count = getActiveHandleCount();
      if (index < 0 || index >= count) return sliderValues[index];
      const previousPosition = lastHandlePositions[index];
      const baseValue = snap ? snapValue(value) : value;
      const clamped = clampHandleValue(index, baseValue);
      const nextValue = Number.isFinite(clamped)
        ? Number(clamped.toFixed(2))
        : sliderValues[index];
      const changed = nextValue !== sliderValues[index];
      sliderValues[index] = nextValue;
      updateSliderVisuals();

      const now = performance.now();
      if (changed) {
        emitSliderChange();
        const newPosition = valueToPosition(sliderValues[index]);
        const deltaPosition =
          Math.abs(newPosition - previousPosition) * trackScaleFactor;
        const deltaTime = Math.max(1, now - lastHandleUpdateTime);
        const positionSpeed = deltaPosition / deltaTime;
        const normalizedSpeed =
          dragMaxSpeed > 0 ? Math.min(1, positionSpeed / dragMaxSpeed) : 0;
        const pitchRange = Math.max(0, dragMaxPitch - dragMinPitch);
        const playbackSpeed =
          pitchRange > 0
            ? dragMinPitch + pitchRange * normalizedSpeed
            : dragMinPitch;
        if (now - lastSliderDragSoundTime >= dragCooldownMs) {
          playSoundEffect("sliderDrag", {
            speed: Number.isFinite(playbackSpeed)
              ? playbackSpeed
              : dragMinPitch,
          });
          lastSliderDragSoundTime = now;
        }
        lastHandlePositions[index] = newPosition;
      } else {
        lastHandlePositions[index] = valueToPosition(sliderValues[index]);
      }
      lastHandleUpdateTime = now;
      return sliderValues[index];
    }

    function setSliderValues(values, options = {}) {
      const count = getActiveHandleCount();
      const normalized = getOrderedValues(values).slice(0, count);
      normalized.forEach((value, index) => {
        setHandleValue(index, value, options);
      });
      return getActiveValues();
    }

    function getRollMode() {
      return rollMode;
    }

    function setRollMode(mode) {
      const normalized = normalizeRollMode(mode);
      if (rollMode === normalized) return rollMode;
      const wasBetween = rollMode === "between";
      const isBetween = normalized === "between";
      rollMode = normalized;
      lastHandlePositions = sliderValues.map((value) => valueToPosition(value));
      activeHandleIndex = null;
      if (wasBetween !== isBetween) {
        setSliderValues(getDefaultValuesForMode(normalized), { snap: false });
      }
      playSoundEffect("rollModeToggle");
      updateSliderVisuals();
      emitRollModeChange();
      emitSliderChange();
      return rollMode;
    }

    function resetState() {
      sliderDragging = false;
      sliderContainer.cursor = "pointer";
      handles.forEach((handle) => {
        handle.cursor = "pointer";
      });
      const now = performance.now();
      lastSliderDragSoundTime = now;
      setRollMode(defaultRollMode);
      setSliderValues(getDefaultValuesForMode(defaultRollMode), {
        snap: false,
      });
    }

    function getWinChance() {
      const values = getOrderedValues(getActiveValues());
      let total = 0;
      if (rollMode === "outside") {
        total =
          Math.max(0, values[0] - SLIDER.rangeMin) +
          Math.max(0, SLIDER.rangeMax - values[1]);
      } else if (rollMode === "between") {
        total =
          Math.max(0, values[1] - values[0]) +
          Math.max(0, values[3] - values[2]);
      } else {
        total = Math.max(0, values[1] - values[0]);
      }
      return Number(total.toFixed(4));
    }

    function setWinChance(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return getActiveValues();
      const clampedChance = Math.max(0, Math.min(SLIDER.rangeMax, numeric));
      const values = getOrderedValues(getActiveValues());
      if (rollMode === "between") {
        const total = Math.max(0.0001, getWinChance());
        const ratio = clampedChance / total;
        const rangeOneMid = (values[0] + values[1]) / 2;
        const rangeTwoMid = (values[2] + values[3]) / 2;
        const rangeOne = Math.max(0, (values[1] - values[0]) * ratio);
        const rangeTwo = Math.max(0, (values[3] - values[2]) * ratio);
        const nextValues = [
          rangeOneMid - rangeOne / 2,
          rangeOneMid + rangeOne / 2,
          rangeTwoMid - rangeTwo / 2,
          rangeTwoMid + rangeTwo / 2,
        ];
        return setSliderValues(nextValues, { snap: false });
      }

      const mid = (values[0] + values[1]) / 2;
      const desiredRange =
        rollMode === "outside"
          ? SLIDER.rangeMax - clampedChance
          : clampedChance;
      const half = desiredRange / 2;
      const nextValues = [mid - half, mid + half];
      return setSliderValues(nextValues, { snap: false });
    }

    function getMultiplier() {
      const chance = getWinChance();
      if (chance <= 0) return Infinity;
      return Number((99 / chance).toFixed(4));
    }

    function setMultiplier(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return getActiveValues();
      }
      const desiredChance = 99 / numeric;
      return setWinChance(desiredChance);
    }

    function isRollWin(rollValue) {
      const values = getOrderedValues(getActiveValues());
      if (rollMode === "outside") {
        const [low, high] = values;
        return rollValue <= low || rollValue >= high;
      }
      if (rollMode === "between") {
        const [a, b, c, d] = values;
        return (
          (rollValue >= a && rollValue <= b) ||
          (rollValue >= c && rollValue <= d)
        );
      }
      const [low, high] = values;
      return rollValue >= low && rollValue <= high;
    }

    function findClosestHandleIndex(value) {
      const values = getActiveValues();
      let closestIndex = 0;
      let closestDelta = Infinity;
      values.forEach((item, index) => {
        const delta = Math.abs(item - value);
        if (delta < closestDelta) {
          closestDelta = delta;
          closestIndex = index;
        }
      });
      return closestIndex;
    }

    function updateFromPointer(event) {
      const local = sliderContainer.toLocal(event.global);
      const adjustedX = unscalePosition(local.x);
      const rawValue = positionToValue(adjustedX);
      const index =
        activeHandleIndex ?? findClosestHandleIndex(clampBounds(rawValue));
      activeHandleIndex = index;
      setHandleValue(index, rawValue);
    }

    function pointerDown(event, index = null) {
      event.stopPropagation?.();
      sliderDragging = true;
      activeHandleIndex = typeof index === "number" ? index : activeHandleIndex;
      sliderContainer.cursor = "grabbing";
      handles.forEach((handle) => {
        handle.cursor = "grabbing";
      });
      playSoundEffect("sliderDown");
      updateFromPointer(event);
    }

    function pointerUp() {
      if (!sliderDragging) return;
      sliderDragging = false;
      activeHandleIndex = null;
      sliderContainer.cursor = "pointer";
      handles.forEach((handle) => {
        handle.cursor = "pointer";
      });
      playSoundEffect("sliderUp");
      console.debug(`Targets updated to ${getActiveValues().join(", ")}`);
      try {
        onRelease(getChangeDetails());
      } catch (err) {
        console.warn("Slider release callback failed", err);
      }
    }

    function pointerMove(event) {
      if (!sliderDragging) return;
      updateFromPointer(event);
    }

    sliderContainer.on("pointerdown", pointerDown);
    sliderContainer.on("pointerup", pointerUp);
    sliderContainer.on("pointerupoutside", pointerUp);
    handles.forEach((handle, index) => {
      handle.on?.("pointerdown", (event) => pointerDown(event, index));
    });

    const stagePointerMove = (event) => pointerMove(event);
    const stagePointerUp = () => pointerUp();

    app.stage.on("pointermove", stagePointerMove);
    app.stage.on("pointerup", stagePointerUp);
    app.stage.on("pointerupoutside", stagePointerUp);

    function applyDiceScale() {
      const widthCompensation = sliderWidthScale > 0 ? 1 / sliderWidthScale : 1;
      const appliedScale = diceScaleValue * diceOrientationScale;
      diceContainer.scale.set(appliedScale * widthCompensation, appliedScale);
    }

    function isAppContainerInPortraitMode() {
      if (appContainerElement && typeof window !== "undefined") {
        try {
          const styles = window.getComputedStyle(appContainerElement);
          if (styles?.flexDirection) {
            const direction = `${styles.flexDirection}`.toLowerCase();
            if (direction.includes("column")) {
              return true;
            }
            if (direction.includes("row")) {
              return false;
            }
          }
        } catch {}

        const rect = appContainerElement.getBoundingClientRect?.();
        if (rect && rect.width > 0 && rect.height > 0) {
          return rect.height >= rect.width;
        }
      }

      if (portraitMediaQuery) {
        return portraitMediaQuery.matches;
      }

      return false;
    }

    function updateDiceOrientationScale() {
      const isPortrait = isAppContainerInPortraitMode();
      const nextScale = isPortrait ? DICE_PORTRAIT_SCALE : 1;
      if (
        Math.abs(nextScale - diceOrientationScale) <= DICE_ORIENTATION_EPSILON
      ) {
        return;
      }
      diceOrientationScale = nextScale;
      applyDiceScale();
    }

    if (portraitMediaQuery) {
      const handlePortraitModeChange = () => updateDiceOrientationScale();
      if (typeof portraitMediaQuery.addEventListener === "function") {
        portraitMediaQuery.addEventListener("change", handlePortraitModeChange);
        removePortraitModeWatcher = () =>
          portraitMediaQuery.removeEventListener(
            "change",
            handlePortraitModeChange
          );
      } else if (typeof portraitMediaQuery.addListener === "function") {
        portraitMediaQuery.addListener(handlePortraitModeChange);
        removePortraitModeWatcher = () =>
          portraitMediaQuery.removeListener(handlePortraitModeChange);
      }
    }

    updateDiceOrientationScale();

    function setDiceScale(scale) {
      const safeScale = Number.isFinite(scale) ? Math.max(0, scale) : 1;
      diceScaleValue = safeScale;
      applyDiceScale();
    }

    function hideDiceInstant() {
      diceContainer.visible = false;
      diceContainer.alpha = 0;
      setDiceScale(diceFadeInScaleStart);
    }

    function applyDiceOutcomeInstant(outcome = diceLastOutcome) {
      const target = outcome ?? diceLastOutcome;
      if (!target) {
        return;
      }
      diceContainer.visible = true;
      const basePosition = Number.isFinite(target.basePosition)
        ? target.basePosition
        : valueToPosition(
            clampRange(target.value ?? getActiveValues()[0] ?? SLIDER.rangeMin)
          );
      const scaledPosition = scalePosition(basePosition);
      diceContainer.position.x = scaledPosition;
      target.positionX = scaledPosition;
      target.basePosition = basePosition;
      diceContainer.alpha = 1;
      setDiceScale(1);
      diceLabel.text = target.label;
      diceLabel.style.fill = target.targetColor;
      diceLabelShadowColor = DICE_LABEL_SHADOW_COLORS.target;
      if (diceLabel.style.dropShadow) {
        diceLabel.style.dropShadow.color =
          numberToHexColorString(diceLabelShadowColor);
      }
    }

    function cancelDiceAnimations() {
      if (diceAnimationCancel) {
        diceAnimationCancel();
        diceAnimationCancel = null;
      }
      if (diceFadeOutCancel) {
        diceFadeOutCancel();
        diceFadeOutCancel = null;
      }
      if (diceBumpCancel) {
        diceBumpCancel();
        diceBumpCancel = null;
      }
      if (diceFadeTimeoutId) {
        clearTimeout(diceFadeTimeoutId);
        diceFadeTimeoutId = null;
      }
      if (diceLabelColorCancel) {
        diceLabelColorCancel();
        diceLabelColorCancel = null;
      }
    }

    function scheduleDiceFadeOut() {
      if (diceFadeTimeoutId) {
        clearTimeout(diceFadeTimeoutId);
      }
      diceFadeTimeoutId = setTimeout(() => {
        diceFadeTimeoutId = null;
        if (diceBumpCancel) {
          diceBumpCancel();
          diceBumpCancel = null;
        }
        if (!animationsEnabled) {
          hideDiceInstant();
          return;
        }
        const startScale = diceScaleValue;
        diceFadeOutCancel = tween(app, {
          duration: diceFadeOutDuration,
          ease: (t) => Ease.easeOutQuad(t),
          update: (progress) => {
            diceContainer.alpha = 1 - progress;
            const scale =
              startScale + (diceFadeOutScaleEnd - startScale) * progress;
            setDiceScale(scale);
          },
          complete: () => {
            diceFadeOutCancel = null;
            hideDiceInstant();
          },
        });
      }, diceFadeOutDelay);
    }

    function playDiceBump() {
      if (!animationsEnabled) {
        if (diceBumpCancel) {
          diceBumpCancel();
          diceBumpCancel = null;
        }
        setDiceScale(1);
        return;
      }

      if (diceBumpCancel) {
        diceBumpCancel();
        diceBumpCancel = null;
      }

      if (diceBumpDuration <= 0 || diceBumpScale <= 0) {
        setDiceScale(1);
        return;
      }

      const upDuration = Math.max(0, diceBumpDuration / 2);
      const downDuration = Math.max(0, diceBumpDuration - upDuration);
      const peakScale = diceBumpScale;

      let activeCancel = null;

      const stopActive = () => {
        if (activeCancel) {
          activeCancel();
          activeCancel = null;
        }
      };

      const finish = () => {
        stopActive();
        setDiceScale(1);
        diceBumpCancel = null;
      };

      diceBumpCancel = finish;

      const startDownPhase = () => {
        const downStart = diceScaleValue;
        if (downDuration <= 0) {
          finish();
          return;
        }
        activeCancel = tween(app, {
          duration: downDuration,
          ease: (t) => Ease.easeInQuad(t),
          update: (progress) => {
            const scale = downStart + (1 - downStart) * progress;
            setDiceScale(scale);
          },
          complete: () => {
            activeCancel = null;
            finish();
          },
        });
      };

      const upStart = diceScaleValue;
      if (upDuration <= 0) {
        setDiceScale(peakScale);
        startDownPhase();
        return;
      }

      activeCancel = tween(app, {
        duration: upDuration,
        ease: (t) => Ease.easeOutQuad(t),
        update: (progress) => {
          const scale = upStart + (peakScale - upStart) * progress;
          setDiceScale(scale);
        },
        complete: () => {
          activeCancel = null;
          startDownPhase();
        },
      });
    }

    function revealDiceRoll({ roll, label, displayValue } = {}) {
      const numericRoll = typeof roll === "number" ? roll : Number(roll);
      const safeRoll = Number.isFinite(numericRoll)
        ? numericRoll
        : SLIDER.rangeMin;
      const clampedRoll = clampRange(safeRoll);
      let textValue =
        label ??
        displayValue ??
        (Number.isFinite(numericRoll)
          ? numericRoll.toFixed(1)
          : clampedRoll.toFixed(1));
      if (textValue === null || textValue === undefined) {
        textValue = clampedRoll.toFixed(1);
      }
      const displayLabel = `${textValue}`;
      diceLabel.text = displayLabel;

      const currentPosition = diceContainer.position.x;
      const startingValue = diceHasShown
        ? clampRange(positionToValue(unscalePosition(currentPosition)))
        : SLIDER.rangeMin;
      const startBaseX = valueToPosition(startingValue);
      const endBaseX = valueToPosition(clampedRoll);
      const startX = scalePosition(startBaseX);
      const endX = scalePosition(endBaseX);

      const isWin = Number.isFinite(numericRoll)
        ? isRollWin(clampedRoll)
        : false;

      const diceWasVisible =
        diceHasShown && diceContainer.visible && diceContainer.alpha > 0;
      const skipAnimations = !animationsEnabled;

      const targetColor = isWin
        ? DICE_LABEL_COLORS.win
        : DICE_LABEL_COLORS.loss;

      diceLastOutcome = {
        label: displayLabel,
        isWin,
        positionX: endX,
        basePosition: endBaseX,
        value: clampedRoll,
        targetColor,
      };

      cancelDiceAnimations();

      diceLabelShadowColor = skipAnimations
        ? DICE_LABEL_SHADOW_COLORS.target
        : DICE_LABEL_SHADOW_COLORS.default;
      diceLabel.style.fill = skipAnimations
        ? targetColor
        : DICE_LABEL_COLORS.default;
      if (diceLabel.style.dropShadow) {
        diceLabel.style.dropShadow.color =
          numberToHexColorString(diceLabelShadowColor);
      }

      diceContainer.visible = true;
      diceContainer.position.x = skipAnimations ? endX : startX;

      const revealStartAlpha = diceWasVisible ? 1 : 0;
      const revealStartScale = diceWasVisible ? 1 : diceFadeInScaleStart;

      diceContainer.alpha = skipAnimations ? 1 : revealStartAlpha;
      setDiceScale(skipAnimations ? 1 : revealStartScale);

      if (skipAnimations) {
        diceHasShown = true;
        scheduleDiceFadeOut();
        playSoundEffect(isWin ? "win" : "lose");
        return {
          label: displayLabel,
          isWin,
          roll: clampedRoll,
          targets: getActiveValues(),
        };
      }

      diceAnimationCancel = tween(app, {
        duration: diceFadeInDuration,
        ease: (t) => Ease.easeInOutQuad(t),
        update: (progress) => {
          diceContainer.alpha =
            revealStartAlpha + (1 - revealStartAlpha) * progress;
          diceContainer.position.x = startX + (endX - startX) * progress;
          const scale = revealStartScale + (1 - revealStartScale) * progress;
          setDiceScale(scale);
        },
        complete: () => {
          diceAnimationCancel = null;
          diceHasShown = true;
          diceContainer.position.x = endX;
          if (diceLastOutcome) {
            diceLastOutcome.positionX = endX;
            diceLastOutcome.basePosition = endBaseX;
          }
          setDiceScale(1);
          scheduleDiceFadeOut();
          playDiceBump();
          playSoundEffect(isWin ? "win" : "lose");
          const startColor =
            typeof diceLabel.style.fill === "number"
              ? diceLabel.style.fill
              : DICE_LABEL_COLORS.default;
          const startShadowColor = diceLabelShadowColor;
          diceLabelColorCancel = tween(app, {
            duration: 150,
            ease: (t) => t,
            update: (progress) => {
              diceLabel.style.fill = lerpColor(
                startColor,
                targetColor,
                progress
              );
              const nextShadowColor = lerpColor(
                startShadowColor,
                DICE_LABEL_SHADOW_COLORS.target,
                progress
              );
              diceLabelShadowColor = nextShadowColor;
              if (diceLabel.style.dropShadow) {
                diceLabel.style.dropShadow.color =
                  numberToHexColorString(nextShadowColor);
              }
            },
            complete: () => {
              diceLabel.style.fill = targetColor;
              diceLabelShadowColor = DICE_LABEL_SHADOW_COLORS.target;
              if (diceLabel.style.dropShadow) {
                diceLabel.style.dropShadow.color =
                  numberToHexColorString(diceLabelShadowColor);
              }
              diceLabelColorCancel = null;
            },
          });
        },
      });

      return {
        label: displayLabel,
        isWin,
        roll: clampedRoll,
        targets: getActiveValues(),
      };
    }

    function resetDice() {
      cancelDiceAnimations();
      diceHasShown = false;
      diceLastOutcome = null;
      hideDiceInstant();
      diceLabel.text = "";
      diceLabel.style.fill = DICE_LABEL_COLORS.default;
      diceLabelShadowColor = DICE_LABEL_SHADOW_COLORS.default;
      if (diceLabel.style.dropShadow) {
        diceLabel.style.dropShadow.color =
          numberToHexColorString(diceLabelShadowColor);
      }
      diceContainer.position.x = scalePosition(
        valueToPosition(SLIDER.rangeMin)
      );
      setDiceScale(diceFadeInScaleStart);
    }

    function setDiceAnimationsEnabled(value) {
      const normalized = Boolean(value);
      if (animationsEnabled === normalized) {
        return animationsEnabled;
      }
      const wasVisible = diceContainer.visible && diceContainer.alpha > 0;
      const wasFadingOut = Boolean(diceFadeOutCancel);
      animationsEnabled = normalized;
      if (!animationsEnabled) {
        cancelDiceAnimations();
        if (wasFadingOut) {
          hideDiceInstant();
        } else if (wasVisible && diceLastOutcome) {
          applyDiceOutcomeInstant();
          scheduleDiceFadeOut();
        } else {
          hideDiceInstant();
        }
      }
      return animationsEnabled;
    }

    function layout() {
      const base = baseWidth || fallbackWidth;
      const availableWidth = app.renderer.width * 0.9;
      const widthScale = base > 0 ? Math.min(1, availableWidth / base) : 1;
      const safeScale = widthScale > 0 ? widthScale : 1;
      const inverseScale = safeScale > 0 ? 1 / safeScale : 1;

      sliderWidthScale = safeScale > 0 ? safeScale : 1;
      sliderContainer.scale.set(sliderWidthScale, 1);
      const backgroundScaleResult = updateBackgroundScale?.(safeScale);
      const targetTrackScale =
        typeof backgroundScaleResult === "object"
          ? backgroundScaleResult.stretchScale ?? safeScale
          : typeof backgroundScaleResult === "number"
          ? backgroundScaleResult
          : safeScale;
      const normalizedTrackScale =
        Number.isFinite(targetTrackScale) && targetTrackScale > 0
          ? targetTrackScale
          : safeScale;
      const rawTrackScaleFactor =
        safeScale > 0 ? normalizedTrackScale / safeScale : 1;
      const compensationStrength =
        typeof SLIDER.trackWidthCompensationStrength === "number"
          ? SLIDER.trackWidthCompensationStrength
          : 1;
      const compensatedTrackScaleFactor =
        1 + (rawTrackScaleFactor - 1) * compensationStrength;

      trackScaleFactor =
        compensatedTrackScaleFactor > 0 ? compensatedTrackScaleFactor : 1;

      updateDiceOrientationScale();
      applyDiceScale();

      handles.forEach((handle) => {
        handle.scale.set(handleBaseScaleX * inverseScale, handleBaseScaleY);
      });
      tickItems.forEach(({ label, labelBaseScaleX, labelBaseScaleY }) => {
        label.scale.set(labelBaseScaleX * inverseScale, labelBaseScaleY);
      });

      updateTickLayout();
      updateSliderVisuals();

      if (!diceAnimationCancel) {
        const baseDicePosition = diceLastOutcome
          ? Number.isFinite(diceLastOutcome.basePosition)
            ? diceLastOutcome.basePosition
            : valueToPosition(
                clampRange(diceLastOutcome.value ?? SLIDER.rangeMin)
              )
          : valueToPosition(SLIDER.rangeMin);
        const scaledDicePosition = scalePosition(baseDicePosition);
        diceContainer.position.x = scaledDicePosition;
        if (diceLastOutcome) {
          diceLastOutcome.positionX = scaledDicePosition;
          diceLastOutcome.basePosition = baseDicePosition;
        }
      }

      const diceHeight = diceSpriteHeight ?? baseHeight * 0.8;
      const combinedHeight = baseHeight + diceHeight * 0.9;
      const bottomPaddingRatio = 0.5;
      const rawPanelHeight = Number(
        typeof getBottomPanelHeight === "function" ? getBottomPanelHeight() : 0
      );
      const panelHeight = Number.isFinite(rawPanelHeight) ? rawPanelHeight : 0;
      const panelOffset = panelHeight > 0 ? panelHeight + 48 : 0;
      const bottomPaddingCandidate = Math.max(
        60,
        combinedHeight / 2,
        app.renderer.height * bottomPaddingRatio,
        panelOffset
      );
      const minY = baseHeight / 2 + 16;
      const sliderY = Math.max(
        minY,
        app.renderer.height - bottomPaddingCandidate
      );
      const sliderOffset = baseHeight * containerOffsetRatio;
      sliderContainer.position.set(
        app.renderer.width / 2,
        sliderY + sliderOffset
      );
    }

    updateTickLayout();
    updateSliderVisuals();
    lastHandlePositions = sliderValues.map((value) => valueToPosition(value));
    lastHandleUpdateTime = performance.now();
    resetDice();
    layout();

    sliderContainer.sortChildren();

    emitSliderChange();

    return {
      container: sliderContainer,
      layout,
      revealDiceRoll,
      resetDice,
      resetState,
      getValues: () => getActiveValues(),
      getChangeDetails,
      setValues: (values) => setSliderValues(values),
      setValueAt: (index, value) => setHandleValue(index, value),
      getRollMode,
      setRollMode,
      getWinChance,
      setWinChance,
      getMultiplier,
      setMultiplier,
      destroy: () => {
        sliderContainer.removeAllListeners();
        handles.forEach((handle) => handle.removeAllListeners?.());
        app.stage.off("pointermove", stagePointerMove);
        app.stage.off("pointerup", stagePointerUp);
        app.stage.off("pointerupoutside", stagePointerUp);
        cancelDiceAnimations();
        removePortraitModeWatcher();
      },
      setAnimationsEnabled: (value) => setDiceAnimationsEnabled(value),
    };
  }

  function positionWinPopup() {
    winPopup.container.position.set(
      app.renderer.width / 2,
      app.renderer.height / 2
    );
  }

  function hideWinPopup() {
    winPopup.container.visible = false;
    winPopup.container.scale.set(0);
  }

  function formatMultiplier(multiplierValue) {
    if (
      typeof multiplierValue === "number" &&
      Number.isFinite(multiplierValue)
    ) {
      return `${multiplierValue.toFixed(2)}×`;
    }

    const raw = `${multiplierValue ?? ""}`;
    if (!raw) return "";
    return raw.endsWith("×") ? raw : `${raw}×`;
  }

  function formatAmount(amountValue) {
    if (typeof amountValue === "number" && Number.isFinite(amountValue)) {
      return amountValue.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      });
    }

    return `${amountValue ?? ""}`;
  }

  function spawnWinPopup(multiplierValue, amountValue) {
    winPopup.multiplierText.text = formatMultiplier(multiplierValue);
    winPopup.amountText.text = formatAmount(amountValue);
    winPopup.layoutAmountRow();
    positionWinPopup();

    winPopup.container.visible = true;
    winPopup.container.alpha = 1;
    winPopup.container.scale.set(0);

    tween(app, {
      duration: winPopupShowDuration,
      ease: (t) => Ease.easeOutQuad(t),
      update: (p) => {
        winPopup.container.scale.set(p);
      },
    });
  }

  function loadSoundEffect(key, path) {
    if (!enabledSoundKeys.has(key) || !path) {
      return Promise.resolve();
    }

    const alias = SOUND_ALIASES[key];
    if (!alias) {
      return Promise.resolve();
    }

    if (sound.exists?.(alias)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      sound.add(alias, {
        url: path,
        preload: true,
        loaded: resolve,
        error: resolve,
      });
    });
  }

  async function loadSoundEffects() {
    const loaders = Object.entries(soundEffectPaths).map(([key, path]) =>
      loadSoundEffect(key, path)
    );

    await Promise.all(loaders);
  }

  function playSoundEffect(key, options = {}) {
    if (!enabledSoundKeys.has(key)) return;

    const alias = SOUND_ALIASES[key];
    if (!alias) return;

    try {
      sound.play(alias, options);
    } catch (err) {
      // Ignore playback errors so they don't interrupt gameplay
    }
  }

  function updateBackground() {
    const width = app.renderer.width;
    const height = app.renderer.height;

    if (backgroundSprite) {
      backgroundSprite.visible = true;
      backgroundSprite.position.set(width / 2, height / 2);
      const textureWidth = backgroundSprite.texture?.width || 1;
      const textureHeight = backgroundSprite.texture?.height || 1;
      const scale = Math.max(
        width / Math.max(1, textureWidth),
        height / Math.max(1, textureHeight)
      );
      backgroundSprite.scale.set(scale);
    }

    backgroundGraphic.clear();
    backgroundGraphic.rect(0, 0, width, height).fill(backgroundColor);
    backgroundGraphic.visible = !backgroundSprite;
  }

  function reset() {
    hideWinPopup();
    betHistory.clear();
    betHistory.layout({ animate: false });
    sliderUi.resetState();
    sliderUi.resetDice();
  }

  function getState() {
    return {
      winPopupVisible: winPopup.container.visible,
      backgroundTextureLoaded: Boolean(backgroundTexture),
    };
  }

  function destroy() {
    try {
      ro.disconnect();
    } catch {}
    try {
      panelResizeObserver?.disconnect?.();
    } catch {}
    try {
      removeWindowResizeListener?.();
    } catch {}
    try {
      stopDevicePixelRatioWatcher?.();
    } catch {}
    bottomPanelUi?.destroy?.();
    sliderUi.destroy();
    betHistory.destroy();
    app.destroy(true);
    if (app.canvas?.parentNode === root) root.removeChild(app.canvas);
  }

  function revealDiceOutcome({ roll, label, displayValue } = {}) {
    playSoundEffect("diceRoll");
    const result = sliderUi.revealDiceRoll({ roll, label, displayValue });
    if (result) {
      betHistory.addEntry({
        label: result.label,
        isWin: Boolean(result.isWin),
      });
    }
  }

  function resizeToContainer() {
    const { width, height } = measureRootSize();
    const resizedWidth = Math.max(1, Math.floor(width));
    const resizedHeight = Math.max(1, Math.floor(height));
    const desiredResolution = getRendererResolution();
    const resolutionChanged = desiredResolution !== rendererResolution;
    rendererResolution = desiredResolution;

    app.renderer.resize(resizedWidth, resizedHeight, rendererResolution);
    if (resolutionChanged) {
      try {
        app.renderer.events?.resolutionChange?.(rendererResolution);
      } catch {}
    }
    app.stage.hitArea = new Rectangle(
      0,
      0,
      app.renderer.width,
      app.renderer.height
    );
    updateBackground();
    positionWinPopup();
    betHistory.layout({ animate: false });
    bottomPanelUi?.layout?.();
    sliderUi.layout();
  }

  if (typeof window !== "undefined") {
    const handleWindowResize = () => resizeToContainer();
    window.addEventListener("resize", handleWindowResize);
    removeWindowResizeListener = () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }

  stopDevicePixelRatioWatcher = createDevicePixelRatioWatcher(() =>
    resizeToContainer()
  );

  resizeToContainer();
  setTimeout(resizeToContainer, 0);

  const ro = new ResizeObserver(() => resizeToContainer());
  ro.observe(root);

  function setBottomPanelControlsClickable(isClickable) {
    bottomPanelUi?.setControlsClickable?.(isClickable);
  }

  function getCurrentRollMode() {
    return sliderUi?.getRollMode?.();
  }

  function setCurrentRollMode(mode) {
    return sliderUi?.setRollMode?.(mode);
  }

  function getCurrentWinChance() {
    return sliderUi?.getWinChance?.();
  }

  function setAnimationsEnabled(value) {
    const normalized = Boolean(value);
    if (animationsEnabled === normalized) {
      return animationsEnabled;
    }
    animationsEnabled = normalized;
    opts.disableAnimations = !normalized;
    sliderUi?.setAnimationsEnabled?.(normalized);
    betHistory.setAnimationsEnabled?.(normalized);
    return animationsEnabled;
  }

  return {
    app,
    reset,
    destroy,
    getState,
    showWinPopup: spawnWinPopup,
    hideWinPopup,
    playSoundEffect,
    revealDiceOutcome,
    setBottomPanelControlsClickable,
    getRollMode: getCurrentRollMode,
    setRollMode: setCurrentRollMode,
    getWinChance: getCurrentWinChance,
    setAnimationsEnabled,
  };
}
