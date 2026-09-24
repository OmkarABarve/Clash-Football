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

// ---------- movement: spawn lock + facing ----------
patch("src/systems/movement.ts", [
  [
    `export function updateMovement(state: GameState, dt: number): void {
  for (const unit of state.units) {
    if (unit.hp <= 0) continue;
    unit.movedThisTick = false;

    if (!unit.target) {
      updateCharge(unit, dt, 0, false);
      continue;
    }

    const d = distanceToTarget(state, unit, unit.target);
    if (d <= unit.activeRange) {
      updateCharge(unit, dt, 0, false);
      continue;
    }

    const pos = targetPosition(state, unit, unit.target);
    if (!pos) {
      updateCharge(unit, dt, 0, false);
      continue;
    }

    const via = crossingWaypoint(state.config, unit.x, unit.y, pos.x, pos.y);
    const speed = currentSpeed(unit);
    const step = speed * dt;
    const dx = via.x - unit.x;
    const dy = via.y - unit.y;
    const len = Math.hypot(dx, dy) || 1;
    const move = Math.min(step, len);
    const next = stayOnLand(
      state.config,
      unit.x,
      unit.y,
      unit.x + (dx / len) * move,
      unit.y + (dy / len) * move,
    );
    const moved = Math.hypot(next.x - unit.x, next.y - unit.y);
    unit.x = next.x;
    unit.y = next.y;
    unit.movedThisTick = moved > MOVE_EPSILON;
    updateCharge(unit, dt, moved, unit.movedThisTick);
  }
}`,
    `export function updateMovement(state: GameState, dt: number): void {
  for (const unit of state.units) {
    if (unit.hp <= 0) continue;
    unit.movedThisTick = false;

    if (unit.shootRecoil > 0) {
      unit.shootRecoil = Math.max(0, unit.shootRecoil - dt);
    }

    // Deploy puff: scale up, no walking until finished
    if (unit.spawnT > 0) {
      unit.spawnT = Math.max(0, unit.spawnT - dt);
      updateCharge(unit, dt, 0, false);
      continue;
    }

    if (!unit.target) {
      updateCharge(unit, dt, 0, false);
      continue;
    }

    const d = distanceToTarget(state, unit, unit.target);
    if (d <= unit.activeRange) {
      updateCharge(unit, dt, 0, false);
      continue;
    }

    const pos = targetPosition(state, unit, unit.target);
    if (!pos) {
      updateCharge(unit, dt, 0, false);
      continue;
    }

    const via = crossingWaypoint(state.config, unit.x, unit.y, pos.x, pos.y);
    const speed = currentSpeed(unit);
    const step = speed * dt;
    const dx = via.x - unit.x;
    const dy = via.y - unit.y;
    const len = Math.hypot(dx, dy) || 1;
    const move = Math.min(step, len);
    const next = stayOnLand(
      state.config,
      unit.x,
      unit.y,
      unit.x + (dx / len) * move,
      unit.y + (dy / len) * move,
    );
    const moved = Math.hypot(next.x - unit.x, next.y - unit.y);
    if (moved > MOVE_EPSILON) {
      unit.facing = Math.atan2(next.y - unit.y, next.x - unit.x);
    }
    unit.x = next.x;
    unit.y = next.y;
    unit.movedThisTick = moved > MOVE_EPSILON;
    updateCharge(unit, dt, moved, unit.movedThisTick);
  }
}`,
  ],
]);

