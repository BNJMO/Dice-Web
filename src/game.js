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

const PALETTE = {
  appBg: 0x020401,
  winPopupBorder: 0xeaff00,
  winPopupBackground: 0x0f0f0f,
  winPopupMultiplierText: 0xeaff00,
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
    app.destroy(true);
    if (app.canvas?.parentNode === root) root.removeChild(app.canvas);
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
    updateBackground();
    positionWinPopup();
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
  };
}
