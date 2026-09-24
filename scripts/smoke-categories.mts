import { createMatch, createUnit } from "../src/entities/factory.ts";
import { getUnitDef, unitCategory } from "../src/config/units.ts";
import { getSpellDef, cardCategory, enabledCardIds } from "../src/config/cards.ts";
import { updateTargeting } from "../src/systems/targeting.ts";
import { kingGoal } from "../src/systems/goals.ts";
import { MATCH_CONFIG } from "../src/config/match.ts";

const mid = MATCH_CONFIG.midlineY;

// --- Categories ---
const wall = getUnitDef("wall");
const ney = getUnitDef("neymar");
const dive = getSpellDef("dive");

if (unitCategory(wall) !== "building") throw new Error("Wall should be building");
if (unitCategory(ney) !== "troop") throw new Error("Neymar should be troop");
if (cardCategory(wall) !== "building") throw new Error("cardCategory(wall) building");
if (cardCategory(ney) !== "troop") throw new Error("cardCategory(neymar) troop");
if (cardCategory(dive) !== "spell") throw new Error("cardCategory(dive) spell");
if (ney.targetFilter !== "buildingsOrKing") {
  throw new Error(`Neymar filter should be buildingsOrKing, got ${ney.targetFilter}`);
}
if (!enabledCardIds().includes("wall") || !enabledCardIds().includes("neymar")) {
  throw new Error("wall/neymar missing from roster");
}
console.log("categories ok", {
  wall: cardCategory(wall),
  neymar: cardCategory(ney),
  dive: cardCategory(dive),
});

// --- Neymar prefers Wall over troops ---
{
  const s = createMatch();
  const n = createUnit(s, "neymar", "player", 288, mid + 120);
  n.spawnT = 0;
  const w = createUnit(s, "wall", "ai", 288, mid - 40);
  w.spawnT = 0;
  const troop = createUnit(s, "messi", "ai", 288, mid + 40);
  troop.spawnT = 0;
  s.units.push(n, w, troop);

  updateTargeting(s);
  if (!n.target || n.target.kind !== "unit" || n.target.id !== w.id) {
    throw new Error(
      `Neymar should lock Wall, got ${JSON.stringify(n.target)} (wall=${w.id}, troop=${troop.id})`,
    );
  }
  console.log("neymar prefers wall ok");
}

// --- Neymar marches on King when no buildings ---
{
  const s = createMatch();
  const n = createUnit(s, "neymar", "player", 288, mid + 200);
  n.spawnT = 0;
  const troop = createUnit(s, "messi", "ai", 288, mid + 80);
  troop.spawnT = 0;
  s.units.push(n, troop);

  updateTargeting(s);
  const king = kingGoal(s, "ai");
  if (!king) throw new Error("AI king missing");
  if (!n.target || n.target.kind !== "goal" || n.target.goalId !== king.id) {
    throw new Error(
      `Neymar should target King (not troop), got ${JSON.stringify(n.target)}`,
    );
  }
  console.log("neymar king ok", king.id);
}

console.log("CATEGORIES + NEYMAR TARGET SMOKE OK");
