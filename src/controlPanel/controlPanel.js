import { Stepper } from "../stepper/stepper.js";
import bitcoinIconUrl from "../../assets/sprites/BitCoin.png";
import infinityIconUrl from "../../assets/sprites/Infinity.png";
import percentageIconUrl from "../../assets/sprites/Percentage.png";

function resolveMount(mount) {
  if (!mount) {
    throw new Error("Control panel mount target is required");
  }
  if (typeof mount === "string") {
    const element = document.querySelector(mount);
    if (!element) {
      throw new Error(`Control panel mount '${mount}' not found`);
    }
    return element;
  }
  return mount;
}

function clampToZero(value) {
  return Math.max(0, value);
}

function clampToInfinity(value) {
  if (value === Infinity) return Infinity;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.floor(numeric));
}

export class ControlPanel extends EventTarget {
  constructor(mount, options = {}) {
    super();
    this.options = {
      betAmountLabel: options.betAmountLabel ?? "Bet Amount",
      profitOnWinLabel: options.profitOnWinLabel ?? "Profit on Win",
      initialBetValue: options.initialBetValue ?? "0.00000000",
      initialBetAmountDisplay: options.initialBetAmountDisplay ?? "$0.00",
      initialProfitOnWinDisplay: options.initialProfitOnWinDisplay ?? "$0.00",
      initialProfitValue: options.initialProfitValue ?? "0.00000000",
      initialMode: options.initialMode ?? "manual",
      gameName: options.gameName ?? "Game Name",
    };

    this.host = resolveMount(mount);
    this.host.innerHTML = "";

    this.mode = this.options.initialMode === "auto" ? "auto" : "manual";

    this.betButtonMode = "bet";
    this.betButtonState = "clickable";
    this.autoStartButtonState = "non-clickable";
    this.autoStartButtonMode = "start";

    this.isAdvancedEnabled = false;
    this.onWinMode = "reset";
    this.onLossMode = "reset";
    this.strategyControlsNonClickable = false;

    this.container = document.createElement("div");
    this.container.className = "control-panel";
    this.host.appendChild(this.container);

    this.scrollContainer = document.createElement("div");
    this.scrollContainer.className = "control-panel-scroll";
    this.container.appendChild(this.scrollContainer);

    this.buildToggle();
    this.buildBetAmountDisplay();
    this.buildBetControls();
    this.buildModeSections();
    this.buildGameName();

    this.setBetAmountDisplay(this.options.initialBetAmountDisplay);
    this.setProfitOnWinDisplay(this.options.initialProfitOnWinDisplay);
    this.setProfitValue(this.options.initialProfitValue);
    this.setBetInputValue(this.options.initialBetValue, { emit: false });
    this.updateModeButtons();
    this.updateModeSections();
    this.updateAdvancedVisibility();
    this.updateNumberOfBetsIcon();
    this.updateOnWinMode();
    this.updateOnLossMode();

    this.setupResponsiveLayout();
  }

  buildToggle() {
    this.toggleWrapper = document.createElement("div");
    this.toggleWrapper.className = "control-toggle";

    this.manualButton = document.createElement("button");
    this.manualButton.type = "button";
    this.manualButton.className = "control-toggle-btn";
    this.manualButton.textContent = "Manual";
    this.manualButton.addEventListener("click", () => this.setMode("manual"));

    this.autoButton = document.createElement("button");
    this.autoButton.type = "button";
    this.autoButton.className = "control-toggle-btn";
    this.autoButton.textContent = "Auto";
    this.autoButton.addEventListener("click", () => this.setMode("auto"));

    this.toggleWrapper.append(this.manualButton, this.autoButton);
    this.scrollContainer.appendChild(this.toggleWrapper);
  }

  buildBetAmountDisplay() {
    const row = document.createElement("div");
    row.className = "control-row";

    const label = document.createElement("span");
    label.className = "control-row-label";
    label.textContent = this.options.betAmountLabel;
    row.appendChild(label);

    this.betAmountValue = document.createElement("span");
    this.betAmountValue.className = "control-row-value";
    row.appendChild(this.betAmountValue);

    this.scrollContainer.appendChild(row);
  }

