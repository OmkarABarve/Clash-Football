import { createMatch, createUnit } from "../src/entities/factory.ts";
import { updateTargeting } from "../src/systems/targeting.ts";
import { updateMovement } from "../src/systems/movement.ts";
import { updateCombat } from "../src/systems/combat.ts";
import { updateProjectiles } from "../src/systems/projectiles.ts";
import { cleanupAndCheck } from "../src/systems/match.ts";
import { distUnits } from "../src/systems/geometry.ts";
import { MATCH_CONFIG } from "../src/config/match.ts";

const step = 1 / 60;

function tick(state: ReturnType<typeof createMatch>): void {
  updateTargeting(state);
  updateMovement(state, step);
  updateCombat(state, step);
  updateProjectiles(state, step);
  cleanupAndCheck(state);
  state.time += step;
}

// --- Tower HP ---
const match = createMatch();
const princess = match.goals.find((g) => g.role === "princess")!;
const king = match.goals.find((g) => g.role === "king")!;
if (princess.maxHp !== 20 || king.maxHp !== 20) {
  throw new Error(`expected tower HP 20, got princess=${princess.maxHp} king=${king.maxHp}`);
}
if (MATCH_CONFIG.princessMaxHp !== 20 || MATCH_CONFIG.kingMaxHp !== 20) {
  throw new Error("MATCH_CONFIG MaxHp not 20");
}
console.log("tower HP ok", princess.maxHp, king.maxHp);

// --- Zlatan holds at long range vs Neymar ---
const s = createMatch();
const zlatan = createUnit(s, "zlatan", "player", 210, 520);
const neymar = createUnit(s, "neymar", "ai", 210, 280);
zlatan.spawnT = 0;
neymar.spawnT = 0;
s.units.push(zlatan, neymar);

const startDist = distUnits(zlatan, neymar);
console.log("start dist", startDist.toFixed(1), "zlatan.range", zlatan.range);

let fired = false;
let minDist = startDist;
for (let i = 0; i < 60 * 8; i++) {
  const beforeProj = s.projectiles.length;
  tick(s);
  const d = distUnits(zlatan, neymar);
  minDist = Math.min(minDist, d);
  if (s.projectiles.length > beforeProj) fired = true;

  // Once in range and targeting Neymar, Zlatan should stop closing in
  if (
    zlatan.target?.kind === "unit" &&
    zlatan.target.id === neymar.id &&
    d <= zlatan.range + 2
  ) {
    const yBefore = zlatan.y;
    for (let j = 0; j < 30; j++) tick(s);
    const drift = Math.abs(zlatan.y - yBefore);
    const holdDist = distUnits(zlatan, neymar);
    console.log(
      "hold check",
      "dist",
      holdDist.toFixed(1),
      "activeRange",
      zlatan.activeRange,
      "drift",
      drift.toFixed(2),
      "fired",
      fired || s.projectiles.length > 0 || neymar.hp < neymar.maxHp,
    );
    if (zlatan.activeRange < zlatan.range * 0.9) {
      throw new Error("hybrid should hold at long range, not melee");
    }
    if (holdDist > zlatan.range + 8) {
      throw new Error(`should stop inside own range, dist=${holdDist}`);
    }
    if (holdDist < 80) {
      throw new Error(`walked too close (melee), dist=${holdDist}`);
    }
    if (drift > 15) {
      throw new Error(`should stop moving once in range, drift=${drift}`);
    }
    if (!(fired || s.projectiles.length > 0 || neymar.hp < neymar.maxHp)) {
      throw new Error("Zlatan should shoot Neymar while holding");
    }
    console.log("zlatan range hold ok");
    console.log("SMOKE TOWER+RANGE OK");
    process.exit(0);
  }
}

throw new Error(
  `never locked Neymar in range; minDist=${minDist} target=${JSON.stringify(zlatan.target)} activeRange=${zlatan.activeRange}`,
);
