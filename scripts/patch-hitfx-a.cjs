const fs = require("fs");

function patch(rel, pairs) {
  let s = fs.readFileSync(rel, "utf8");
  for (const [from, to] of pairs) {
    if (!s.includes(from)) {
      console.error("MISSING in", rel, ":\n---\n" + from + "\n---");
      process.exit(1);
    }
    s = s.split(from).join(to);
  }
  fs.writeFileSync(rel, s, "utf8");
  console.log("patched", rel);
}

// Unit fields — insert before closing of Unit interface (after shootRecoil)
{
  let t = fs.readFileSync("src/config/types.ts", "utf8");
  const unitMarker = "  shootRecoil: number;\n}\n\nexport interface Projectile";
  if (!t.includes(unitMarker)) {
    console.error("unit marker missing");
    process.exit(1);
  }
  t = t.replace(
    unitMarker,
    `  shootRecoil: number;
  /** Hit-flash timer (seconds). Drawn white while > 0. */
  hitFlash: number;
  /** Death anim countdown. > 0 keeps the unit alive for the shrink/ring. */
  deathT: number;
}

export interface Projectile`,
  );

  const cfgMarker = "  shootRecoilDuration: number;\n}\n\nexport interface DeployIntent";
  if (!t.includes(cfgMarker)) {
    // try alternate - DeployIntent might come after GoalFlash
    const alt = "  shootRecoilDuration: number;\n}";
    const idx = t.indexOf(alt);
    if (idx < 0) {
      console.error("cfg marker missing");
      process.exit(1);
    }
    // only first MatchConfig closing after shootRecoilDuration
    t =
      t.slice(0, idx) +
      `  shootRecoilDuration: number;
  /** Hit flash duration (~3–4 frames at 60fps). */
  hitFlashDuration: number;
  /** Death shrink + ring duration in seconds. */
  deathDuration: number;
  /** Floating damage number lifetime. */
  damageFloatDuration: number;
  /** How far damage numbers rise (world px) over their lifetime. */
  damageFloatRise: number;
}` +
      t.slice(idx + alt.length);
  } else {
    t = t.replace(
      cfgMarker,
      `  shootRecoilDuration: number;
  /** Hit flash duration (~3–4 frames at 60fps). */
  hitFlashDuration: number;
  /** Death shrink + ring duration in seconds. */
  deathDuration: number;
  /** Floating damage number lifetime. */
  damageFloatDuration: number;
  /** How far damage numbers rise (world px) over their lifetime. */
  damageFloatRise: number;
}

export interface DeployIntent`,
    );
  }

  if (!t.includes("export interface DamageFloat")) {
    t = t.replace(
      `export interface GoalFlash {
  goalId: string;
  t: number;
}`,
      `export interface GoalFlash {
  goalId: string;
  t: number;
}

export interface DamageFloat {
  x: number;
  y: number;
  amount: number;
  t: number;
  duration: number;
}`,
    );
  }

  const gsMarker = "  goalFlashes: GoalFlash[];\n}";
  if (!t.includes(gsMarker)) {
    console.error("gamestate marker missing");
    process.exit(1);
  }
  t = t.replace(
    gsMarker,
    `  goalFlashes: GoalFlash[];
  /** Rising damage numbers from unit hits. */
  damageFloats: DamageFloat[];
}`,
  );

  fs.writeFileSync("src/config/types.ts", t, "utf8");
  console.log("patched types");
}

patch("src/config/match.ts", [
  [
    `  shootRecoilDuration: 0.09,
};`,
    `  shootRecoilDuration: 0.09,
  hitFlashDuration: 4 / 60,
  deathDuration: 0.2,
  damageFloatDuration: 0.7,
  damageFloatRise: 30,
};`,
  ],
]);

