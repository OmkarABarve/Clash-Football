import type { GameState } from "../config/types";
import { unitDps, unitHitSpeed } from "../config/types";
import { getCardDef, isSpellDef } from "../config/cards";
import { nextCardId } from "../systems/cycle";
import { canAfford } from "../systems/economy";

export function syncHud(state: GameState): void {
  syncTimer(state);
  syncMsBar(state);
  syncHand(state);
  syncEndScreen(state);
}

function syncTimer(state: GameState): void {
  const el = document.getElementById("match-timer");
  if (!el) return;
  const total = Math.max(0, Math.ceil(state.timeLeft));
  const m = Math.floor(total / 60);
  const s = total % 60;
  el.textContent = `${m}:${s.toString().padStart(2, "0")}`;
  el.classList.toggle("overtime", state.timeLeft <= state.config.lastMinuteSeconds);
}

function syncMsBar(state: GameState): void {
  const eco = state.economy.player;
  const fill = document.getElementById("ms-fill");
  const value = document.getElementById("ms-value");
  if (fill) {
    fill.style.width = `${(eco.current / eco.max) * 100}%`;
  }
  if (value) {
    value.textContent = String(Math.floor(eco.current));
  }
}

function syncHand(state: GameState): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".card[data-slot]");
  buttons.forEach((btn) => {
    const slot = Number(btn.dataset.slot);
    const defId = state.deck.hand[slot];
    if (!defId) {
      btn.className = "card empty";
      btn.innerHTML = "";
      btn.disabled = true;
      return;
    }
    const def = getCardDef(defId);
    const affordable = canAfford(state.economy.player, def.cost);
    const selected = state.selectedId === defId;
    btn.disabled = !affordable || state.status !== "playing";
    btn.className = "card";
    if (isSpellDef(def)) btn.classList.add("spell");
    if (!affordable) btn.classList.add("unaffordable");
    if (selected) btn.classList.add("selected");

    if (isSpellDef(def)) {
      btn.innerHTML = `
        <span class="card-name">${def.name}</span>
        <span class="card-label">${def.label}</span>
        <span class="card-cost">${def.cost} M</span>
        <span class="card-stats">SPELL · Push ${def.pushTiles} tiles</span>
      `;
    } else {
      const dps = unitDps(def);
      const hit = unitHitSpeed(def);
      btn.innerHTML = `
        <span class="card-name">${def.name}</span>
        <span class="card-label">${def.label}</span>
        <span class="card-cost">${def.cost} M</span>
        <span class="card-stats">DMG ${def.damage} · Hit ${hit}s · DPS ${dps}</span>
      `;
    }
  });

  const next = document.getElementById("next-card");
  if (next) {
    const id = nextCardId(state.deck);
    if (!id) {
      next.innerHTML = `<span class="card-name">—</span>`;
      next.className = "card next empty";
    } else {
      const def = getCardDef(id);
      next.className = isSpellDef(def) ? "card next spell" : "card next";
      const stats = isSpellDef(def)
        ? `<span class="card-stats">SPELL</span>`
        : "";
      next.innerHTML = `
        <span class="next-tag">NEXT</span>
        <span class="card-name">${def.name}</span>
        <span class="card-label">${def.label}</span>
        <span class="card-cost">${def.cost} M</span>
        ${stats}
      `;
    }
  }
}

function syncEndScreen(state: GameState): void {
  const screen = document.getElementById("end-screen");
  const title = document.getElementById("end-title");
  if (!screen || !title) return;

  if (state.status === "playing") {
    screen.classList.add("hidden");
    return;
  }
  screen.classList.remove("hidden");
  title.textContent =
    state.status === "playerWin" ? "You Win!" : "You Lose";
}
