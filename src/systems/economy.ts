import type { Economy, GameState } from "../config/types";

export function updateEconomy(state: GameState, dt: number): void {
  const overtime =
    state.timeLeft <= state.config.lastMinuteSeconds || state.timeLeft <= 0;
  const regenPerSecond = overtime
    ? 1 / state.config.overtimeRegenInterval
    : 1 / state.config.regenInterval;

  state.economy.player.regenPerSecond = regenPerSecond;
  state.economy.ai.regenPerSecond = regenPerSecond;

  regen(state.economy.player, dt);
  regen(state.economy.ai, dt);
}

function regen(eco: Economy, dt: number): void {
  eco.current = Math.min(eco.max, eco.current + eco.regenPerSecond * dt);
}

export function canAfford(eco: Economy, cost: number): boolean {
  return Math.floor(eco.current) >= cost;
}

export function spend(eco: Economy, cost: number): boolean {
  if (!canAfford(eco, cost)) return false;
  eco.current -= cost;
  return true;
}