// ---------- combat: spawn lock + facing toward target + recoil ----------
{
  let com = fs.readFileSync("src/systems/combat.ts", "utf8");
  const old = `export function updateCombat(state: GameState, dt: number): void {
  for (const unit of state.units) {
    if (unit.hp <= 0) continue;

    if (unit.cooldownLeft > 0) {
      unit.cooldownLeft = Math.max(0, unit.cooldownLeft - dt);
    }

    if (!unit.target || unit.cooldownLeft > 0) continue;

    const d = distanceToTarget(state, unit, unit.target);
    if (d > unit.activeRange) continue;`;

  const neu = `export function updateCombat(state: GameState, dt: number): void {
  for (const unit of state.units) {
    if (unit.hp <= 0) continue;
    if (unit.spawnT > 0) continue;

    if (unit.cooldownLeft > 0) {
      unit.cooldownLeft = Math.max(0, unit.cooldownLeft - dt);
    }

    if (!unit.target || unit.cooldownLeft > 0) continue;

    const d = distanceToTarget(state, unit, unit.target);
    if (d > unit.activeRange) continue;`;

  if (!com.includes(old)) {
    console.error("combat header missing");
    process.exit(1);
  }
  com = com.replace(old, neu);

  const shootOld = `    state.projectiles.push(
      createProjectile(state, {
        side: unit.side,
        x: unit.x,
        y: unit.y,
        target: { ...unit.target },
        damage,
        goalHpDelta,
        empowered,
      }),
    );
    unit.cooldownLeft = def.attackCooldown;
  }
}`;

  const shootNew = `    const aim = targetPosition(state, unit, unit.target);
    if (aim) {
      unit.facing = Math.atan2(aim.y - unit.y, aim.x - unit.x);
    }
    unit.shootRecoil = state.config.shootRecoilDuration;

    state.projectiles.push(
      createProjectile(state, {
        side: unit.side,
        x: unit.x,
        y: unit.y,
        target: { ...unit.target },
        damage,
        goalHpDelta,
        empowered,
      }),
    );
    unit.cooldownLeft = def.attackCooldown;
  }
}`;

  if (!com.includes(shootOld)) {
    console.error("combat shoot block missing");
    process.exit(1);
  }
  com = com.replace(shootOld, shootNew);

  if (!com.includes('import { distanceToTarget } from "./targeting";')) {
    console.error("combat targeting import missing");
    process.exit(1);
  }
  com = com.replace(
    'import { distanceToTarget } from "./targeting";',
    'import { distanceToTarget, targetPosition } from "./targeting";',
  );

  fs.writeFileSync("src/systems/combat.ts", com, "utf8");
  console.log("patched combat");
}

// ---------- targeting: skip spawning units as actors ----------
{
  let t = fs.readFileSync("src/systems/targeting.ts", "utf8");
  const needle = `for (const unit of state.units) {
    if (unit.hp <= 0) continue;`;
  if (!t.includes(needle)) {
    console.error("targeting loop missing");
    process.exit(1);
  }
  t = t.replace(
    needle,
    `for (const unit of state.units) {
    if (unit.hp <= 0) continue;
    if (unit.spawnT > 0) continue;`,
  );
  fs.writeFileSync("src/systems/targeting.ts", t, "utf8");
  console.log("patched targeting");
}

// ---------- damage: shake + flash ----------
patch("src/systems/damage.ts", [
  [
    `  const goal = findGoal(state, goalId);
  if (!goal || goal.hp <= 0) return;

  goal.hp = Math.max(0, goal.hp - goalHpDelta);

  if (goal.role === "king") {
    goal.activated = true;
  }

  // Clash Royale: losing a princess wakes the king
  if (goal.role === "princess" && goal.hp <= 0) {
    activateKing(state, goal.side);
  }
}`,
    `  const goal = findGoal(state, goalId);
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
}`,
  ],
]);

// ---------- economy: last-minute regen ----------
fs.writeFileSync(
  "src/systems/economy.ts",
  `import type { Economy, GameState } from "../config/types";

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
`,
  "utf8",
);
console.log("wrote economy");

// ---------- loop: timer + shake/flash decay ----------
{
  let loop = fs.readFileSync("src/systems/loop.ts", "utf8");
  const simOld = `function simulate(state: GameState, dt: number): void {
  processIntents(state);
  updateEconomy(state, dt);
  updateAi(state, dt);
  // AI may have pushed intents — process them same tick
  processIntents(state);
  updateTargeting(state);
  updateMovement(state, dt);
  updateCombat(state, dt);
  updateProjectiles(state, dt);
  cleanupAndCheck(state);
  state.time += dt;
}`;

  // Handle possible encoding variant of em dash comment
  const simRe =
    /function simulate\(state: GameState, dt: number\): void \{[\s\S]*?\n\}/;
  if (!simRe.test(loop)) {
    console.error("simulate missing");
    process.exit(1);
  }
  loop = loop.replace(
    simRe,
    `function simulate(state: GameState, dt: number): void {
  processIntents(state);
  updateEconomy(state, dt);
  updateAi(state, dt);
  // AI may have pushed intents — process them same tick
  processIntents(state);
  updateTargeting(state);
  updateMovement(state, dt);
  updateCombat(state, dt);
  updateProjectiles(state, dt);
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
}`,
  );
  fs.writeFileSync("src/systems/loop.ts", loop, "utf8");
  console.log("patched loop");
}

console.log("phase3 ok");
