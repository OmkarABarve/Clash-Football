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

// 1) Add pitch fields to MatchConfig
let types = read("src/config/types.ts");
if (!types.includes("centerCircleRadius")) {
  types = types.replace(
    `  /** World pixels per “tile” (Clash-style grid on this arena). */
  tileSize: number;`,
    `  /** World pixels per tile (Clash-style 18×32 grid). */
  tileSize: number;
  /** Center-circle radius in world px (from tiles). */
  centerCircleRadius: number;
  /** Penalty-area width in world px. */
  penaltyWidth: number;
  /** Penalty-area depth in world px. */
  penaltyDepth: number;`,
  );
}

// UnitDef distance docs
types = types.replace(
  `  speed: number;
  /** Ranged / long-range attack distance. Unused for pure melee. */
  range: number;
  meleeRange?: number;`,
  `  /** Movement speed in tiles per second. */
  speed: number;
  /** Ranged / long-range attack distance in tiles. Unused for pure melee. */
  range: number;
  /** Melee reach in tiles. */
  meleeRange?: number;`,
);

types = types.replace(
  `  targetFilter: TargetFilter;
  radius: number;`,
  `  targetFilter: TargetFilter;
  /** Collision / draw radius in tiles. */
  radius: number;`,
);

types = types.replace(
  `  /** Horizontal offset from deploy point (world px). */
  offsetX: number;`,
  `  /** Horizontal offset from deploy point in tiles. */
  offsetX: number;`,
);

// Charge / aura distance docs
types = types.replace(
  `  moveTime: number;
  moveDistance: number;`,
  `  moveTime: number;
  /** Charge build-up distance in tiles. */
  moveDistance: number;`,
);
types = types.replace(
  `export interface AuraAbility {
  kind: "aura";
  radius: number;`,
  `export interface AuraAbility {
  kind: "aura";
  /** Aura radius in tiles. */
  radius: number;`,
);

write("src/config/types.ts", types);
console.log("types updated");

// 2) Factory: convert tiles → px on spawn
const factoryPath = fs.existsSync("src/entities/factory.ts")
  ? "src/entities/factory.ts"
  : "src/entities/factory.ts";
let fac = read(factoryPath);

// Replace createUnit body conversion
if (!fac.includes("tileSize *") && !fac.includes("config.tileSize")) {
  // patch speed/range lines
  fac = fac.replace(
    `    speed: (variant?.speed ?? def.speed) * state.config.speedScale,
    range: (variant?.range ?? def.range) * state.config.rangeScale,`,
    `    speed: (variant?.speed ?? def.speed) * state.config.tileSize * state.config.speedScale,
    range: (variant?.range ?? def.range) * state.config.tileSize * state.config.rangeScale,`,
  );
  fac = fac.replace(
    /activeRange: \(def\.meleeRange \?\? def\.range\) \* state\.config\.rangeScale,/,
    `activeRange: (def.meleeRange ?? def.range) * state.config.tileSize * state.config.rangeScale,`,
  );
}

// radius on unit - check if stored. Looking at createUnit - radius comes from def at draw time via getUnitDef. Need px radius at combat.
// Spawn offset
if (fac.includes("offsetX") && !fac.includes("offsetX) * state.config.tileSize") && !fac.includes("offsetX * state.config.tileSize")) {
  fac = fac.replace(
    /const offsetX = def\.spawnVariants\?\.\[i\]\?\.offsetX \?\? 0;/,
    `const offsetX = (def.spawnVariants?.[i]?.offsetX ?? 0) * state.config.tileSize;`,
  );
  // alternate naming
  fac = fac.replace(
    /const offsetX = variant\?\.offsetX \?\? 0;/,
    `const offsetX = (variant?.offsetX ?? 0) * state.config.tileSize;`,
  );
}

write(factoryPath, fac);
console.log("factory patched", factoryPath);

// 3) targeting hardcoded 36
let targeting = read("src/systems/targeting.ts");
targeting = targeting.replace(
  /\(def\.meleeRange \?\? 36\) \* state\.config\.rangeScale/g,
  `(def.meleeRange ?? 1) * state.config.tileSize * state.config.rangeScale`,
);
write("src/systems/targeting.ts", targeting);
console.log("targeting patched");

// 4) damage aura radius — convert tiles→px when comparing
let damage = read("src/systems/damage.ts");
console.log(
  "aura check",
  damage.match(/ability\.radius[\s\S]{0,80}/)?.[0],
);
if (damage.includes("def.ability.radius") && !damage.includes("tileSize")) {
  damage = damage.replace(
    /distUnits\(ally, victim\) <= def\.ability\.radius/,
    `distUnits(ally, victim) <= def.ability.radius * state.config.tileSize`,
  );
  // alternate
  damage = damage.replace(
    /dist\(ally\.x, ally\.y, victim\.x, victim\.y\) <= def\.ability\.radius/,
    `dist(ally.x, ally.y, victim.x, victim.y) <= def.ability.radius * state.config.tileSize`,
  );
  write("src/systems/damage.ts", damage);
  console.log("damage aura patched");
}

// 5) movement charge distance
let movement = read("src/systems/movement.ts");
if (movement.includes("moveDistance") && !movement.includes("tileSize")) {
  console.log(
    "charge usage",
    movement.match(/moveDistance[\s\S]{0,60}/g),
  );
}

console.log("done phase 1");
