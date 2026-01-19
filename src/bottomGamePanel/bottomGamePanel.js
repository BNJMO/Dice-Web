import { Stepper } from "../stepper/stepper.js";
import multiplierIconUrl from "../../assets/sprites/MultiplierIcon.svg";
import winChanceIconUrl from "../../assets/sprites/WinChanceIcon.svg";

export function createBottomGamePanel({
  root,
  app,
  appContainerElement,
  sliderUi,
  onSliderValueChange,
  setHandleSliderChange = () => {},
}) {
  const panel = document.createElement("div");
  panel.className = "game-bottom-panel";

  const portraitMediaQuery =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 768px), (orientation: portrait)")
      : null;

  let removePortraitModeWatcher = () => {};

  function isPortraitMode() {
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

  function formatPanelValue(value, defaultFormatter, fallback = "") {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    if (isPortraitMode()) {
      const preciseValue = Number(value);
      if (Number.isFinite(preciseValue)) {
        return preciseValue.toPrecision(4);
      }
    }

    return defaultFormatter(value);
  }

  const notifySliderApplied = () => {
    try {
      const details =
        typeof sliderUi.getChangeDetails === "function"
          ? sliderUi.getChangeDetails()
          : null;
      onSliderValueChange(details);
    } catch (err) {
      console.warn("onSliderValueChange callback failed", err);
    }
  };

  function createEditableBox({
    label,
    icon,
    iconClass = "",
    step = 1,
    getValue = () => NaN,
    format = (value) => `${value ?? ""}`,
    onCommit = () => {},
    afterCommit = () => {},
    allowDecimalOnly = false,
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
    if (iconClass) {
      iconEl.classList.add(iconClass);
    }
    valueWrapper.appendChild(iconEl);

    const stepper = new Stepper({
      upAriaLabel: `Increase ${label}`,
      downAriaLabel: `Decrease ${label}`,
      onStepUp: () => {
        const current = Number(getValue());
        const next = Number.isFinite(current) ? current + step : step;
        onCommit(next);
        afterCommit(next);
        refresh(true);
      },
      onStepDown: () => {
        const current = Number(getValue());
        const next = Number.isFinite(current) ? current - step : 0;
        onCommit(next);
        afterCommit(next);
        refresh(true);
      },
    });

    valueWrapper.appendChild(stepper.element);

    const state = { editing: false };

    function sanitizeDecimalString(rawValue) {
      if (typeof rawValue !== "string") {
        return "";
      }
      let sanitized = rawValue.replace(/[^0-9.]/g, "");
      const dotIndex = sanitized.indexOf(".");
      if (dotIndex !== -1) {
        const before = sanitized.slice(0, dotIndex + 1);
        const after = sanitized.slice(dotIndex + 1).replace(/\./g, "");
        sanitized = `${before}${after}`;
      }
      return sanitized;
    }

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
        afterCommit(numeric);
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

    input.addEventListener("input", () => {
      if (!allowDecimalOnly) return;
      const raw = input.value;
      const selection = input.selectionStart ?? raw.length;
      const sanitized = sanitizeDecimalString(raw);
      if (sanitized !== raw) {
        const delta = raw.length - sanitized.length;
        input.value = sanitized;
        const newPos = Math.max(0, selection - delta);
        try {
          input.setSelectionRange(newPos, newPos);
        } catch {}
      }
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
        afterCommit(next);
        refresh(true);
      }
    });

    valueWrapper.addEventListener("click", () => input.focus());

    function setClickable(isClickable) {
      const clickable = Boolean(isClickable);
      input.disabled = !clickable;
      valueWrapper.classList.toggle("is-non-clickable", !clickable);
      stepper?.setClickable?.(clickable);
    }

    return {
      container,
      refresh,
      setClickable,
    };
  }

  function createRangeBox() {
    const container = document.createElement("div");
    container.className = "game-panel-item game-panel-item--range";

    const labelEl = document.createElement("span");
    labelEl.className = "game-panel-label";
    container.appendChild(labelEl);

    const valueWrapper = document.createElement("div");
    valueWrapper.className = "game-panel-range-row";
    container.appendChild(valueWrapper);

    let inputs = [];
    let inputStates = [];

    function sanitizeDecimalString(rawValue) {
      if (typeof rawValue !== "string") {
        return "";
      }
      let sanitized = rawValue.replace(/[^0-9.]/g, "");
      const dotIndex = sanitized.indexOf(".");
      if (dotIndex !== -1) {
        const before = sanitized.slice(0, dotIndex + 1);
        const after = sanitized.slice(dotIndex + 1).replace(/\./g, "");
        sanitized = `${before}${after}`;
      }
      return sanitized;
    }

    function getModeLabel(mode) {
      if (mode === "outside") return "Outside";
      if (mode === "between") return "Between";
      return "Inside";
    }

    function getActiveValues() {
      const values = sliderUi.getValues?.() ?? [];
      return Array.isArray(values) ? values : [];
    }

    function handleCommit(index) {
      const input = inputs[index];
      if (!input) return;
      const raw = input.value.trim();
      if (!raw) {
        refresh(true);
        return;
      }
      const numeric = Number(raw);
      if (Number.isFinite(numeric)) {
        sliderUi.setValueAt?.(index, numeric);
        notifySliderApplied();
      }
      refresh(true);
    }

    function buildInputs(mode) {
      valueWrapper.innerHTML = "";
      inputs = [];
      inputStates = [];
      const count = mode === "between" ? 4 : 2;
      const positions = Array.from({ length: count }, (_, index) => index);
      positions.forEach((index, positionIndex) => {
        const valueBox = document.createElement("div");
        valueBox.className = "game-panel-value game-panel-range-value";
        valueWrapper.appendChild(valueBox);

        const input = document.createElement("input");
        input.type = "text";
        input.className = "game-panel-input";
        input.inputMode = "decimal";
        input.spellcheck = false;
        input.autocomplete = "off";
        input.setAttribute("aria-label", `${getModeLabel(mode)} target ${index + 1}`);
        valueBox.appendChild(input);
        inputs.push(input);
        inputStates.push({ editing: false });

        input.addEventListener("focus", () => {
          inputStates[index].editing = true;
          setTimeout(() => input.select(), 0);
        });

        input.addEventListener("blur", () => {
          inputStates[index].editing = false;
          handleCommit(index);
        });

        input.addEventListener("input", () => {
          const raw = input.value;
          const selection = input.selectionStart ?? raw.length;
          const sanitized = sanitizeDecimalString(raw);
          if (sanitized !== raw) {
            const delta = raw.length - sanitized.length;
            input.value = sanitized;
            const newPos = Math.max(0, selection - delta);
            try {
              input.setSelectionRange(newPos, newPos);
            } catch {}
          }
        });

        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            inputStates[index].editing = false;
            handleCommit(index);
            input.blur();
          } else if (event.key === "Escape") {
            event.preventDefault();
            inputStates[index].editing = false;
            refresh(true);
            input.blur();
          }
        });

        if (positionIndex === count - 1) {
          return;
        }

        const separator = document.createElement("span");
        separator.className = "game-panel-separator";
        separator.textContent = "&";
        valueWrapper.appendChild(separator);

        if (mode === "between" && positionIndex === 1) {
          const spacer = document.createElement("span");
          spacer.className = "game-panel-spacer";
          valueWrapper.appendChild(spacer);
        }
      });
    }

    function refresh(force = false) {
      const mode = sliderUi.getRollMode?.() ?? "inside";
      const label = getModeLabel(mode);
      labelEl.textContent = label;
      if (!inputs.length || inputs.length !== (mode === "between" ? 4 : 2)) {
        buildInputs(mode);
      }
      const values = getActiveValues();
      inputs.forEach((input, index) => {
        if (inputStates[index]?.editing && !force) return;
        const value = values[index];
        const fallbackValue = formatPanelValue(NaN, (v) => v.toFixed(2), "0.00");
        input.value = Number.isFinite(value)
          ? formatPanelValue(value, (v) => v.toFixed(2), fallbackValue)
          : fallbackValue;
      });
    }

    function setClickable(isClickable) {
      const clickable = Boolean(isClickable);
      valueWrapper.classList.toggle("is-non-clickable", !clickable);
      inputs.forEach((input) => {
        input.disabled = !clickable;
      });
    }

    refresh(true);

    return {
      container,
      refresh,
      setClickable,
    };
  }

  const multiplierBox = createEditableBox({
    label: "Multiplier",
    icon: multiplierIconUrl,
    iconClass: "game-panel-icon--multiplier",
    step: 1,
    getValue: () => sliderUi.getMultiplier(),
    format: (value) => formatPanelValue(value, (v) => v.toFixed(4)),
    onCommit: (value) => sliderUi.setMultiplier(value),
    afterCommit: notifySliderApplied,
  });

  multiplierBox.container.classList.add("game-panel-item--multiplier");

  const rangeBox = createRangeBox();

  const winChanceBox = createEditableBox({
    label: "Win Chance",
    icon: winChanceIconUrl,
    iconClass: "game-panel-icon--win-chance",
    step: 1,
    getValue: () => sliderUi.getWinChance(),
    format: (value) => formatPanelValue(value, (v) => v.toFixed(4)),
    onCommit: (value) => sliderUi.setWinChance(value),
    afterCommit: notifySliderApplied,
    allowDecimalOnly: true,
  });

  winChanceBox.container.classList.add("game-panel-item--win-chance");

  panel.append(multiplierBox.container, rangeBox.container, winChanceBox.container);

  root.appendChild(panel);

  const SCALE_EPSILON = 0.0001;
  let appliedScale = 1;
  let lastScaledHeight = 0;
  let lastIsPortrait = isPortraitMode();

  function updateRangeLayoutVariables() {
    const mode = sliderUi.getRollMode?.() ?? "inside";
    const rangeBoxCount = mode === "between" ? 4 : 2;
    const panelBoxCount = rangeBoxCount + 2;
    panel.style.setProperty("--range-box-count", String(rangeBoxCount));
    panel.style.setProperty("--panel-box-count", String(panelBoxCount));
    panel.style.setProperty("--range-separator-count", String(rangeBoxCount - 1));
    panel.style.setProperty("--range-separator-width", "14px");
    panel.style.setProperty("--range-spacer-width", mode === "between" ? "16px" : "0px");
  }

  function layout() {
    let desiredScale = 1;

    const panelContentWidth = Number(panel.scrollWidth);
    const parentWidth = Number(
      panel.parentElement?.clientWidth ??
        panel.parentElement?.offsetWidth ??
        app?.renderer?.width ??
        0
    );
    const horizontalPadding = 40;
    const maxPanelWidth =
      Number.isFinite(parentWidth) && parentWidth > 0
        ? Math.max(0, parentWidth - horizontalPadding)
        : 0;

    if (Number.isFinite(panelContentWidth) && panelContentWidth > 0 && maxPanelWidth > 0) {
      const widthScale = Math.min(1, maxPanelWidth / panelContentWidth);
      desiredScale = Math.min(desiredScale, widthScale);
    }

    if (!Number.isFinite(desiredScale) || desiredScale <= 0) {
      desiredScale = 1;
    }

    const previousScale = appliedScale;
    appliedScale = Math.max(0, Math.min(1, desiredScale));
    const scaleChanged = Math.abs(appliedScale - previousScale) > SCALE_EPSILON;

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

    const panelHeight = Number(panel.offsetHeight);
    const scaledHeight =
      Number.isFinite(panelHeight) && panelHeight > 0 ? panelHeight : 0;
    const heightChanged = Math.abs(scaledHeight - lastScaledHeight) > 0.5;
    lastScaledHeight = scaledHeight;

    const isPortrait = isPortraitMode();
    const portraitChanged = isPortrait !== lastIsPortrait;
    lastIsPortrait = isPortrait;
    if (portraitChanged) {
      refresh(true);
    }

    updateRangeLayoutVariables();

    return scaleChanged || heightChanged || portraitChanged;
  }

  function getScaledHeight() {
    const panelHeight = Number(panel.offsetHeight);
    if (!Number.isFinite(panelHeight) || panelHeight <= 0) {
      return 0;
    }
    return panelHeight;
  }

  function refresh(force = false) {
    multiplierBox.refresh(force);
    rangeBox.refresh(force);
    winChanceBox.refresh(force);
    updateRangeLayoutVariables();
  }

  const handleSliderChange = () => {
    refresh();
    if (layout()) {
      sliderUi.layout();
    }
  };

  setHandleSliderChange(handleSliderChange);

  refresh(true);
  layout();

  const handlePortraitModeChange = () => {
    const layoutChanged = layout();
    if (!layoutChanged) {
      refresh(true);
    }
    sliderUi.layout();
  };

  if (portraitMediaQuery) {
    if (typeof portraitMediaQuery.addEventListener === "function") {
      portraitMediaQuery.addEventListener("change", handlePortraitModeChange);
      removePortraitModeWatcher = () =>
        portraitMediaQuery.removeEventListener("change", handlePortraitModeChange);
    } else if (typeof portraitMediaQuery.addListener === "function") {
      portraitMediaQuery.addListener(handlePortraitModeChange);
      removePortraitModeWatcher = () =>
        portraitMediaQuery.removeListener(handlePortraitModeChange);
    }
  }

  function setMultiplierClickable(isClickable) {
    multiplierBox?.setClickable?.(isClickable);
  }

  function setRollModeClickable(isClickable) {
    rangeBox?.setClickable?.(isClickable);
  }

  function setWinChanceClickable(isClickable) {
    winChanceBox?.setClickable?.(isClickable);
  }

  function setControlsClickable(isClickable) {
    multiplierBox?.setClickable?.(isClickable);
    rangeBox?.setClickable?.(isClickable);
    winChanceBox?.setClickable?.(isClickable);
  }

  return {
    panel,
    refresh,
    layout,
    getScaledHeight,
    setMultiplierClickable,
    setRollModeClickable,
    setWinChanceClickable,
    setControlsClickable,
    destroy: () => {
      setHandleSliderChange(() => {});
      panel.style.removeProperty("--panel-scale");
      panel.style.removeProperty("--panel-width-factor");
      appliedScale = 1;
      lastScaledHeight = 0;
      removePortraitModeWatcher?.();
      panel.remove();
    },
  };
}
