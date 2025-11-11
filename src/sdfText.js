import { BitmapFont, BitmapText } from "pixi.js";

const FONT_CACHE = new Map();
const DEFAULT_BASE_FONT_SIZE = 64;
const DEFAULT_FONT_RESOLUTION = 2;
const DEFAULT_FONT_FAMILY = "Arial";

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

function stripQuotes(value) {
  if (value.length <= 1) {
    return value;
  }

  const first = value.charAt(0);
  const last = value.charAt(value.length - 1);
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}

function normalizeFontFamily(fontFamily) {
  if (Array.isArray(fontFamily)) {
    for (const entry of fontFamily) {
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        if (trimmed) {
          return stripQuotes(trimmed);
        }
      }
    }
    return DEFAULT_FONT_FAMILY;
  }

  if (typeof fontFamily === "string") {
    const parts = fontFamily.split(",");
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        return stripQuotes(trimmed);
      }
    }
  }

  if (fontFamily && typeof fontFamily === "object") {
    if (typeof fontFamily.family === "string") {
      const trimmed = fontFamily.family.trim();
      if (trimmed) {
        return stripQuotes(trimmed);
      }
    }
    if (typeof fontFamily.fontFamily === "string") {
      const trimmed = fontFamily.fontFamily.trim();
      if (trimmed) {
        return stripQuotes(trimmed);
      }
    }
  }

  return DEFAULT_FONT_FAMILY;
}

function getFontCacheKey(fontFamily, fontWeight) {
  return `${fontFamily ?? ""}__${fontWeight ?? ""}`;
}

function installSdfFont({ fontFamily, fontWeight }) {
  const normalizedFamily = normalizeFontFamily(fontFamily);
  const normalizedWeight =
    typeof fontWeight === "number"
      ? fontWeight.toString()
      : fontWeight ?? "400";
  const cacheKey = getFontCacheKey(normalizedFamily, normalizedWeight);
  if (FONT_CACHE.has(cacheKey)) {
    return FONT_CACHE.get(cacheKey);
  }

  const sanitizedIndex = FONT_CACHE.size.toString(36);
  const fontName = `sdf-font-${sanitizedIndex}`;

  BitmapFont.install({
    name: fontName,
    style: {
      fontFamily: normalizedFamily,
      fontSize: DEFAULT_BASE_FONT_SIZE,
      fontWeight: normalizedWeight,
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
