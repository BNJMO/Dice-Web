import {
  Application,
  Container,
  Graphics,
  Text,
  Texture,
  Rectangle,
  AnimatedSprite,
  Assets,
  Sprite,
} from "pixi.js";

import Ease from "../ease.js";
import { createBetHistory } from "../betHistory/betHistory.js";
import { Stepper } from "../stepper/stepper.js";
import gameStartSoundUrl from "../../assets/sounds/GameStart.wav";
import winSoundUrl from "../../assets/sounds/Win.wav";
import loseSoundUrl from "../../assets/sounds/Lost.wav";
import diceRollSoundUrl from "../../assets/sounds/DiceRoll.wav";
import sliderDownSoundUrl from "../../assets/sounds/SliderDown.wav";
import sliderUpSoundUrl from "../../assets/sounds/SliderUp.wav";
import sliderDragSoundUrl from "../../assets/sounds/SliderDrag.wav";
import toggleRollModeSoundUrl from "../../assets/sounds/ToggleRollMode.wav";
import sliderBackgroundUrl from "../../assets/sprites/SliderBackground.png";
import sliderHandleUrl from "../../assets/sprites/SliderHandle.png";
import diceSpriteUrl from "../../assets/sprites/Dice.png";
import multiplierIconUrl from "../../assets/sprites/MultiplierIcon.png";
import rollModeIconUrl from "../../assets/sprites/RollOverIcon.png";
import winChanceIconUrl from "../../assets/sprites/WinChanceIcon.png";

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
  trackOffsetRatio: 0.04,
  tickEdgePaddingRatio: -6,
  tickPadding: -22,
  tickTextSizeRatio: 0.27,
};

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
  gameStart: "game.gameStart",
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
  win: 0x2ecc71,
  loss: 0xdd2e25,
};

const DICE_LABEL_SHADOW_COLORS = {
  default: 0xcfd9eb,
  target: 0x000000,
};

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

