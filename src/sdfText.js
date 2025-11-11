import { BitmapFont, BitmapText } from "pixi.js";

const FONT_CACHE = new Map();
const DEFAULT_BASE_FONT_SIZE = 64;
const DEFAULT_FONT_RESOLUTION = 2;

function normalizeColor(value, fallback = 0xffffff) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }

    if (trimmed.startsWith("#")) {
      const hex = trimmed.slice(1);
      if (/^[0-9a-fA-F]{6}$/.test(hex)) {
        return parseInt(hex, 16);
      }
    }

    if (trimmed.startsWith("0x")) {
      const hex = trimmed.slice(2);
      if (/^[0-9a-fA-F]{6}$/.test(hex) || /^[0-9a-fA-F]{8}$/.test(hex)) {
        return parseInt(hex, 16);
      }
    }
  }

  return fallback;
}

function getFontCacheKey(fontFamily, fontWeight) {
  return `${fontFamily ?? ""}__${fontWeight ?? ""}`;
}

function installSdfFont({ fontFamily, fontWeight }) {
  const cacheKey = getFontCacheKey(fontFamily, fontWeight);
  if (FONT_CACHE.has(cacheKey)) {
    return FONT_CACHE.get(cacheKey);
  }

  const sanitizedIndex = FONT_CACHE.size.toString(36);
  const fontName = `sdf-font-${sanitizedIndex}`;

  BitmapFont.install({
    name: fontName,
    style: {
      fontFamily: fontFamily ?? "Arial",
      fontSize: DEFAULT_BASE_FONT_SIZE,
      fontWeight: fontWeight ?? "400",
      fill: 0xffffff,
    },
    resolution: DEFAULT_FONT_RESOLUTION,
    dynamicFill: true,
    chars: [[" ", "~"], "₿", "×"],
  });

  FONT_CACHE.set(cacheKey, fontName);
  return fontName;
}

export function createSdfText({ text = "", style = {} } = {}) {
  const installedFontFamily = installSdfFont({
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
  });

  const align = style.align ?? "left";
  const fontSize = style.fontSize ?? DEFAULT_BASE_FONT_SIZE;

  const bitmapText = new BitmapText({
    text,
    style: {
      fontFamily: installedFontFamily,
      fontSize,
      align,
      letterSpacing: style.letterSpacing,
    },
  });

  if (style.fontSize != null) {
    bitmapText.fontSize = style.fontSize;
  }

  setSdfTextColor(bitmapText, style.fill ?? 0xffffff);

  return bitmapText;
}

export function setSdfTextColor(text, color) {
  if (!text) {
    return;
  }

  text.tint = normalizeColor(color, text.tint ?? 0xffffff);
}

export function getSdfTextColor(text, fallback = 0xffffff) {
  if (!text) {
    return fallback;
  }

  return text.tint ?? fallback;
}

export function setSdfTextFontSize(text, size) {
  if (!text || typeof size !== "number" || !Number.isFinite(size)) {
    return;
  }

  text.fontSize = size;
}
