import { createMatch } from "../entities/factory";
import type { GameState, MatchStatus } from "../config/types";
import { kingGoal } from "./goals";

/** Clash-style: destroying the King Tower ends the match. */
export function outcome(state: GameState): MatchStatus {
  const playerKing = kingGoal(state, "player");
  const aiKing = kingGoal(state, "ai");
  if (playerKing && playerKing.hp <= 0) return "aiWin";
  if (aiKing && aiKing.hp <= 0) return "playerWin";
  return "playing";
}

export function cleanupAndCheck(state: GameState): void {
  // Keep 0-HP units while their death anim plays
  state.units = state.units.filter((u) => u.hp > 0 || u.deathT > 0);
  state.projectiles = state.projectiles.filter((p) => {
    if (p.target.kind === "unit") {
      const unitId = p.target.id;
      return state.units.some((u) => u.id === unitId && u.hp > 0);
    }
    const goalId = p.target.goalId;
    const goal = state.goals.find((g) => g.id === goalId);
    return !!goal && goal.hp > 0;
  });
  state.status = outcome(state);
}

export function restartMatch(): GameState {
  return createMatch();
}
