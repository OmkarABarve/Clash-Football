import { createProjectile } from "../entities/factory";
import type { GameState } from "../config/types";
import { getUnitDef } from "../config/units";
import { MATCH_CONFIG } from "../config/match";
import { distanceToTarget, targetPosition } from "./targeting";

export function updateCombat(state: GameState, dt: number): void {
  for (const unit of state.units) {
    if (unit.hp <= 0 || unit.deathT > 0) continue;
    if (unit.spawnT > 0) continue;

    // Freeze ticking is owned by movement; combat only respects the lock.
    if (unit.freezeT > 0) continue;

    const defEarly = getUnitDef(unit.defId);
    if (defEarly.ability?.kind === "wall" || defEarly.damage <= 0) continue;

    if (unit.cooldownLeft > 0) {
      unit.cooldownLeft = Math.max(0, unit.cooldownLeft - dt);
    }

    if (!unit.target || unit.cooldownLeft > 0) continue;

    const d = distanceToTarget(state, unit, unit.target);
    if (d > unit.activeRange) continue;

    const def = getUnitDef(unit.defId);
    let damage = def.damage;
    let goalHpDelta = state.config.goalHitDelta ?? MATCH_CONFIG.goalHitDelta;
    let empowered = false;

    if (unit.charge?.ready && def.ability?.kind === "charge") {
      empowered = true;
      damage = def.damage * 2;
      goalHpDelta = def.ability.goalHpDelta;
      unit.charge.ready = false;
      unit.charge.movingTime = 0;
      unit.charge.movingDistance = 0;
    }

    const aim = targetPosition(state, unit, unit.target);
    if (aim) {
      unit.facing = Math.atan2(aim.y - unit.y, aim.x - unit.x);
    }
    unit.shootRecoil = state.config.shootRecoilDuration;

    const freezeDuration =
      def.ability?.kind === "freeze" ? def.ability.duration : 0;

    state.projectiles.push(
      createProjectile(state, {
        side: unit.side,
        x: unit.x,
        y: unit.y,
        target: { ...unit.target },
        damage,
        goalHpDelta,
        empowered,
        freezeDuration,
      }),
    );
    unit.cooldownLeft = def.attackCooldown / (unit.yellowCard ? 0.8 : 1);
  }
}
