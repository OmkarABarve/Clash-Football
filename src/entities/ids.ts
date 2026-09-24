import type { GameState } from "../config/types";

export function nextId(state: GameState): number {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}
