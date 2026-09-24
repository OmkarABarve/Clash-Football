import type { GameState } from "../config/types";
import { getCardDef, isSpellDef } from "../config/cards";
import { canAfford } from "./economy";
import { ownHalfY } from "./lanes";
import { livingEnemyCount } from "./spells";

export function updateAi(state: GameState, dt: number): void {
  if (state.status !== "playing") return;

  state.aiTimer -= dt;
  if (state.aiTimer > 0) return;

  rollNextTimer(state);

  const affordable = state.aiDeck.hand.filter((id) =>
    canAfford(state.economy.ai, getCardDef(id).cost),
  );
  if (affordable.length === 0) return;

  // Prefer HighLine only when there are enemies to shove; otherwise pick a troop.
  const enemies = livingEnemyCount(state, "ai");
  const candidates = affordable.filter((id) => {
    const def = getCardDef(id);
    if (isSpellDef(def) && def.spell === "highline") return enemies > 0;
    return true;
  });
  if (candidates.length === 0) return;

  const defId = candidates[Math.floor(Math.random() * candidates.length)]!;
  const def = getCardDef(defId);
  const { arena, unitRadiusDefault } = state.config;
  const margin = unitRadiusDefault + 4;
  const x = margin + Math.random() * (arena.width - margin * 2);

  let y: number;
  if (isSpellDef(def)) {
    // Spells can be “aimed” anywhere — drop mid for AI.
    y = state.config.midlineY;
  } else {
    const bounds = ownHalfY(state.config, "ai", margin);
    y = bounds.minY + Math.random() * Math.max(1, bounds.maxY - bounds.minY);
  }

  state.intents.push({ side: "ai", defId, x, y });
}

function rollNextTimer(state: GameState): void {
  const [min, max] = state.config.aiInterval;
  state.aiTimer = min + Math.random() * (max - min);
}
