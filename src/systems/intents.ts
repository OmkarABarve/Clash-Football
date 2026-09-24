import { spawnFromCard } from "../entities/factory";
import type { GameState, Side } from "../config/types";
import { getCardDef, isSpellDef } from "../config/cards";
import { playCard, isInHand } from "./cycle";
import { canAfford, spend } from "./economy";
import { ownHalfY } from "./lanes";
import { castHighLine, castDive } from "./spells";

export function processIntents(state: GameState): void {
  if (state.intents.length === 0) return;
  const intents = state.intents.splice(0, state.intents.length);

  for (const intent of intents) {
    const def = getCardDef(intent.defId);
    const eco = state.economy[intent.side];
    if (!canAfford(eco, def.cost)) continue;

    const deck = intent.side === "player" ? state.deck : state.aiDeck;
    if (!isInHand(deck, intent.defId)) continue;

    if (isSpellDef(def)) {
      if (!isOnPitch(state, intent.x, intent.y)) continue;
      if (!spend(eco, def.cost)) continue;
      playCard(deck, intent.defId);
      if (intent.side === "player") {
        state.selectedId = null;
        state.hover = null;
      }
      if (def.spell === "highline") {
        castHighLine(state, intent.side);
      } else if (def.spell === "dive") {
        castDive(state, intent.side, intent.x, intent.y);
      }
      continue;
    }

    if (!isInOwnHalf(state, intent.side, intent.x, intent.y, deployRadiusPx(state, intent.defId))) {
      continue;
    }
    if (!spend(eco, def.cost)) continue;
    playCard(deck, intent.defId);
    if (intent.side === "player") {
      state.selectedId = null;
    }

    const units = spawnFromCard(state, intent);
    state.units.push(...units);
  }
}

export function isOnPitch(
  state: GameState,
  x: number,
  y: number,
): boolean {
  const { arena } = state.config;
  return x >= 0 && x <= arena.width && y >= 0 && y <= arena.height;
}


/** Horizontal/vertical margin used for deploy validity (walls are wide). */
export function deployRadiusPx(state: GameState, defId: string): number {
  const def = getCardDef(defId);
  if (!isSpellDef(def) && def.ability?.kind === "wall") {
    return (def.ability.widthTiles / 2) * state.config.tileSize;
  }
  if (isSpellDef(def)) return 0;
  return def.radius * state.config.tileSize;
}

export function isInOwnHalf(
  state: GameState,
  side: Side,
  x: number,
  y: number,
  radius: number,
): boolean {
  const { arena } = state.config;
  if (x < radius || x > arena.width - radius) return false;
  const { minY, maxY } = ownHalfY(state.config, side, radius);
  return y >= minY && y <= maxY;
}
