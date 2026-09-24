import type { GameState } from "../config/types";
import { updateAi } from "./ai";
import { updateCombat } from "./combat";
import { updateTowers } from "./towers";
import { updateEconomy } from "./economy";
import { processIntents } from "./intents";
import { cleanupAndCheck } from "./match";
import { updateMovement } from "./movement";
import { updateProjectiles } from "./projectiles";
import { updateHighLine } from "./spells";
import { updateTargeting } from "./targeting";

export type RenderFn = (state: GameState) => void;

export function startLoop(
  stateRef: { current: GameState },
  render: RenderFn,
): () => void {
  let acc = 0;
  let last = performance.now();
  let raf = 0;
  let running = true;

  const frame = (now: number) => {
    if (!running) return;
    const raw = (now - last) / 1000;
    last = now;
    const dt = Math.min(raw, 0.1);
    const state = stateRef.current;
    const step = state.config.step;

    if (state.status === "playing") {
      acc += dt;
      while (acc >= step) {
        simulate(state, step);
        acc -= step;
      }
    } else {
      acc = 0;
    }

    render(state);
    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}

function simulate(state: GameState, dt: number): void {
  processIntents(state);
  updateEconomy(state, dt);
  updateAi(state, dt);
  // AI may have pushed intents — process them same tick
  processIntents(state);
  updateHighLine(state, dt);
  updateTargeting(state);
  updateMovement(state, dt);
  updateCombat(state, dt);
  updateTowers(state, dt);
  updateProjectiles(state, dt);
  updateHitFx(state, dt);
  cleanupAndCheck(state);

  state.time += dt;
  if (state.timeLeft > 0) {
    state.timeLeft = Math.max(0, state.timeLeft - dt);
  }

  if (state.shake > 0) {
    state.shake = Math.max(0, state.shake - state.config.goalShakeDecay * dt);
  }
  if (state.goalFlashes.length > 0) {
    for (const flash of state.goalFlashes) flash.t -= dt;
    state.goalFlashes = state.goalFlashes.filter((f) => f.t > 0);
  }
}

function updateHitFx(state: GameState, dt: number): void {
  for (const unit of state.units) {
    if (unit.hitFlash > 0) {
      unit.hitFlash = Math.max(0, unit.hitFlash - dt);
    }
    if (unit.deathT > 0) {
      unit.deathT = Math.max(0, unit.deathT - dt);
    }
  }

  if (state.damageFloats.length > 0) {
    for (const f of state.damageFloats) {
      f.t -= dt;
      const rise =
        state.config.damageFloatRise *
        (dt / Math.max(0.0001, f.duration));
      f.y -= rise;
    }
    state.damageFloats = state.damageFloats.filter((f) => f.t > 0);
  }
}
