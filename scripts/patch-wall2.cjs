const fs = require("fs");

function read(p) {
  const b = fs.readFileSync(p);
  return b[1] === 0
    ? b.toString("utf16le").replace(/^\uFEFF/, "")
    : b.toString("utf8");
}
function write(p, s) {
  fs.writeFileSync(p, s, "utf8");
}

// Fix geometry: callers use distUnits
let g = read("src/systems/geometry.ts");
g = g.replace(/export function distUnits\(/g, "export function distUnits(");
// If still named wrong after a botched replace, rewrite the function name carefully
if (!/export function distUnits\(/.test(g)) {
  // maybe already distUnits from bad identical replace — check
  console.log(
    "geo fns",
    [...g.matchAll(/export function (\w+)/g)].map((x) => x[1]),
  );
}
// Force: ensure distUnits exists as the wall-aware distance
if (/export function distUnits\(/.test(g) && !/export function distUnits\(/.test(g)) {
  // unreachable if names equal... use explicit content check
}
// Read actual
const fns = [...g.matchAll(/export function (\w+)/g)].map((x) => x[1]);
console.log("geometry exports:", fns);
if (fns.includes("distUnits") && !fns.includes("distUnits")) {
  // This can't happen in JS string compare if they're the same spelling
}
// The issue is I named it distUnits in the write. Callers want distUnits.
// In the patch-wall1 I wrote: export function distUnits
// Let me just add alias if needed
if (fns.includes("distUnits") && !fns.includes("distUnits")) {
  g += "\nexport { distUnits as distUnits };\n";
}
// Simplest: replace the identifier character by character from the file content
const m = g.match(/export function (dist\w+)\(/);
console.log("distance fn name:", m && m[1]);
if (m && m[1] !== "distUnits") {
  g = g.split(m[1]).join("distUnits");
  write("src/systems/geometry.ts", g);
  console.log("renamed", m[1], "-> distUnits");
} else {
  write("src/systems/geometry.ts", g);
  console.log("distance fn ok");
}

// Pass tileSize into distUnits from callers — update signature usage
// distUnits(a,b) -> distUnits(a,b, tileSize) in targeting/damage
// Better: distUnits looks up nothing from state — use default TILE_SIZE from config
g = read("src/systems/geometry.ts");
g = g.replace(
  "export function distUnits(a: Unit, b: Unit, tileSize = 32): number {",
  `export function distUnits(a: Unit, b: Unit, tileSize?: number): number {
  const ts = tileSize ?? require("../config/tiles").TILE_SIZE;`,
);
// that's ugly with require. Import TILE_SIZE at top instead.
g = read("src/systems/geometry.ts");
if (!g.includes('from "../config/tiles"')) {
  g = g.replace(
    'import { getUnitDef } from "../config/units";',
    'import { getUnitDef } from "../config/units";\nimport { TILE_SIZE } from "../config/tiles";',
  );
}
g = g.replace(
  /export function distUnits\(a: Unit, b: Unit, tileSize = 32\): number \{/,
  "export function distUnits(a: Unit, b: Unit, tileSize: number = TILE_SIZE): number {",
);
g = g.replace(
  /export function distUnits\(a: Unit, b: Unit, tileSize\?: number\): number \{[\s\S]*?const ts = tileSize \?\? require\("\.\.\/config\/tiles"\)\.TILE_SIZE;/,
  "export function distUnits(a: Unit, b: Unit, tileSize: number = TILE_SIZE): number {",
);
write("src/systems/geometry.ts", g);

// Also closestPointOnUnit / unitFootprint default tileSize
g = read("src/systems/geometry.ts");
console.log("final geo exports", [...g.matchAll(/export function (\w+)/g)].map((x) => x[1]));
console.log("has TILE_SIZE import", g.includes("TILE_SIZE"));

// ========== movement: walls don't walk ==========
let mov = read("src/systems/movement.ts");
if (!mov.includes('ability?.kind === "wall"')) {
  mov = mov.replace(
    'import { getUnitDef } from "../config/units";',
    'import { getUnitDef } from "../config/units";',
  );
  mov = mov.replace(
    `    // Deploy puff: scale up, no walking until finished
    if (unit.spawnT > 0) {`,
    `    // Walls / structures stay put
    const selfDef = getUnitDef(unit.defId);
    if (selfDef.ability?.kind === "wall" || selfDef.speed <= 0) {
      updateCharge(unit, dt, 0, false, state.config.tileSize);
      continue;
    }

    // Deploy puff: scale up, no walking until finished
    if (unit.spawnT > 0) {`,
  );
  write("src/systems/movement.ts", mov);
  console.log("movement: walls stationary");
}

// ========== combat: walls don't shoot ==========
let combat = read("src/systems/combat.ts");
if (!combat.includes('kind === "wall"')) {
  combat = combat.replace(
    `    // Freeze ticking is owned by movement; combat only respects the lock.
    if (unit.freezeT > 0) continue;

    if (unit.cooldownLeft > 0) {`,
    `    // Freeze ticking is owned by movement; combat only respects the lock.
    if (unit.freezeT > 0) continue;

    const defEarly = getUnitDef(unit.defId);
    if (defEarly.ability?.kind === "wall" || defEarly.damage <= 0) continue;

    if (unit.cooldownLeft > 0) {`,
  );
  write("src/systems/combat.ts", combat);
  console.log("combat: walls skip attack");
}

// ========== targeting: walls don't acquire targets ==========
let tgt = read("src/systems/targeting.ts");
if (!tgt.includes('kind === "wall"')) {
  tgt = tgt.replace(
    `    if (unit.hp <= 0 || unit.deathT > 0) continue;
    if (unit.spawnT > 0) continue;
    const def = getUnitDef(unit.defId);`,
    `    if (unit.hp <= 0 || unit.deathT > 0) continue;
    if (unit.spawnT > 0) continue;
    const def = getUnitDef(unit.defId);
    if (def.ability?.kind === "wall") {
      unit.target = null;
      unit.activeRange = 0;
      continue;
    }`,
  );
  write("src/systems/targeting.ts", tgt);
  console.log("targeting: walls idle");
}

// ========== damage: break wall into Defs ==========
let dmg = read("src/systems/damage.ts");
if (!dmg.includes("breakWall")) {
  dmg = dmg.replace(
    'import { activateKing, findGoal } from "./goals";',
    'import { activateKing, findGoal } from "./goals";\nimport { createUnit } from "../entities/factory";',
  );
  dmg = dmg.replace(
    `  if (victim.hp <= 0) {
    victim.hp = 0;
    victim.deathT = state.config.deathDuration;
    victim.target = null;
  }
}`,
    `  if (victim.hp <= 0) {
    victim.hp = 0;
    victim.deathT = state.config.deathDuration;
    victim.target = null;
    breakWallIfNeeded(state, victim);
  }
}

/** When a Wall is destroyed, spawn its Def troops across its width. */
function breakWallIfNeeded(state: GameState, wall: Unit): void {
  const def = getUnitDef(wall.defId);
  if (def.ability?.kind !== "wall") return;
  const { breakInto, breakCount, widthTiles } = def.ability;
  const tile = state.config.tileSize;
  const width = widthTiles * tile;
  const startX = wall.x - width / 2 + width / (breakCount * 2);
  const step = width / breakCount;
  for (let i = 0; i < breakCount; i++) {
    const x = startX + step * i;
    const u = createUnit(state, breakInto, wall.side, x, wall.y);
    u.spawnT = Math.min(u.spawnT, 0.15);
    state.units.push(u);
  }
}
`,
  );
  write("src/systems/damage.ts", dmg);
  console.log("damage: wall break spawn");
}

// ========== projectiles: hit wide wall footprint ==========
let proj = read("src/systems/projectiles.ts");
if (!proj.includes("unitFootprint") && !proj.includes("closestPointOnUnit")) {
  proj = proj.replace(
    'import { goalCenter, pointInGoal } from "./geometry";',
    'import { closestPointOnUnit, goalCenter, pointInGoal, unitFootprint } from "./geometry";',
  );
  proj = proj.replace(
    `      const radius =
        getUnitDef(victim.defId).radius * state.config.tileSize;
      if (len <= radius || step >= len - radius) {
        applyUnitDamage(state, victim, shot.damage);
        if (shot.freezeDuration > 0 && victim.hp > 0) {
          victim.freezeT = Math.max(victim.freezeT, shot.freezeDuration);
        }
        continue;
      }`,
    `      const tile = state.config.tileSize;
      const aimPt = closestPointOnUnit(victim, shot.x, shot.y, tile);
      const hitDx = aimPt.x - shot.x;
      const hitDy = aimPt.y - shot.y;
      const hitLen = Math.hypot(hitDx, hitDy) || 1;
      const footprint = unitFootprint(victim, tile);
      const hitR = Math.min(footprint.w, footprint.h) / 2;
      if (hitLen <= hitR || step >= hitLen - hitR) {
        applyUnitDamage(state, victim, shot.damage);
        if (shot.freezeDuration > 0 && victim.hp > 0) {
          victim.freezeT = Math.max(victim.freezeT, shot.freezeDuration);
        }
        continue;
      }`,
  );
  // Also aim at closest point on wall
  proj = proj.replace(
    `  const targetId = shot.target.id;
  const u = state.units.find((x) => x.id === targetId && x.hp > 0);
  return u ? { x: u.x, y: u.y } : null;
}`,
    `  const targetId = shot.target.id;
  const u = state.units.find((x) => x.id === targetId && x.hp > 0);
  if (!u) return null;
  return closestPointOnUnit(u, shot.x, shot.y, state.config.tileSize);
}`,
  );
  write("src/systems/projectiles.ts", proj);
  console.log("projectiles: wall footprint hits");
}

console.log("phase2 done");
