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

import Ease from "./ease.js";
import gameStartSoundUrl from "../assets/sounds/GameStart.wav";
import winSoundUrl from "../assets/sounds/Win.wav";
import sliderBackgroundUrl from "../assets/sprites/SliderBackground.png";
import sliderHandleUrl from "../assets/sprites/SliderHandle.png";
import diceSpriteUrl from "../assets/sprites/Dice.png";

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
  step: 0.1,
  leftColor: 0xf40029,
  rightColor: 0xf0ff31,
  fadeInDuration: 700,
  fadeOutDuration: 400,
  fadeOutDelay: 5000,
  trackHeightRatio: 0.15,
  trackPaddingRatio: 0.035,
  trackOffsetRatio: 0.04,
  tickEdgePaddingRatio: 0.02,
  tickPadding: -22,
  tickTextSizeRatio: 0.27,
};

const SOUND_ALIASES = {
  gameStart: "game.gameStart",
  win: "game.win",
};

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

  /* Win Popup*/
  const winPopupShowDuration = opts.winPopupShowDuration ?? 260;
  const winPopupWidth = opts.winPopupWidth ?? 240;
  const winPopupHeight = opts.winPopupHeight ?? 170;

  const soundEffectPaths = {
    gameStart: gameStartSoundPath,
    win: winSoundPath,
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
    root.style.width = `${initialSize}px`;
    root.style.maxWidth = "100%";
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
    await app.init({
      background: backgroundColor,
      width: initialSize,
      height: initialSize,
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
  app.stage.hitArea = new Rectangle(0, 0, app.renderer.width, app.renderer.height);

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

  // API callbacks
  const onWin = opts.onWin ?? (() => {});
  const onLost = opts.onLost ?? (() => {});
  const onStateChange = opts.onChange ?? (() => {});
  const onSliderValueChange = opts.onSliderValueChange ?? (() => {});

  const sliderUi = createSliderUi({
    textures: {
      background: sliderBackgroundTexture,
      handle: sliderHandleTexture,
      dice: diceTexture,
    },
    onRelease: (value) => {
      try {
        onSliderValueChange(value);
      } catch (err) {
        console.warn("onSliderValueChange callback failed", err);
      }
    },
  });
  ui.addChild(sliderUi.container);

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

  function createSliderUi({ textures = {}, onRelease = () => {} } = {}) {
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
      baseWidth = textures.background.width ?? background.width ?? fallbackWidth;
      baseHeight = textures.background.height ?? background.height ?? fallbackHeight;
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
    const tickEdgePadding = Math.min(
      trackPadding,
      Math.max(0, baseWidth * (SLIDER.tickEdgePaddingRatio ?? 0))
    );
    const barHeight = Math.max(10, baseHeight *trackHeightRatio);
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

      const line = new Graphics();
      line.eventMode = "none";
      item.addChild(label, line);
      tickContainer.addChild(item);

      return { container: item, label, line, value };
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
      diceSpriteHeight = textures.dice.height ?? diceSprite.height ?? barHeight * 2.4;
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
        fill: 0x1c2431,
        fontFamily,
        fontSize: Math.max(18, baseHeight * 0.2),
        fontWeight: "700",
        align: "center",
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
    let sliderValue = Math.min(
      SLIDER.maxValue,
      Math.max(SLIDER.minValue, (SLIDER.minValue + SLIDER.maxValue) / 2)
    );
    let sliderDragging = false;
    let diceHasShown = false;
    let diceAnimationCancel = null;
    let diceFadeOutCancel = null;
    let diceFadeTimeoutId = null;

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
      const tickHeight = Math.max(12, barHeight * 0.45);
      tickItems.forEach(({ container, line, value }) => {
        const ratio = (clampRange(value) - SLIDER.rangeMin) / sliderRange;
        const tickTrackStart = trackStart - tickEdgePadding;
        const tickTrackLength = sliderTrackLength + tickEdgePadding * 2;
        const x = tickTrackStart + ratio * tickTrackLength;
        container.position.set(
          x,
          trackCenterY - barHeight / 2 - tickHeight
        );
        line.clear();
        line.roundRect(-1, 0, 2, tickHeight, 1).fill(0xffffff);
        line.alpha = 0.6;
      });
    }

    function updateSliderVisuals() {
      const position = valueToPosition(sliderValue);
      handle.position.set(position, trackCenterY);

      leftBar.clear();
      const leftWidth = Math.max(0, position - trackStart);
      if (leftWidth > 0) {
        leftBar
          .roundRect(
            trackStart,
            trackCenterY - barHeight / 2,
            leftWidth,
            barHeight,
            barRadius
          )
          .fill(SLIDER.leftColor);
      }

      rightBar.clear();
      const rightWidth = Math.max(0, trackEnd - position);
      if (rightWidth > 0) {
        rightBar
          .roundRect(
            position,
            trackCenterY - barHeight / 2,
            rightWidth,
            barHeight,
            barRadius
          )
          .fill(SLIDER.rightColor);
      }
    }

    function setSliderValue(value) {
      const clamped = clampBounds(snapValue(value));
      sliderValue = Number.isFinite(clamped) ? Number(clamped.toFixed(2)) : sliderValue;
      updateSliderVisuals();
      return sliderValue;
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
      updateFromPointer(event);
    }

    function pointerUp() {
      if (!sliderDragging) return;
      sliderDragging = false;
      sliderContainer.cursor = "pointer";
      handle.cursor = "pointer";
      console.debug(
        `Roll over target set to ${sliderValue.toFixed(1)}%`
      );
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

    function cancelDiceAnimations() {
      if (diceAnimationCancel) {
        diceAnimationCancel();
        diceAnimationCancel = null;
      }
      if (diceFadeOutCancel) {
        diceFadeOutCancel();
        diceFadeOutCancel = null;
      }
      if (diceFadeTimeoutId) {
        clearTimeout(diceFadeTimeoutId);
        diceFadeTimeoutId = null;
      }
    }

    function scheduleDiceFadeOut() {
      diceFadeTimeoutId = setTimeout(() => {
        diceFadeTimeoutId = null;
        diceFadeOutCancel = tween(app, {
          duration: SLIDER.fadeOutDuration,
          ease: (t) => Ease.easeOutQuad(t),
          update: (progress) => {
            diceContainer.alpha = 1 - progress;
          },
          complete: () => {
            diceFadeOutCancel = null;
            diceContainer.visible = false;
            diceContainer.alpha = 0;
          },
        });
      }, SLIDER.fadeOutDelay);
    }

    function revealDiceRoll({ roll, label, displayValue } = {}) {
      const numericRoll = typeof roll === "number" ? roll : Number(roll);
      const safeRoll = Number.isFinite(numericRoll)
        ? numericRoll
        : SLIDER.rangeMin;
      const clampedRoll = clampRange(safeRoll);
      let textValue =
        label ?? displayValue ?? (Number.isFinite(numericRoll)
          ? numericRoll.toFixed(1)
          : clampedRoll.toFixed(1));
      if (textValue === null || textValue === undefined) {
        textValue = clampedRoll.toFixed(1);
      }
      diceLabel.text = `${textValue}`;

      const currentPosition = diceContainer.position.x;
      const startingValue = diceHasShown
        ? clampRange(positionToValue(currentPosition))
        : SLIDER.rangeMin;
      const startX = valueToPosition(startingValue);
      const endX = valueToPosition(clampedRoll);

      cancelDiceAnimations();

      diceContainer.visible = true;
      diceContainer.alpha = 0;
      diceContainer.position.x = startX;

      diceAnimationCancel = tween(app, {
        duration: SLIDER.fadeInDuration,
        ease: (t) => Ease.easeOutQuad(t),
        update: (progress) => {
          diceContainer.alpha = progress;
          diceContainer.position.x = startX + (endX - startX) * progress;
        },
        complete: () => {
          diceAnimationCancel = null;
          diceHasShown = true;
          diceContainer.position.x = endX;
          scheduleDiceFadeOut();
        },
      });
    }

    function resetDice() {
      cancelDiceAnimations();
      diceHasShown = false;
      diceContainer.visible = false;
      diceContainer.alpha = 0;
      diceLabel.text = "";
      diceContainer.position.x = valueToPosition(SLIDER.rangeMin);
    }

    function layout() {
      const base = baseWidth || fallbackWidth;
      const availableWidth = app.renderer.width * 0.9;
      const scale = base > 0 ? Math.min(1, availableWidth / base) : 1;
      sliderContainer.scale.set(scale);

      const diceHeight = diceSpriteHeight ?? baseHeight * 0.8;
      const combinedHeight = baseHeight + diceHeight * 0.9;
      const bottomPaddingRatio = 0.5;
      const bottomPadding = Math.max(
        60,
        (combinedHeight * scale) / 2,
        app.renderer.height * bottomPaddingRatio
      );
      sliderContainer.position.set(
        app.renderer.width / 2,
        app.renderer.height - bottomPadding
      );
    }

    updateTickLayout();
    setSliderValue(sliderValue);
    resetDice();
    layout();

    sliderContainer.sortChildren();

    return {
      container: sliderContainer,
      layout,
      revealDiceRoll,
      resetDice,
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

    playSoundEffect("win");

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
    sliderUi.destroy();
    app.destroy(true);
    if (app.canvas?.parentNode === root) root.removeChild(app.canvas);
  }

  function revealDiceOutcome({ roll, label, displayValue } = {}) {
    sliderUi.revealDiceRoll({ roll, label, displayValue });
  }

  function playStartSoundIfNeeded() {
    if (!shouldPlayStartSound) return;
    playSoundEffect("gameStart");
    shouldPlayStartSound = false;
  }

  function resizeSquare() {
    const cw = Math.max(1, root.clientWidth || initialSize);
    const ch = Math.max(1, root.clientHeight || cw);
    const size = Math.floor(Math.min(cw, ch));
    app.renderer.resize(size, size);
    app.stage.hitArea = new Rectangle(0, 0, app.renderer.width, app.renderer.height);
    updateBackground();
    positionWinPopup();
    sliderUi.layout();
  }

  resizeSquare();
  setTimeout(resizeSquare, 0);

  const ro = new ResizeObserver(() => resizeSquare());
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
  };
}