patch("src/entities/factory.ts", [
  [
    `    shootRecoil: 0,
  };`,
    `    shootRecoil: 0,
    hitFlash: 0,
    deathT: 0,
  };`,
  ],
  [
    `    goalFlashes: [],
  };
}`,
    `    goalFlashes: [],
    damageFloats: [],
  };
}`,
  ],
]);

fs.writeFileSync(
  "src/systems/damage.ts",
  fs.readFileSync("src/systems/damage.ts", "utf8").includes("distUnits")
    ? `import type { GameState, Unit } from "../config/types";
import { getUnitDef } from "../config/units";
import { activateKing, findGoal } from "./goals";
import { distUnits } from "./geometry";

export function auraDamageMultiplier(state: GameState, victim: Unit): number {
  let reduction = 0;
  for (const ally of state.units) {
    if (ally.hp <= 0 || ally.side !== victim.side) continue;
    if (ally.deathT > 0) continue;
    const def = getUnitDef(ally.defId);
    if (def.ability?.kind !== "aura") continue;
    if (distUnits(ally, victim) <= def.ability.radius) {
      reduction = def.ability.damageReduction;
      break; // non-stacking
    }
  }
  return 1 - reduction;
}

export function applyUnitDamage(
  state: GameState,
  victim: Unit,
  rawDamage: number,
): void {
  if (victim.hp <= 0 || victim.deathT > 0) return;

  const mult = auraDamageMultiplier(state, victim);
  const before = victim.hp;
  victim.hp = Math.max(0, victim.hp - rawDamage * mult);
  const shown = Math.max(1, Math.round(before - victim.hp));

  victim.hitFlash = state.config.hitFlashDuration;
  state.damageFloats.push({
    x: victim.x,
    y: victim.y - getUnitDef(victim.defId).radius - 8,
    amount: shown,
    t: state.config.damageFloatDuration,
    duration: state.config.damageFloatDuration,
  });

  if (victim.hp <= 0) {
    victim.hp = 0;
    victim.deathT = state.config.deathDuration;
    victim.target = null;
  }
}

export function applyGoalDamage(
  state: GameState,
  goalId: string,
  goalHpDelta: number,
): void {
  const goal = findGoal(state, goalId);
  if (!goal || goal.hp <= 0) return;

  const before = goal.hp;
  goal.hp = Math.max(0, goal.hp - goalHpDelta);

  if (goal.hp < before) {
    state.shake = Math.max(state.shake, state.config.goalShakeAmount);
    state.goalFlashes.push({
      goalId: goal.id,
      t: state.config.goalFlashDuration,
    });
  }

  if (goal.role === "king") {
    goal.activated = true;
  }

  // Clash Royale: losing a princess wakes the king
  if (goal.role === "princess" && goal.hp <= 0) {
    activateKing(state, goal.side);
  }
}
`
    : "",
  "utf8",
);
console.log("wrote damage");

patch("src/systems/match.ts", [
  [
    `  state.units = state.units.filter((u) => u.hp > 0);`,
    `  // Keep 0-HP units while their death anim plays
  state.units = state.units.filter((u) => u.hp > 0 || u.deathT > 0);`,
  ],
  [
    `      return state.units.some((u) => u.id === unitId);`,
    `      return state.units.some((u) => u.id === unitId && u.hp > 0);`,
  ],
]);

{
  let loop = fs.readFileSync("src/systems/loop.ts", "utf8");
  if (loop.includes("function updateHitFx")) {
    console.log("loop already has updateHitFx");
  } else {
    const insertBefore = "  cleanupAndCheck(state);";
    if (!loop.includes(insertBefore)) {
      console.error("cleanup call missing");
      process.exit(1);
    }
    loop = loop.replace(
      insertBefore,
      `  updateHitFx(state, dt);
  cleanupAndCheck(state);`,
    );

    // append helper before end of file
    loop += `
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
`;
    fs.writeFileSync("src/systems/loop.ts", loop, "utf8");
    console.log("patched loop");
  }
}

console.log("phase A done");
