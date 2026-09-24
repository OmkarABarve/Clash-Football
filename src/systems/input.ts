import type { GameState } from "../config/types";
import { getCardDef, isSpellDef } from "../config/cards";
import { canAfford } from "./economy";
import { isInOwnHalf, isOnPitch } from "./intents";
import { restartMatch } from "./match";

export type CanvasMapper = {
  toWorld: (clientX: number, clientY: number) => { x: number; y: number } | null;
};

export function wireInput(
  stateRef: { current: GameState },
  canvas: HTMLCanvasElement,
  mapper: CanvasMapper,
  onRestart: () => void,
): () => void {
  const onCardClick = (e: Event) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const slot = Number(btn.dataset.slot);
    const state = stateRef.current;
    if (state.status !== "playing") return;
    const defId = state.deck.hand[slot];
    if (!defId) return;
    const def = getCardDef(defId);
    if (!canAfford(state.economy.player, def.cost)) return;
    if (state.selectedId === defId) {
      state.selectedId = null;
      state.hover = null;
    } else {
      state.selectedId = defId;
    }
  };

  const cards = document.querySelectorAll<HTMLButtonElement>(".card[data-slot]");
  cards.forEach((c) => c.addEventListener("click", onCardClick));

  const onCanvasClick = (e: MouseEvent) => {
    const state = stateRef.current;
    if (state.status !== "playing") return;
    if (!state.selectedId) return;
    const world = mapper.toWorld(e.clientX, e.clientY);
    if (!world) return;
    const def = getCardDef(state.selectedId);
    if (isSpellDef(def)) {
      if (!isOnPitch(state, world.x, world.y)) return;
    } else if (!isInOwnHalf(state, "player", world.x, world.y, def.radius)) {
      return;
    }
    if (!canAfford(state.economy.player, def.cost)) return;
    state.intents.push({
      side: "player",
      defId: state.selectedId,
      x: world.x,
      y: world.y,
    });
  };
  canvas.addEventListener("click", onCanvasClick);

  const onMove = (e: MouseEvent) => {
    const state = stateRef.current;
    if (!state.selectedId || state.status !== "playing") {
      state.hover = null;
      return;
    }
    state.hover = mapper.toWorld(e.clientX, e.clientY);
  };
  const onLeave = () => {
    stateRef.current.hover = null;
  };
  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseleave", onLeave);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      stateRef.current.selectedId = null;
      stateRef.current.hover = null;
    }
  };
  window.addEventListener("keydown", onKey);

  const restartBtn = document.getElementById("restart-btn");
  const onRestartClick = () => {
    stateRef.current = restartMatch();
    onRestart();
  };
  restartBtn?.addEventListener("click", onRestartClick);

  return () => {
    cards.forEach((c) => c.removeEventListener("click", onCardClick));
    canvas.removeEventListener("click", onCanvasClick);
    canvas.removeEventListener("mousemove", onMove);
    canvas.removeEventListener("mouseleave", onLeave);
    window.removeEventListener("keydown", onKey);
    restartBtn?.removeEventListener("click", onRestartClick);
  };
}
