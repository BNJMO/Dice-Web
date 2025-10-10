import { createGame } from "./game.js";
import { ControlPanel } from "./controlPanel.js";

import gameStartSoundUrl from "../assets/sounds/GameStart.wav";
import winSoundUrl from "../assets/sounds/Win.wav";

let game;
let controlPanel;
const opts = {
  // Window visuals
  backgroundColor: "#0C0B0F",
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Arial",

  // Sounds
  gameStartSoundPath: gameStartSoundUrl,
  winSoundPath: winSoundUrl,

  // Win pop-up
  winPopupShowDuration: 260,
  winPopupWidth: 260,
  winPopupHeight: 200,

  // API Events Callbacks
  onWin: () => {
    game?.showWinPopup?.(24.75, "0.00000003");
    const betValue = controlPanel?.getBetValue?.() ?? 0;
    const estimatedProfit = betValue * 0.015;
    controlPanel?.setProfitValue(estimatedProfit);
    controlPanel?.setProfitOnWinDisplay?.(
      `$${estimatedProfit.toFixed(2)}`
    );
  },
  onLost: () => {},
  onStateChange: () => {},
  onSliderValueChange: (target) => {
    const winChance = Math.max(0, (100 - target) / 100);
    console.debug(
      `Main calculated win chance: ${(winChance * 100).toFixed(2)}%`
    );
  },
  onRollModeChange: (mode) => {
    console.debug(`Roll mode changed to ${mode}`);
  },
};


(async () => {
  // Initialize Control Panel
  try {
    controlPanel = new ControlPanel("#control-panel", {
      gameName: "Dice",
    });
    controlPanel.addEventListener("modechange", (event) => {
      console.debug(`Control panel mode changed to ${event.detail.mode}`);
    });
    controlPanel.addEventListener("betvaluechange", (event) => {
      console.debug(`Bet value updated to ${event.detail.value}`);
    });
    controlPanel.addEventListener("bet", () => handleBet());
    controlPanel.setBetAmountDisplay("$0.00");
    controlPanel.setProfitOnWinDisplay("$0.00");
    controlPanel.setProfitValue("0.00000000");
  } catch (err) {
    console.error("Control panel initialization failed:", err);
  }

  // Initialize Game
  try {
    game = await createGame("#game", opts);
    window.game = game;
  } catch (e) {
    console.error("Game initialization failed:", e);
    const gameDiv = document.querySelector("#game");
    if (gameDiv) {
      gameDiv.innerHTML = `
        <div style="color: #f44336; padding: 20px; background: rgba(0,0,0,0.8); border-radius: 8px;">
          <h3>❌ Game Failed to Initialize</h3>
          <p><strong>Error:</strong> ${e.message}</p>
          <p>Check console (F12) for full details.</p>
        </div>
      `;
    }
  }
})();

function handleBet() {
  const roll = Math.random() * 100;
  const winChance = Math.max(0, (100 - roll) / 100);
  console.debug(
    `Bet placed. Revealing roll ${roll.toFixed(1)} with ${(winChance * 100).toFixed(
      2
    )}% win chance.`
  );

  const betValue = controlPanel?.getBetValue?.() ?? 0;
  controlPanel?.setBetAmountDisplay?.(`$${betValue.toFixed(2)}`);
  const potentialProfit = betValue * winChance;
  controlPanel?.setProfitOnWinDisplay?.(`$${potentialProfit.toFixed(2)}`);
  controlPanel?.setProfitValue?.(potentialProfit);

  game?.revealDiceOutcome?.({ roll });
}
