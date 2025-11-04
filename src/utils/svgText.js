import { Point } from "pixi.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function toCssColor(value, fallback = "#ffffff") {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = (value >>> 0) & 0xffffff;
    return `#${normalized.toString(16).padStart(6, "0")}`;
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
}

export function createSvgOverlay(root, { className = "game-svg-overlay" } = {}) {
  if (!root) {
    throw new Error("createSvgOverlay requires a mount element");
  }
  const overlay = document.createElementNS(SVG_NS, "svg");
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("focusable", "false");
  overlay.setAttribute("viewBox", "0 0 1 1");
  overlay.style.position = "absolute";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.pointerEvents = "none";
  overlay.style.overflow = "visible";
  overlay.classList.add(className);
  root.appendChild(overlay);
  return overlay;
}

export function updateSvgOverlaySize(overlay, width, height) {
  if (!overlay) {
    return;
  }
  const normalizedWidth = Math.max(1, Math.floor(width || 1));
  const normalizedHeight = Math.max(1, Math.floor(height || 1));
  overlay.setAttribute("viewBox", `0 0 ${normalizedWidth} ${normalizedHeight}`);
  overlay.setAttribute("width", `${normalizedWidth}`);
  overlay.setAttribute("height", `${normalizedHeight}`);
}

export function createSvgText(overlay, {
  text = "",
  className,
  fill = "#ffffff",
  fontFamily,
  fontSize,
  fontWeight,
  anchor = "start",
  baseline = "baseline",
  localX = 0,
  localY = 0,
} = {}) {
  if (!overlay) {
    throw new Error("createSvgText requires an SVG overlay element");
  }
  const element = document.createElementNS(SVG_NS, "text");
  element.textContent = `${text}`;
  element.setAttribute("text-anchor", anchor);
  element.setAttribute("dominant-baseline", baseline);
  element.setAttribute("fill", toCssColor(fill));
  element.style.userSelect = "none";
  element.style.pointerEvents = "none";
  if (className) {
    element.classList.add(className);
  }
  if (fontFamily) {
    element.style.fontFamily = fontFamily;
  }
  if (fontWeight) {
    element.style.fontWeight = fontWeight;
  }
  if (fontSize) {
    element.style.fontSize = `${fontSize}px`;
  }
  overlay.appendChild(element);

  const localPoint = new Point(localX, localY);
  const globalPoint = new Point();

  function sync(displayObject, point = localPoint) {
    if (!displayObject || typeof displayObject.toGlobal !== "function") {
      return;
    }
    let targetPoint = point;
    if (!(point instanceof Point)) {
      targetPoint = localPoint;
      if (point && typeof point.x === "number" && typeof point.y === "number") {
        localPoint.set(point.x, point.y);
        targetPoint = localPoint;
      }
    }
    const { x, y } = displayObject.toGlobal(targetPoint, globalPoint);
    element.setAttribute("x", `${x}`);
    element.setAttribute("y", `${y}`);
  }

  return {
    element,
    sync,
    setText(value) {
      element.textContent = `${value ?? ""}`;
    },
    setFill(value) {
      element.setAttribute("fill", toCssColor(value, element.getAttribute("fill") || "#ffffff"));
    },
    setFontFamily(value) {
      if (value) {
        element.style.fontFamily = value;
      }
    },
    setFontWeight(value) {
      if (value) {
        element.style.fontWeight = value;
      }
    },
    setFontSize(value) {
      if (Number.isFinite(value) && value > 0) {
        element.style.fontSize = `${value}px`;
      }
    },
    setOpacity(value) {
      if (Number.isFinite(value)) {
        const clamped = Math.max(0, Math.min(1, value));
        element.style.opacity = `${clamped}`;
      } else {
        element.style.removeProperty("opacity");
      }
    },
    setAnchor(value) {
      if (value) {
        element.setAttribute("text-anchor", value);
      }
    },
    setBaseline(value) {
      if (value) {
        element.setAttribute("dominant-baseline", value);
      }
    },
    setLocalPoint(x, y) {
      if (Number.isFinite(x)) {
        localPoint.x = x;
      }
      if (Number.isFinite(y)) {
        localPoint.y = y;
      }
    },
    destroy() {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    },
  };
}
