import { createGame } from "./game.js";

import gameStartSoundUrl from "../assets/sounds/GameStart.wav";
import winSoundUrl from "../assets/sounds/Win.wav";

let bombRandomPercentage = 0.15;
let game;
const opts = {
  // Window visuals
  size: 600,
  backgroundColor: "#121212",
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
  },
  onLost: () => {},
  onStateChange: () => {},
};

// Initialize game
(async () => {
  try {
    game = await createGame("#game", opts);
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

document
  .querySelector("#resetBtn")
  ?.addEventListener("click", () => game.reset());

window.game = game;