  buildBetControls() {
    this.betBox = document.createElement("div");
    this.betBox.className = "control-bet-box";

    this.betInputWrapper = document.createElement("div");
    this.betInputWrapper.className = "control-bet-input-field has-stepper";
    this.betBox.appendChild(this.betInputWrapper);

    this.betInput = document.createElement("input");
    this.betInput.type = "text";
    this.betInput.inputMode = "decimal";
    this.betInput.spellcheck = false;
    this.betInput.autocomplete = "off";
    this.betInput.setAttribute("aria-label", this.options.betAmountLabel);
    this.betInput.className = "control-bet-input";
    this.betInput.addEventListener("input", () => this.dispatchBetValueChange());
    this.betInput.addEventListener("blur", () => {
      this.setBetInputValue(this.betInput.value);
    });
    this.betInputWrapper.appendChild(this.betInput);

    const icon = document.createElement("img");
    icon.src = bitcoinIconUrl;
    icon.alt = "";
    icon.className = "control-bet-input-icon";
    this.betInputWrapper.appendChild(icon);

    this.betStepper = new Stepper({
      onStepUp: () => this.adjustBetValue(1e-8),
      onStepDown: () => this.adjustBetValue(-1e-8),
      upAriaLabel: "Increase bet amount",
      downAriaLabel: "Decrease bet amount",
    });
    this.betInputWrapper.appendChild(this.betStepper.element);

    this.halfButton = document.createElement("button");
    this.halfButton.type = "button";
    this.halfButton.className = "control-bet-action";
    this.halfButton.textContent = "½";
    this.halfButton.setAttribute("aria-label", "Halve bet value");
    this.halfButton.addEventListener("click", () => this.scaleBetValue(0.5));

    this.doubleButton = document.createElement("button");
    this.doubleButton.type = "button";
    this.doubleButton.className = "control-bet-action";
    this.doubleButton.textContent = "2×";
    this.doubleButton.setAttribute("aria-label", "Double bet value");
    this.doubleButton.addEventListener("click", () => this.scaleBetValue(2));

    const separator = document.createElement("div");
    separator.className = "control-bet-separator";

    this.betBox.append(
      this.betInputWrapper,
      this.halfButton,
      separator,
      this.doubleButton
    );
    this.scrollContainer.appendChild(this.betBox);
  }

  buildModeSections() {
    this.manualSection = document.createElement("div");
    this.manualSection.className =
      "control-mode-section control-mode-section--manual";
    this.scrollContainer.appendChild(this.manualSection);

    this.buildBetButton();
    this.buildProfitOnWinDisplay();
    this.buildProfitDisplay();

    this.autoSection = document.createElement("div");
    this.autoSection.className = "control-mode-section control-mode-section--auto";
    this.scrollContainer.appendChild(this.autoSection);

    this.buildAutoControls();
  }

