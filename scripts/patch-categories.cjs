/**
 * Card categories (troop/building/spell) + Neymar buildingsOrKing targeting.
 */
const fs = require("fs");
const path = require("path");

function read(rel) {
  let b = fs.readFileSync(path.join(__dirname, "..", rel));
  if (b[1] === 0) b = Buffer.from(b.toString("utf16le").replace(/^\uFEFF/, ""), "utf8");
  return b.toString("utf8");
}
function write(rel, s) {
  fs.writeFileSync(path.join(__dirname, "..", rel), s, "utf8");
  console.log("wrote", rel);
}

// --- types ---
{
  let s = read("src/config/types.ts");

  if (!s.includes('CardCategory')) {
    s = s.replace(
      /export type TargetFilter = "[^"]+"(?: \| "[^"]+")*;/,
      (m) =>
        `/** Clash-style card families. */
export type CardCategory = "troop" | "building" | "spell";

` + m.replace(
          /;$/,
          ' | "buildingsOrKing";',
        ),
    );
  } else if (!s.includes('"buildingsOrKing"')) {
    s = s.replace(
      /export type TargetFilter = ([^;]+);/,
      'export type TargetFilter = $1 | "buildingsOrKing";',
    );
  }

  // UnitDef: category field
  if (!/interface UnitDef \{[\s\S]*?category\?:/.test(s)) {
    s = s.replace(
      /export interface UnitDef \{/,
      `export interface UnitDef {
  /** Clash-style family. Default "troop". Wall etc. use "building". */`,
    );
    // Insert after label or cost
    s = s.replace(
      /(export interface UnitDef \{[\s\S]*?cost: number;\n)/,
      `$1  category?: Exclude<CardCategory, "spell">;\n`,
    );
  }

  // SpellDef: category always spell (optional explicit)
  if (!/interface SpellDef \{[\s\S]*?category\?:/.test(s)) {
    s = s.replace(
      /(export interface SpellDef \{[\s\S]*?kind: "spell";\n)/,
      `$1  category?: "spell";\n`,
    );
  }

  // TargetFilter comment for buildingsOrKing
  if (!s.includes("buildingsOrKing")) {
    throw new Error("failed to add buildingsOrKing to TargetFilter");
  }

  write("src/config/types.ts", s);
}

// --- units: category + Neymar filter ---
{
  let s = read("src/config/units.ts");

  // Add category: "troop" to each unit that lacks category (except we'll set wall separately)
  // Simpler: set wall building, neymar filter, and leave others defaulting via getUnitDef helper.

  // Neymar target filter
  s = s.replace(
    /(neymar: \{[\s\S]*?targetFilter: ")[^"]+(")/,
    '$1buildingsOrKing$2',
  );

  // Wall category
  if (!/wall: \{[\s\S]*?category:/.test(s)) {
    s = s.replace(
      /(wall: \{\n\s+id: "wall",\n\s+name: "Wall",\n\s+label: "W",\n\s+cost: 5,\n)/,
      `$1    category: "building",\n`,
    );
  }

  // Ensure getUnitDef / a helper returns category default — patch units.ts bottom
  if (!s.includes("unitCategory")) {
    s += `

/** Clash-style card family for a unit def (default troop). */
export function unitCategory(def: import("./types").UnitDef): "troop" | "building" {
  return def.category ?? "troop";
}
`;
  }

  write("src/config/units.ts", s);
}

// --- cards helper for category ---
{
  let s = read("src/config/cards.ts");
  if (!s.includes("cardCategory")) {
    // ensure unitCategory import
    if (!s.includes("unitCategory")) {
      s = s.replace(
        /from "\.\/units";/,
        (m) => m.includes("unitCategory") ? m : m.replace("}", " unitCategory }").replace("  unitCategory  unitCategory", " unitCategory"),
      );
      // cleaner:
      if (!s.includes("unitCategory")) {
        s = s.replace(
          /import \{([^}]+)\} from "\.\/units";/,
          (m, inner) => {
            if (inner.includes("unitCategory")) return m;
            return `import { ${inner.trim().replace(/,$/, "")}, unitCategory } from "./units";`;
          },
        );
      }
    }
    s += `
import type { CardCategory } from "./types";

/** Clash Royale-style card family. */
export function cardCategory(def: CardDef): CardCategory {
  if (isSpellDef(def)) return "spell";
  return unitCategory(def);
}
`;
    write("src/config/cards.ts", s);
  } else console.log("cards category ok");
}

// --- targeting: honor filters ---
{
  let s = read("src/systems/targeting.ts");

  // Ensure imports
  if (!s.includes("unitCategory")) {
    s = s.replace(
      /import \{ getUnitDef \} from "\.\.\/config\/units";/,
      'import { getUnitDef, unitCategory } from "../config/units";',
    );
  }
  if (!s.includes("kingGoal")) {
    s = s.replace(
      /import \{([^}]+)\} from "\.\/goals";/,
      (m, inner) => {
        if (inner.includes("kingGoal")) return m;
        return `import { ${inner.trim().replace(/,$/, "")}, kingGoal } from "./goals";`;
      },
    );
  }

  // Replace updateTargeting body with filter-aware version
  const start = s.indexOf("export function updateTargeting");
  if (start < 0) throw new Error("updateTargeting missing");
  const next = s.indexOf("\nexport function", start + 1);
  const end = next < 0 ? s.length : next;

  const neu = `export function updateTargeting(state: GameState): void {
  const baseDetect = state.config.unitDetectRange;
  for (const unit of state.units) {
    if (unit.hp <= 0 || unit.deathT > 0) continue;
    if (unit.spawnT > 0) continue;
    const def = getUnitDef(unit.defId);
    if (def.ability?.kind === "wall" || unitCategory(def) === "building") {
      // Buildings do not acquire targets.
      if (def.ability?.kind === "wall" || def.damage <= 0) {
        unit.target = null;
        unit.activeRange = 0;
        continue;
      }
    }
    if (def.ability?.kind === "wall") {
      unit.target = null;
      unit.activeRange = 0;
      continue;
    }

    const enemies = livingEnemies(state, unit.side);
    const reach = attackRange(state, unit);
    const aggro = Math.max(baseDetect, reach);
    const foe = enemySide(unit.side);

    // --- Clash-style target filters ---
    if (def.targetFilter === "goalsOnly") {
      unit.target = goalTarget(state, unit);
      unit.activeRange = reach;
      unit.hybridMeleeLock = false;
      continue;
    }

    if (def.targetFilter === "buildingsOrKing") {
      // Prefer enemy buildings (e.g. Wall); otherwise march on the King tower.
      const buildings = enemies.filter(
        (e) =>
          unitCategory(getUnitDef(e.defId)) === "building" &&
          distUnits(unit, e) <= aggro,
      );
      const nearBuilding = nearestUnit(unit, buildings);
      if (nearBuilding) {
        unit.target = { kind: "unit", id: nearBuilding.id };
        unit.activeRange = reach;
        unit.hybridMeleeLock = false;
        continue;
      }
      const king = kingGoal(state, foe);
      unit.target =
        king && king.hp > 0 ? { kind: "goal", goalId: king.id } : null;
      unit.activeRange = reach;
      unit.hybridMeleeLock = false;
      continue;
    }

    // Default: unitThenGoal — lock nearest troop in aggro, else nearest goal.
    const near = nearestUnit(
      unit,
      enemies.filter((e) => distUnits(unit, e) <= aggro),
    );

    if (!near) {
      unit.target = goalTarget(state, unit);
      unit.activeRange = reach;
      unit.hybridMeleeLock = false;
      continue;
    }

    unit.target = { kind: "unit", id: near.id };

    if (def.attackMode === "hybrid") {
      const meleeRange =
        (def.meleeRange ?? 1) * state.config.tileSize * state.config.rangeScale;
      const d = distUnits(unit, near);
      const stuck =
        d <= meleeRange ||
        (unit.hybridMeleeLock && d <= state.config.hybridMeleeExit);
      unit.activeRange = stuck ? meleeRange : unit.range;
      unit.hybridMeleeLock = stuck;
      continue;
    }

    unit.activeRange = reach;
    unit.hybridMeleeLock = false;
  }
}

`;

  s = s.slice(0, start) + neu + s.slice(end).replace(/^\n+/, "\n");
  write("src/systems/targeting.ts", s);
}

// --- HUD: show category ---
{
  let s = read("src/ui/hud.ts");
  if (!s.includes("cardCategory")) {
    s = s.replace(
      /import \{([^}]+)\} from "\.\.\/config\/cards";/,
      (m, inner) => {
        if (inner.includes("cardCategory")) return m;
        return `import { ${inner.trim().replace(/,$/, "")}, cardCategory } from "../config/cards";`;
      },
    );

    // Spell stats prefix
    s = s.replace(
      /def\.spell === "dive"\s*\n\s*\? "SPELL · Tower −1 \/ YC"/,
      `def.spell === "dive"
            ? "SPELL · Tower −1 / YC"`,
    );

    // Unit card stats — prepend category
    if (s.includes("const dps = unitDps(def);") && !s.includes("cardCategory(def)")) {
      s = s.replace(
        `const dps = unitDps(def);
      const hit = unitHitSpeed(def);
      btn.innerHTML = \``,
        `const dps = unitDps(def);
      const hit = unitHitSpeed(def);
      const cat = cardCategory(def).toUpperCase();
      btn.innerHTML = \``,
      );
      // inject into card-stats line if present
      s = s.replace(
        /<span class="card-stats">\$\{[^}]*DMG[^<]*<\/span>/,
        (m) => m.replace("${", "${cat} · ${"),
      );
      // try common pattern
      if (!s.includes("${cat}")) {
        s = s.replace(
          /(<span class="card-stats">)(\$\{)/,
          "$1${cat} · $2",
        );
      }
    }
  }
  write("src/ui/hud.ts", s);
}

console.log("categories + neymar targeting patched");