export async function loadTexture(path) {
  if (!path) return null;
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
  const gameStartSoundPath = opts.gameStartSoundPath ?? gameStartSoundUrl;
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
  const sliderSoundConfig = {
    dragMinPitch: sliderDragMinPitch,
    dragMaxPitch: sliderDragMaxPitch,
    dragMaxSpeed: Math.max(0.01, opts.sliderDragMaxSpeed ?? 1.5),
    dragCooldownMs: sliderDragCooldownMs,
  };

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
    gameStart: gameStartSoundPath,
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

  const app = new Application();
  try {
    const { width: startWidth, height: startHeight } = measureRootSize();
    await app.init({
      background: backgroundColor,
      width: startWidth,
      height: startHeight,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
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

  let shouldPlayStartSound = true;

  const betHistory = createBetHistory({ app, fontFamily, tween });
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
    onRelease: (value) => {
      try {
        onSliderValueChange(value);
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
  });
  ui.addChild(sliderUi.container);
  betHistory.layout({ animate: false });

  bottomPanelUi = setupBottomPanel();
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

  function setupBottomPanel() {
    const panel = document.createElement("div");
    panel.className = "game-bottom-panel";

    function createEditableBox({
      label,
      icon,
      step = 1,
      getValue = () => NaN,
      format = (value) => `${value ?? ""}`,
      onCommit = () => {},
    }) {
      const container = document.createElement("div");
      container.className = "game-panel-item";

      const labelEl = document.createElement("span");
      labelEl.className = "game-panel-label";
      labelEl.textContent = label;
      container.appendChild(labelEl);

      const valueWrapper = document.createElement("div");
      valueWrapper.className = "game-panel-value has-stepper";
      container.appendChild(valueWrapper);

      const input = document.createElement("input");
      input.type = "text";
      input.className = "game-panel-input";
      input.inputMode = "decimal";
      input.spellcheck = false;
      input.autocomplete = "off";
      input.setAttribute("aria-label", label);
      valueWrapper.appendChild(input);

      const iconEl = document.createElement("img");
      iconEl.src = icon;
      iconEl.alt = "";
      iconEl.className = "game-panel-icon";
      valueWrapper.appendChild(iconEl);

      const stepper = new Stepper({
        upAriaLabel: `Increase ${label}`,
        downAriaLabel: `Decrease ${label}`,
        onStepUp: () => {
          const current = Number(getValue());
          const next = Number.isFinite(current) ? current + step : step;
          onCommit(next);
          refresh(true);
        },
        onStepDown: () => {
          const current = Number(getValue());
          const next = Number.isFinite(current) ? current - step : 0;
          onCommit(next);
          refresh(true);
        },
      });

      valueWrapper.appendChild(stepper.element);

      const state = { editing: false };

      function refresh(force = false) {
        if (state.editing && !force) return;
        const value = getValue();
        if (Number.isFinite(value)) {
          input.value = format(value);
        } else {
          input.value = "";
        }
      }

      function commit() {
        const raw = input.value.trim();
        if (!raw) {
          refresh(true);
          return;
        }
        const numeric = Number(raw);
        if (Number.isFinite(numeric)) {
          onCommit(numeric);
        }
        refresh(true);
      }

      input.addEventListener("focus", () => {
        state.editing = true;
        setTimeout(() => input.select(), 0);
      });

      input.addEventListener("blur", () => {
        state.editing = false;
        commit();
      });

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          state.editing = false;
          commit();
          input.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          state.editing = false;
          refresh(true);
          input.blur();
        } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          const direction = event.key === "ArrowUp" ? 1 : -1;
          const current = Number(getValue());
          const next = Number.isFinite(current)
            ? current + direction * step
            : direction * step;
          onCommit(next);
          refresh(true);
        }
      });

      valueWrapper.addEventListener("click", () => input.focus());

      return {
        container,
        refresh,
      };
    }

    function createRollModeBox() {
      const container = document.createElement("div");
      container.className = "game-panel-item";

      const labelEl = document.createElement("span");
      labelEl.className = "game-panel-label";
      container.appendChild(labelEl);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "game-panel-value game-panel-toggle";
      button.setAttribute("aria-label", "Toggle roll mode");
      container.appendChild(button);

      const valueEl = document.createElement("span");
      valueEl.className = "game-panel-display";
      button.appendChild(valueEl);

      const iconEl = document.createElement("img");
      iconEl.src = rollModeIconUrl;
      iconEl.alt = "";
      iconEl.className = "game-panel-icon";
      button.appendChild(iconEl);

      button.addEventListener("click", () => {
        sliderUi.toggleRollMode();
        refresh(true);
      });

      function refresh(force = false) {
        const mode = sliderUi.getRollMode();
        labelEl.textContent = mode === "under" ? "Roll Under" : "Roll Over";
        button.setAttribute("data-mode", mode);
        const value = sliderUi.getValue();
        if (force || document.activeElement !== button) {
          valueEl.textContent = Number.isFinite(value)
            ? value.toFixed(2)
            : "0.00";
        }
      }

      return {
        container,
        refresh,
      };
    }

    const multiplierBox = createEditableBox({
      label: "Multiplier",
      icon: multiplierIconUrl,
      step: 1,
      getValue: () => sliderUi.getMultiplier(),
      format: (value) => value.toFixed(4),
      onCommit: (value) => sliderUi.setMultiplier(value),
    });

    const rollModeBox = createRollModeBox();

    const winChanceBox = createEditableBox({
      label: "Win Chance",
      icon: winChanceIconUrl,
      step: 1,
      getValue: () => sliderUi.getWinChance(),
      format: (value) => value.toFixed(4),
      onCommit: (value) => sliderUi.setWinChance(value),
    });

    panel.append(
      multiplierBox.container,
      rollModeBox.container,
      winChanceBox.container
    );

    root.appendChild(panel);

    const SCALE_EPSILON = 0.0001;
    let appliedScale = 1;
    let lastScaledHeight = 0;
    let lastWidthFactor = 1;

    function layout() {
      const panelHeight = Number(panel.offsetHeight);
      const gameHeight = Number(app?.renderer?.height ?? 0);
      const maxPanelHeight =
        Number.isFinite(gameHeight) && gameHeight > 0 ? gameHeight * 0.4 : 0;

      let desiredScale = 1;
      if (
        Number.isFinite(panelHeight) &&
        panelHeight > 0 &&
        maxPanelHeight > 0
      ) {
        desiredScale = Math.min(1, maxPanelHeight / panelHeight);
      }

      if (!Number.isFinite(desiredScale) || desiredScale <= 0) {
        desiredScale = 1;
      }

      const previousScale = appliedScale;
      appliedScale = Math.max(0, Math.min(1, desiredScale));
      const scaleChanged =
        Math.abs(appliedScale - previousScale) > SCALE_EPSILON;

      const scaleIsDefault = Math.abs(appliedScale - 1) < SCALE_EPSILON;

      if (scaleChanged) {
        if (scaleIsDefault) {
          panel.style.removeProperty("--panel-scale");
        } else {
          panel.style.setProperty("--panel-scale", `${appliedScale}`);
        }
      } else if (scaleIsDefault) {
        panel.style.removeProperty("--panel-scale");
      }

      if (!scaleIsDefault && appliedScale > 0) {
        const widthFactor = 1 / appliedScale;
        if (Number.isFinite(widthFactor) && widthFactor > 0) {
          const widthPercent = `${(widthFactor * 100).toFixed(4)}%`;
          if (panel.style.width !== widthPercent) {
            panel.style.width = widthPercent;
          }
          lastWidthFactor = widthFactor;
        } else if (lastWidthFactor !== 1) {
          panel.style.removeProperty("width");
          lastWidthFactor = 1;
        }
      } else if (lastWidthFactor !== 1 || panel.style.width) {
        panel.style.removeProperty("width");
        lastWidthFactor = 1;
      }

      const scaledHeight =
        Number.isFinite(panelHeight) && panelHeight > 0
          ? panelHeight * appliedScale
          : 0;
      const heightChanged = Math.abs(scaledHeight - lastScaledHeight) > 0.5;
      lastScaledHeight = scaledHeight;

      return scaleChanged || heightChanged;
    }

    function getScaledHeight() {
      const panelHeight = Number(panel.offsetHeight);
      if (!Number.isFinite(panelHeight) || panelHeight <= 0) {
        return 0;
      }
      return panelHeight * appliedScale;
    }

    function refresh(force = false) {
      multiplierBox.refresh(force);
      rollModeBox.refresh(force);
      winChanceBox.refresh(force);
    }

    handleSliderChange = () => {
      refresh();
      if (layout()) {
        sliderUi.layout();
      }
    };

    refresh(true);
    layout();

    return {
      panel,
      refresh,
      layout,
      getScaledHeight,
      destroy: () => {
        handleSliderChange = () => {};
        panel.style.removeProperty("--panel-scale");
        panel.style.removeProperty("width");
        appliedScale = 1;
        lastScaledHeight = 0;
        lastWidthFactor = 1;
        panel.remove();
      },
    };
  }

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
      style: {
        fill: PALETTE.winPopupMultiplierText,
        fontFamily,
        fontSize: 36,
        fontWeight: "700",
        align: "center",
      },
    });
    multiplierText.anchor.set(0.5);
    multiplierText.position.set(0, multiplierVerticalOffset);

    const amountRow = new Container();

    const amountText = new Text({
      text: "0.0",
      style: {
        fill: 0xffffff,
        fontFamily,
        fontSize: 24,
        fontWeight: "600",
        align: "center",
      },
    });
    amountText.anchor.set(0.5);
    amountRow.addChild(amountText);

    const coinContainer = new Container();
    const coinRadius = 16;
    const coinBg = new Graphics();
    coinBg.circle(0, 0, coinRadius).fill(0xf6a821);
    const coinText = new Text({
      text: "₿",
      style: {
        fill: 0xffffff,
        fontFamily,
        fontSize: 18,
        fontWeight: "700",
        align: "center",
      },
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

    const fallbackWidth = 560;
    const fallbackHeight = 140;

    let baseWidth = fallbackWidth;
    let baseHeight = fallbackHeight;
    const trackOffsetRatio = Number.isFinite(SLIDER.trackOffsetRatio)
      ? SLIDER.trackOffsetRatio
      : 0;
    const trackPaddingRatio = Number.isFinite(SLIDER.trackPaddingRatio)
      ? SLIDER.trackPaddingRatio
      : 0;
    const trackHeightRatio = Number.isFinite(SLIDER.trackHeightRatio)
      ? SLIDER.trackHeightRatio
      : 0;

    let background;
    if (textures.background) {
      background = new Sprite(textures.background);
      background.anchor.set(0.5);
      baseWidth =
        textures.background.width ?? background.width ?? fallbackWidth;
      baseHeight =
        textures.background.height ?? background.height ?? fallbackHeight;
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
    sliderContainer.addChild(background);

    const trackCenterY = baseHeight * trackOffsetRatio;
    const trackPadding = Math.max(12, baseWidth * trackPaddingRatio);
    const trackLength = Math.max(1, baseWidth - trackPadding * 2);
    const trackStart = -trackLength / 2;
    const trackEnd = trackLength / 2;
    const tickEdgePadding = Math.min(trackPadding, SLIDER.tickEdgePaddingRatio);
    const barHeight = Math.max(10, baseHeight * trackHeightRatio);
    const barRadius = barHeight / 2;

    const leftBar = new Graphics();
    leftBar.zIndex = 5;
    leftBar.eventMode = "none";
    const rightBar = new Graphics();
    rightBar.zIndex = 5;
    rightBar.eventMode = "none";
    sliderContainer.addChild(leftBar, rightBar);

    const tickContainer = new Container();
    tickContainer.zIndex = 6;
    sliderContainer.addChild(tickContainer);

    const tickValues = [0, 25, 50, 75, 100];
    const tickItems = tickValues.map((value) => {
      const item = new Container();
      item.eventMode = "none";
      const label = new Text({
        text: `${value}`,
        style: {
          fill: 0xffffff,
          fontFamily,
          fontSize: Math.max(14, baseHeight * SLIDER.tickTextSizeRatio),
          fontWeight: "600",
          align: "center",
        },
      });
      label.anchor.set(0.5, 1);
      label.position.set(0, SLIDER.tickPadding);

      item.addChild(label);
      tickContainer.addChild(item);

      return { container: item, label, value };
    });

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
    sliderContainer.addChild(handle);

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
      style: {
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
      },
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
    const defaultSliderValue = Math.min(
      SLIDER.maxValue,
      Math.max(SLIDER.minValue, (SLIDER.minValue + SLIDER.maxValue) / 2)
    );
    let sliderValue = defaultSliderValue;
    let sliderDragging = false;
    let rollMode = "over";
    let diceHasShown = false;
    let diceAnimationCancel = null;
    let diceFadeOutCancel = null;
    let diceFadeTimeoutId = null;
    let diceBumpCancel = null;
    let diceLabelColorCancel = null;
    let diceLabelShadowColor = DICE_LABEL_SHADOW_COLORS.default;
    let lastHandlePosition = valueToPosition(sliderValue);
    let lastHandleUpdateTime = performance.now();
    let lastSliderDragSoundTime = -Infinity;

    function emitSliderChange() {
      try {
        onChange({
          value: sliderValue,
          rollMode,
          winChance: getWinChance(),
          multiplier: getMultiplier(),
        });
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
        const x = tickTrackStart + ratio * tickTrackLength;
        container.position.set(x, trackCenterY - barHeight / 2 - labelOffset);
      });
    }

    function updateSliderVisuals() {
      const position = valueToPosition(sliderValue);
      handle.position.set(position, trackCenterY);

      leftBar.clear();
      rightBar.clear();
      const leftWidth = Math.max(0, position - trackStart);
      const rightWidth = Math.max(0, trackEnd - position);
      if (leftWidth > 0) {
        const color =
          rollMode === "under" ? SLIDER.rightColor : SLIDER.leftColor;
        leftBar
          .roundRect(
            trackStart,
            trackCenterY - barHeight / 2,
            leftWidth,
            barHeight,
            barRadius
          )
          .fill(color);
      }

      if (rightWidth > 0) {
        const color =
          rollMode === "under" ? SLIDER.leftColor : SLIDER.rightColor;
        rightBar
          .roundRect(
            position,
            trackCenterY - barHeight / 2,
            rightWidth,
            barHeight,
            barRadius
          )
          .fill(color);
      }
    }

    function setSliderValue(value) {
      const previousPosition = lastHandlePosition;
      const clamped = clampBounds(snapValue(value));
      const nextValue = Number.isFinite(clamped)
        ? Number(clamped.toFixed(2))
        : sliderValue;
      const changed = nextValue !== sliderValue;
      sliderValue = nextValue;
      updateSliderVisuals();

      const now = performance.now();
      if (changed) {
        emitSliderChange();
        const newPosition = valueToPosition(sliderValue);
        const deltaPosition = Math.abs(newPosition - previousPosition);
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
        lastHandlePosition = newPosition;
      } else {
        lastHandlePosition = valueToPosition(sliderValue);
      }
      lastHandleUpdateTime = now;
      return sliderValue;
    }

    function getRollMode() {
      return rollMode;
    }

    function setRollMode(mode) {
      const normalized = mode === "under" ? "under" : "over";
      if (rollMode === normalized) return rollMode;
      rollMode = normalized;
      playSoundEffect("rollModeToggle");
      updateSliderVisuals();
      emitRollModeChange();
      emitSliderChange();
      return rollMode;
    }

    function toggleRollMode() {
      return setRollMode(rollMode === "over" ? "under" : "over");
    }

    function resetState() {
      sliderDragging = false;
      sliderContainer.cursor = "pointer";
      handle.cursor = "pointer";
      const now = performance.now();
      lastSliderDragSoundTime = now;
      setRollMode("over");
      setSliderValue(defaultSliderValue);
    }

    function getWinChance() {
      const clamped = clampRange(clampBounds(sliderValue));
      const raw = rollMode === "over" ? SLIDER.rangeMax - clamped : clamped;
      return Number(raw.toFixed(4));
    }

    function setWinChance(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return sliderValue;
      const clampedChance = Math.max(0, Math.min(SLIDER.rangeMax, numeric));
      const targetValue =
        rollMode === "over" ? SLIDER.rangeMax - clampedChance : clampedChance;
      return setSliderValue(targetValue);
    }

    function getMultiplier() {
      const chance = getWinChance();
      if (chance <= 0) return Infinity;
      return Number((99 / chance).toFixed(4));
    }

    function setMultiplier(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return sliderValue;
      }
      const desiredChance = 99 / numeric;
      return setWinChance(desiredChance);
    }

    function updateFromPointer(event) {
      const local = sliderContainer.toLocal(event.global);
      const rawValue = positionToValue(local.x);
      setSliderValue(rawValue);
    }

    function pointerDown(event) {
      event.stopPropagation?.();
      sliderDragging = true;
      sliderContainer.cursor = "grabbing";
      handle.cursor = "grabbing";
      playSoundEffect("sliderDown");
      updateFromPointer(event);
    }

    function pointerUp() {
      if (!sliderDragging) return;
      sliderDragging = false;
      sliderContainer.cursor = "pointer";
      handle.cursor = "pointer";
      playSoundEffect("sliderUp");
      console.debug(`Roll over target set to ${sliderValue.toFixed(1)}%`);
      try {
        onRelease(sliderValue);
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
    handle.on?.("pointerdown", pointerDown);

    const stagePointerMove = (event) => pointerMove(event);
    const stagePointerUp = () => pointerUp();

    app.stage.on("pointermove", stagePointerMove);
    app.stage.on("pointerup", stagePointerUp);
    app.stage.on("pointerupoutside", stagePointerUp);

    function setDiceScale(scale) {
      const safeScale = Number.isFinite(scale) ? Math.max(0, scale) : 1;
      diceContainer.scale.set(safeScale, safeScale);
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
      diceFadeTimeoutId = setTimeout(() => {
        diceFadeTimeoutId = null;
        if (diceBumpCancel) {
          diceBumpCancel();
          diceBumpCancel = null;
        }
        const startScale = diceContainer.scale.x;
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
            diceContainer.visible = false;
            diceContainer.alpha = 0;
            setDiceScale(diceFadeInScaleStart);
          },
        });
      }, diceFadeOutDelay);
    }

    function playDiceBump() {
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
        const downStart = diceContainer.scale.x;
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

      const upStart = diceContainer.scale.x;
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
        ? clampRange(positionToValue(currentPosition))
        : SLIDER.rangeMin;
      const startX = valueToPosition(startingValue);
      const endX = valueToPosition(clampedRoll);

      const isWin = Number.isFinite(numericRoll)
        ? rollMode === "under"
          ? clampedRoll < sliderValue
          : clampedRoll >= sliderValue
        : false;

      const diceWasVisible =
        diceHasShown && diceContainer.visible && diceContainer.alpha > 0;

      cancelDiceAnimations();

      diceLabel.style.fill = DICE_LABEL_COLORS.default;
      diceLabelShadowColor = DICE_LABEL_SHADOW_COLORS.default;
      if (diceLabel.style.dropShadow) {
        diceLabel.style.dropShadow.color =
          numberToHexColorString(diceLabelShadowColor);
      }

      diceContainer.visible = true;
      diceContainer.position.x = startX;

      const revealStartAlpha = diceWasVisible ? 1 : 0;
      const revealStartScale = diceWasVisible ? 1 : diceFadeInScaleStart;

      diceContainer.alpha = revealStartAlpha;
      setDiceScale(revealStartScale);

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
          setDiceScale(1);
          scheduleDiceFadeOut();
          playDiceBump();
          playSoundEffect(isWin ? "win" : "lose");
          const targetColor = isWin
            ? DICE_LABEL_COLORS.win
            : DICE_LABEL_COLORS.loss;
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
        target: sliderValue,
      };
    }

    function resetDice() {
      cancelDiceAnimations();
      diceHasShown = false;
      diceContainer.visible = false;
      diceContainer.alpha = 0;
      diceLabel.text = "";
      diceLabel.style.fill = DICE_LABEL_COLORS.default;
      diceLabelShadowColor = DICE_LABEL_SHADOW_COLORS.default;
      if (diceLabel.style.dropShadow) {
        diceLabel.style.dropShadow.color =
          numberToHexColorString(diceLabelShadowColor);
      }
      diceContainer.position.x = valueToPosition(SLIDER.rangeMin);
      setDiceScale(diceFadeInScaleStart);
    }

    function layout() {
      const base = baseWidth || fallbackWidth;
      const availableWidth = app.renderer.width * 0.9;
      const scale = base > 0 ? Math.min(1, availableWidth / base) : 1;
      sliderContainer.scale.set(scale);

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
        (combinedHeight * scale) / 2,
        app.renderer.height * bottomPaddingRatio,
        panelOffset
      );
      const minY = (baseHeight * scale) / 2 + 16;
      const sliderY = Math.max(
        minY,
        app.renderer.height - bottomPaddingCandidate
      );
      sliderContainer.position.set(app.renderer.width / 2, sliderY);
    }

    updateTickLayout();
    updateSliderVisuals();
    lastHandlePosition = valueToPosition(sliderValue);
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
      getValue: () => sliderValue,
      setValue: (value) => setSliderValue(value),
      getRollMode,
      setRollMode,
      toggleRollMode,
      getWinChance,
      setWinChance,
      getMultiplier,
      setMultiplier,
      destroy: () => {
        sliderContainer.removeAllListeners();
        handle.removeAllListeners?.();
        app.stage.off("pointermove", stagePointerMove);
        app.stage.off("pointerup", stagePointerUp);
        app.stage.off("pointerupoutside", stagePointerUp);
        cancelDiceAnimations();
      },
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

  function getSliderDetails() {
    return {
      value: sliderUi.getValue?.() ?? 0,
      rollMode: sliderUi.getRollMode?.() ?? "over",
      winChance: sliderUi.getWinChance?.() ?? 0,
      multiplier: sliderUi.getMultiplier?.() ?? 0,
    };
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
    shouldPlayStartSound = true;
    playStartSoundIfNeeded();
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

  function playStartSoundIfNeeded() {
    if (!shouldPlayStartSound) return;
    playSoundEffect("gameStart");
    shouldPlayStartSound = false;
  }

  function resizeToContainer() {
    const { width, height } = measureRootSize();
    const resizedWidth = Math.max(1, Math.floor(width));
    const resizedHeight = Math.max(1, Math.floor(height));
    app.renderer.resize(resizedWidth, resizedHeight);
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

  resizeToContainer();
  setTimeout(resizeToContainer, 0);

  const ro = new ResizeObserver(() => resizeToContainer());
  ro.observe(root);

  playStartSoundIfNeeded();

  return {
    app,
    reset,
    destroy,
    getState,
    showWinPopup: spawnWinPopup,
    hideWinPopup,
    playSoundEffect,
    revealDiceOutcome,
    getSliderDetails,
  };
}