  buildBetButton() {
    this.betButton = document.createElement("button");
    this.betButton.type = "button";
    this.betButton.id = "betBtn";
    this.betButton.className = "control-bet-btn";
    this.betButton.textContent = "Bet";
    this.betButton.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("bet"));
    });
    this.manualSection.appendChild(this.betButton);
  }

  createSectionLabel(text) {
    const label = document.createElement("div");
    label.className = "control-section-label";
    label.textContent = text;
    return label;
  }

  createSwitchButton({ onToggle }) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "control-switch";
    button.setAttribute("aria-pressed", "false");

    const handle = document.createElement("span");
    handle.className = "control-switch-handle";
    button.appendChild(handle);

    button.addEventListener("click", () => {
      const isActive = button.classList.toggle("is-on");
      button.setAttribute("aria-pressed", String(isActive));
      onToggle?.(isActive);
    });

    return button;
  }

  createAdvancedStrategyRow(key) {
    const row = document.createElement("div");
    row.className = "auto-advanced-strategy-row";

    const toggle = document.createElement("div");
    toggle.className = "auto-mode-toggle";

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "auto-mode-toggle-btn is-reset";
    resetButton.textContent = "Reset";

    const increaseButton = document.createElement("button");
    increaseButton.type = "button";
    increaseButton.className = "auto-mode-toggle-btn";
    increaseButton.textContent = "Increase by:";

    toggle.append(resetButton, increaseButton);
    row.appendChild(toggle);

    const field = document.createElement("div");
    field.className = "control-bet-input-field auto-advanced-input";
    row.appendChild(field);

    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.className = "control-bet-input";
    input.value = "0";
    field.appendChild(input);

    const icon = document.createElement("img");
    icon.src = percentageIconUrl;
    icon.alt = "";
    icon.className = "control-bet-input-icon auto-percentage-icon";
    field.appendChild(icon);

    if (key === "win") {
      this.onWinResetButton = resetButton;
      this.onWinIncreaseButton = increaseButton;
      this.onWinInput = input;
      this.onWinField = field;
    } else {
      this.onLossResetButton = resetButton;
      this.onLossIncreaseButton = increaseButton;
      this.onLossInput = input;
      this.onLossField = field;
    }

    resetButton.addEventListener("click", () => {
      this.setStrategyMode(key, "reset");
    });
    increaseButton.addEventListener("click", () => {
      this.setStrategyMode(key, "increase");
    });

    input.addEventListener("input", () => {
      this.dispatchStrategyValueChange(key, input.value);
    });
    input.addEventListener("blur", () => {
      this.dispatchStrategyValueChange(key, input.value);
    });

    return row;
  }

  createCurrencyField() {
    const wrapper = document.createElement("div");
    wrapper.className = "control-bet-input-field auto-currency-field";

    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.className = "control-bet-input";
    input.value = "0";
    wrapper.appendChild(input);

    const icon = document.createElement("img");
    icon.src = bitcoinIconUrl;
    icon.alt = "";
    icon.className = "control-bet-input-icon";
    wrapper.appendChild(icon);

    return { wrapper, input };
  }

  buildAutoControls() {
    this.autoNumberOfBetsLabel = this.createSectionLabel("Number of Bets");
    this.autoSection.appendChild(this.autoNumberOfBetsLabel);

    this.autoNumberOfBetsField = document.createElement("div");
    this.autoNumberOfBetsField.className =
      "control-bet-input-field auto-number-field has-stepper";
    this.autoSection.appendChild(this.autoNumberOfBetsField);

    this.autoNumberOfBetsInput = document.createElement("input");
    this.autoNumberOfBetsInput.type = "text";
    this.autoNumberOfBetsInput.inputMode = "numeric";
    this.autoNumberOfBetsInput.autocomplete = "off";
    this.autoNumberOfBetsInput.spellcheck = false;
    this.autoNumberOfBetsInput.className = "control-bet-input auto-number-input";
    this.autoNumberOfBetsInput.value = "0";
    this.autoNumberOfBetsInput.addEventListener("input", () => {
      this.sanitizeNumberOfBets();
      this.updateNumberOfBetsIcon();
      this.dispatchNumberOfBetsChange();
    });
    this.autoNumberOfBetsInput.addEventListener("blur", () => {
      this.sanitizeNumberOfBets();
      this.updateNumberOfBetsIcon();
      this.dispatchNumberOfBetsChange();
    });
    this.autoNumberOfBetsField.appendChild(this.autoNumberOfBetsInput);

    this.autoNumberOfBetsInfinityIcon = document.createElement("img");
    this.autoNumberOfBetsInfinityIcon.src = infinityIconUrl;
    this.autoNumberOfBetsInfinityIcon.alt = "";
    this.autoNumberOfBetsInfinityIcon.className = "auto-number-infinity";
    this.autoNumberOfBetsField.appendChild(this.autoNumberOfBetsInfinityIcon);

    this.autoNumberOfBetsStepper = new Stepper({
      onStepUp: () => this.incrementNumberOfBets(1),
      onStepDown: () => this.incrementNumberOfBets(-1),
      upAriaLabel: "Increase number of bets",
      downAriaLabel: "Decrease number of bets",
    });
    this.autoNumberOfBetsField.appendChild(this.autoNumberOfBetsStepper.element);

    this.autoAdvancedHeader = document.createElement("div");
    this.autoAdvancedHeader.className = "auto-advanced-header";
    this.autoSection.appendChild(this.autoAdvancedHeader);

    this.autoAdvancedLabel = this.createSectionLabel("Advanced");
    this.autoAdvancedLabel.classList.add("auto-advanced-label");
    this.autoAdvancedHeader.appendChild(this.autoAdvancedLabel);

    this.autoAdvancedToggle = this.createSwitchButton({
      onToggle: (isActive) => {
        this.isAdvancedEnabled = Boolean(isActive);
        this.updateAdvancedVisibility();
      },
    });
    this.autoAdvancedHeader.appendChild(this.autoAdvancedToggle);

    this.autoAdvancedContent = document.createElement("div");
    this.autoAdvancedContent.className = "auto-advanced-content";
    this.autoSection.appendChild(this.autoAdvancedContent);

    this.autoAdvancedContent.appendChild(this.createSectionLabel("On Win"));
    const onWinRow = this.createAdvancedStrategyRow("win");
    this.autoAdvancedContent.appendChild(onWinRow);

    this.autoAdvancedContent.appendChild(this.createSectionLabel("On Loss"));
    const onLossRow = this.createAdvancedStrategyRow("loss");
    this.autoAdvancedContent.appendChild(onLossRow);

    const profitRow = document.createElement("div");
    profitRow.className = "auto-advanced-summary-row";
    const profitLabel = document.createElement("span");
    profitLabel.className = "auto-advanced-summary-label";
    profitLabel.textContent = "Stop on Profit";
    const profitValue = document.createElement("span");
    profitValue.className = "auto-advanced-summary-value";
    profitValue.textContent = "$0.00";
    profitRow.append(profitLabel, profitValue);
    this.autoAdvancedContent.appendChild(profitRow);

    this.autoStopOnProfitField = this.createCurrencyField();
    this.autoAdvancedContent.appendChild(this.autoStopOnProfitField.wrapper);
    this.autoStopOnProfitField.input.addEventListener("input", () => {
      this.dispatchStopOnProfitChange(this.autoStopOnProfitField.input.value);
    });
    this.autoStopOnProfitField.input.addEventListener("blur", () => {
      this.dispatchStopOnProfitChange(this.autoStopOnProfitField.input.value);
    });

    const lossRow = document.createElement("div");
    lossRow.className = "auto-advanced-summary-row";
    const lossLabel = document.createElement("span");
    lossLabel.className = "auto-advanced-summary-label";
    lossLabel.textContent = "Stop on Loss";
    const lossValue = document.createElement("span");
    lossValue.className = "auto-advanced-summary-value";
    lossValue.textContent = "$0.00";
    lossRow.append(lossLabel, lossValue);
    this.autoAdvancedContent.appendChild(lossRow);

    this.autoStopOnLossField = this.createCurrencyField();
    this.autoAdvancedContent.appendChild(this.autoStopOnLossField.wrapper);
    this.autoStopOnLossField.input.addEventListener("input", () => {
      this.dispatchStopOnLossChange(this.autoStopOnLossField.input.value);
    });
    this.autoStopOnLossField.input.addEventListener("blur", () => {
      this.dispatchStopOnLossChange(this.autoStopOnLossField.input.value);
    });

    this.autoStartButton = document.createElement("button");
    this.autoStartButton.type = "button";
    this.autoStartButton.className =
      "control-bet-btn control-start-autobet-btn";
    this.autoStartButton.textContent = "Start Autobet";
    this.autoStartButton.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("startautobet"));
    });

    this.autoSection.appendChild(this.autoStartButton);

    this.setAutoStartButtonState(this.autoStartButtonState);
  }

  buildProfitOnWinDisplay() {
    const row = document.createElement("div");
    row.className = "control-row";

    this.profitOnWinLabel = document.createElement("span");
    this.profitOnWinLabel.className = "control-row-label";
    this.profitOnWinLabel.textContent = this.options.profitOnWinLabel;
    row.appendChild(this.profitOnWinLabel);

    this.profitOnWinValue = document.createElement("span");
    this.profitOnWinValue.className = "control-row-value";
    row.appendChild(this.profitOnWinValue);

    this.manualSection.appendChild(row);
  }

  buildProfitDisplay() {
    this.profitBox = document.createElement("div");
    this.profitBox.className = "control-profit-box";

    this.profitValue = document.createElement("span");
    this.profitValue.className = "control-profit-value";
    this.profitBox.appendChild(this.profitValue);

    const icon = document.createElement("img");
    icon.src = bitcoinIconUrl;
    icon.alt = "";
    icon.className = "control-profit-icon";
    this.profitBox.appendChild(icon);

    this.manualSection.appendChild(this.profitBox);
  }

  buildGameName() {
    this.gameName = document.createElement("div");
    this.gameName.className = "control-game-name";
    this.gameName.textContent = this.options.gameName;
    this.container.appendChild(this.gameName);
  }

  setMode(mode) {
    const normalized = mode === "auto" ? "auto" : "manual";
    if (this.mode === normalized) {
      return;
    }
    this.mode = normalized;
    this.updateModeButtons();
    this.updateModeSections();
    this.dispatchEvent(new CustomEvent("modechange", { detail: { mode: this.mode } }));
  }

  updateModeButtons() {
    if (!this.manualButton || !this.autoButton) return;
    this.manualButton.classList.toggle("is-active", this.mode === "manual");
    this.autoButton.classList.toggle("is-active", this.mode === "auto");
  }

  updateModeSections() {
    if (this.manualSection) {
      this.manualSection.style.display = this.mode === "manual" ? "flex" : "none";
    }
    if (this.autoSection) {
      this.autoSection.style.display = this.mode === "auto" ? "flex" : "none";
    }
  }

  setupResponsiveLayout() {
    const resizeObserver = new ResizeObserver(() => {
      const isCompact = window.innerWidth <= 768;
      this.container.classList.toggle("is-compact", isCompact);
    });
    resizeObserver.observe(document.body);
  }

  adjustBetValue(delta) {
    const current = this.getBetValue();
    const next = clampToZero(current + delta);
    this.setBetInputValue(next);
  }

  scaleBetValue(factor) {
    const current = this.getBetValue();
    const next = clampToZero(current * factor);
    this.setBetInputValue(next);
  }

  setBetInputValue(value, { emit = true } = {}) {
    const formatted = this.formatBetValue(value);
    this.betInput.value = formatted;
    if (emit) {
      this.dispatchBetValueChange(formatted);
    }
    return formatted;
  }

  formatBetValue(value) {
    const numeric = Number(this.parseBetValue(value));
    if (!Number.isFinite(numeric)) {
      return "0.00000000";
    }
    return clampToZero(numeric).toFixed(8);
  }

  parseBetValue(value) {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value !== "string") {
      return 0;
    }
    const sanitized = value.replace(/[^0-9.\-]+/g, "");
    const numeric = Number(sanitized);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  dispatchBetValueChange(value = this.betInput.value) {
    this.dispatchEvent(
      new CustomEvent("betvaluechange", {
        detail: { value: value, numericValue: this.getBetValue() },
      })
    );
  }

  sanitizeNumberOfBets() {
    const raw = this.autoNumberOfBetsInput.value.trim();
    if (!raw) {
      this.autoNumberOfBetsInput.value = "0";
      return;
    }
    if (/^[+\-]?\d+$/.test(raw)) {
      return;
    }
    this.autoNumberOfBetsInput.value = String(
      clampToInfinity(this.autoNumberOfBetsInput.value)
    );
  }

  incrementNumberOfBets(delta) {
    const current = this.getNumberOfBetsValue();
    if (!Number.isFinite(current)) {
      this.autoNumberOfBetsInput.value = "0";
      this.dispatchNumberOfBetsChange();
      return;
    }
    const next = clampToInfinity(current + delta);
    this.autoNumberOfBetsInput.value = String(next);
    this.updateNumberOfBetsIcon();
    this.dispatchNumberOfBetsChange();
  }

  updateNumberOfBetsIcon() {
    if (!this.autoNumberOfBetsInfinityIcon) return;
    const value = this.getNumberOfBetsValue();
    const isInfinite = !Number.isFinite(value) || value <= 0;
    this.autoNumberOfBetsInfinityIcon.classList.toggle("is-active", isInfinite);
  }

  setStrategyMode(key, mode) {
    const normalized = mode === "increase" ? "increase" : "reset";
    if (key === "win") {
      this.onWinMode = normalized;
      this.updateOnWinMode();
    } else {
      this.onLossMode = normalized;
      this.updateOnLossMode();
    }
    this.dispatchStrategyModeChange(key);
  }

  updateOnWinMode() {
    this.updateStrategyButtons(
      this.onWinMode,
      this.onWinResetButton,
      this.onWinIncreaseButton,
      this.onWinInput,
      this.onWinField
    );
  }

  updateOnLossMode() {
    this.updateStrategyButtons(
      this.onLossMode,
      this.onLossResetButton,
      this.onLossIncreaseButton,
      this.onLossInput,
      this.onLossField
    );
  }

  updateStrategyButtons(mode, resetButton, increaseButton, input, field) {
    if (!resetButton || !increaseButton || !input || !field) return;
    const isIncrease = mode === "increase";
    const controlsNonClickable = Boolean(this.strategyControlsNonClickable);
    resetButton.classList.toggle("is-active", !isIncrease);
    increaseButton.classList.toggle("is-active", isIncrease);
    resetButton.disabled = controlsNonClickable;
    increaseButton.disabled = controlsNonClickable;
    const allowInput = !controlsNonClickable && isIncrease;
    input.disabled = !allowInput;
    field.classList.toggle("is-non-clickable", !allowInput);
  }

  updateAdvancedVisibility() {
    const isActive = this.isAdvancedEnabled;
    this.autoAdvancedContent?.classList.toggle("is-collapsed", !isActive);
    this.autoAdvancedToggle?.classList.toggle("is-on", isActive);
    this.autoAdvancedToggle?.setAttribute("aria-pressed", String(isActive));
  }

  dispatchNumberOfBetsChange() {
    this.dispatchEvent(
      new CustomEvent("numberofbetschange", {
        detail: { value: this.getNumberOfBetsValue() },
      })
    );
  }

  dispatchStrategyModeChange(key) {
    const mode = key === "win" ? this.onWinMode : this.onLossMode;
    this.dispatchEvent(
      new CustomEvent("strategychange", {
        detail: { key: key === "win" ? "win" : "loss", mode },
      })
    );
  }

  dispatchStrategyValueChange(key, value) {
    this.dispatchEvent(
      new CustomEvent("strategyvaluechange", {
        detail: { key: key === "win" ? "win" : "loss", value },
      })
    );
  }

  dispatchStopOnProfitChange(value) {
    this.dispatchEvent(
      new CustomEvent("stoponprofitchange", {
        detail: { value },
      })
    );
  }

  dispatchStopOnLossChange(value) {
    this.dispatchEvent(
      new CustomEvent("stoponlosschange", {
        detail: { value },
      })
    );
  }

  getBetValue() {
    const numeric = Number(this.formatBetValue(this.betInput.value));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  getNumberOfBetsValue() {
    const parsed = clampToInfinity(this.autoNumberOfBetsInput.value);
    if (!parsed || parsed <= 0) {
      return Infinity;
    }
    return parsed;
  }

  getOnWinStrategy() {
    return {
      mode: this.onWinMode,
      value: this.onWinInput?.value ?? "0",
    };
  }

  getOnLossStrategy() {
    return {
      mode: this.onLossMode,
      value: this.onLossInput?.value ?? "0",
    };
  }

  getStopOnProfitValue() {
    return this.autoStopOnProfitField?.input?.value ?? "0";
  }

  getStopOnLossValue() {
    return this.autoStopOnLossField?.input?.value ?? "0";
  }

  setBetAmountDisplay(value) {
    if (this.betAmountValue) {
      this.betAmountValue.textContent = value;
    }
  }

  setProfitOnWinDisplay(value) {
    if (this.profitOnWinValue) {
      this.profitOnWinValue.textContent = value;
    }
  }

  setProfitValue(value) {
    if (!this.profitValue) return;
    if (Number.isFinite(Number(value))) {
      const numeric = Number(value);
      this.profitValue.textContent = clampToZero(numeric).toFixed(8);
    } else if (typeof value === "string") {
      this.profitValue.textContent = value;
    } else {
      this.profitValue.textContent = "0.00000000";
    }
  }

  setGameName(name) {
    if (this.gameName) {
      this.gameName.textContent = name;
    }
  }

  getMode() {
    return this.mode;
  }

  setBetButtonMode(mode) {
    if (!this.betButton) return;
    const normalized = mode === "cashout" ? "cashout" : "bet";
    this.betButtonMode = normalized;
    this.betButton.textContent =
      normalized === "cashout" ? "Cashout" : "Bet";
    this.betButton.dataset.mode = normalized;
  }

  setBetButtonState(state) {
    if (!this.betButton) return;
    const normalized =
      state === "clickable" || state === true || state === "enabled"
        ? "clickable"
        : "non-clickable";
    this.betButtonState = normalized;
    const isClickable = normalized === "clickable";
    this.betButton.disabled = !isClickable;
    this.betButton.classList.toggle("is-non-clickable", !isClickable);
  }

  setAutoStartButtonState(state) {
    if (!this.autoStartButton) return;
    const normalized =
      state === "clickable" || state === true || state === "enabled"
        ? "clickable"
        : "non-clickable";
    this.autoStartButtonState = normalized;
    const isClickable = normalized === "clickable";
    this.autoStartButton.disabled = !isClickable;
    this.autoStartButton.classList.toggle("is-non-clickable", !isClickable);
  }

  setAutoStartButtonMode(mode) {
    if (!this.autoStartButton) return;
    const normalized =
      mode === "stop" ? "stop" : mode === "finish" ? "finish" : "start";
    this.autoStartButtonMode = normalized;
    this.autoStartButton.textContent =
      normalized === "stop"
        ? "Stop Autobet"
        : normalized === "finish"
        ? "Finish Bet"
        : "Start Autobet";
    this.autoStartButton.dataset.mode = normalized;
  }

  setModeToggleClickable(isClickable) {
    const clickable = Boolean(isClickable);
    if (this.manualButton) {
      this.manualButton.disabled = !clickable;
      this.manualButton.classList.toggle("is-non-clickable", !clickable);
    }
    if (this.autoButton) {
      this.autoButton.disabled = !clickable;
      this.autoButton.classList.toggle("is-non-clickable", !clickable);
    }
  }

  setBetControlsClickable(isClickable) {
    const clickable = Boolean(isClickable);
    if (this.betInput) {
      this.betInput.disabled = !clickable;
    }
    if (this.betBox) {
      this.betBox.classList.toggle("is-non-clickable", !clickable);
    }
    if (this.halfButton) {
      this.halfButton.disabled = !clickable;
      this.halfButton.classList.toggle("is-non-clickable", !clickable);
    }
    if (this.doubleButton) {
      this.doubleButton.disabled = !clickable;
      this.doubleButton.classList.toggle("is-non-clickable", !clickable);
    }
  }

  setNumberOfBetsClickable(isClickable) {
    const clickable = Boolean(isClickable);
    this.autoNumberOfBetsInput.disabled = !clickable;
    this.autoNumberOfBetsField.classList.toggle("is-non-clickable", !clickable);
    const buttons = this.autoNumberOfBetsStepper
      ? [
          this.autoNumberOfBetsStepper.upButton,
          this.autoNumberOfBetsStepper.downButton,
        ]
      : [];
    buttons.forEach((btn) => {
      if (btn) {
        btn.disabled = !clickable;
        btn.classList.toggle("is-non-clickable", !clickable);
      }
    });
  }

  setAdvancedToggleClickable(isClickable) {
    const clickable = Boolean(isClickable);
    this.autoAdvancedToggle.disabled = !clickable;
    this.autoAdvancedToggle.classList.toggle("is-non-clickable", !clickable);
  }

  setAdvancedStrategyControlsClickable(isClickable) {
    this.strategyControlsNonClickable = !isClickable;
    this.updateOnWinMode();
    this.updateOnLossMode();
  }

  setStopOnProfitClickable(isClickable) {
    const clickable = Boolean(isClickable);
    if (this.autoStopOnProfitField) {
      this.autoStopOnProfitField.input.disabled = !clickable;
      this.autoStopOnProfitField.wrapper.classList.toggle(
        "is-non-clickable",
        !clickable
      );
    }
  }

  setStopOnLossClickable(isClickable) {
    const clickable = Boolean(isClickable);
    if (this.autoStopOnLossField) {
      this.autoStopOnLossField.input.disabled = !clickable;
      this.autoStopOnLossField.wrapper.classList.toggle(
        "is-non-clickable",
        !clickable
      );
    }
  }

  setNumberOfBetsValue(value, { emit = false } = {}) {
    if (!this.autoNumberOfBetsInput) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      this.autoNumberOfBetsInput.value = "0";
    } else {
      this.autoNumberOfBetsInput.value = String(Math.floor(numeric));
    }
    this.updateNumberOfBetsIcon();
    if (emit) {
      this.dispatchNumberOfBetsChange();
    }
  }

  setStopOnProfitValue(value, { emit = false } = {}) {
    if (!this.autoStopOnProfitField) return;
    this.autoStopOnProfitField.input.value = `${value ?? "0"}`;
    if (emit) {
      this.dispatchStopOnProfitChange(this.autoStopOnProfitField.input.value);
    }
  }

  setStopOnLossValue(value, { emit = false } = {}) {
    if (!this.autoStopOnLossField) return;
    this.autoStopOnLossField.input.value = `${value ?? "0"}`;
    if (emit) {
      this.dispatchStopOnLossChange(this.autoStopOnLossField.input.value);
    }
  }

  setStrategyMode(key, mode, { emit = false } = {}) {
    const normalized = mode === "increase" ? "increase" : "reset";
    if (key === "win") {
      this.onWinMode = normalized;
      this.updateOnWinMode();
      if (emit) {
        this.dispatchStrategyModeChange("win");
      }
    } else {
      this.onLossMode = normalized;
      this.updateOnLossMode();
      if (emit) {
        this.dispatchStrategyModeChange("loss");
      }
    }
  }

  setStrategyValue(key, value, { emit = false } = {}) {
    if (key === "win") {
      if (this.onWinInput) {
        this.onWinInput.value = `${value ?? "0"}`;
        if (emit) {
          this.dispatchStrategyValueChange("win", this.onWinInput.value);
        }
      }
    } else {
      if (this.onLossInput) {
        this.onLossInput.value = `${value ?? "0"}`;
        if (emit) {
          this.dispatchStrategyValueChange("loss", this.onLossInput.value);
        }
      }
    }
  }
}
