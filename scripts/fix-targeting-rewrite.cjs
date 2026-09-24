const fs = require("fs");
let tg = fs.readFileSync("src/systems/targeting.ts", "utf8");
const start = tg.indexOf("export function updateTargeting");
const next = tg.indexOf("\nexport function", start + 1);
const head = tg.slice(0, start);
const tail = next < 0 ? "" : tg.slice(next);

// Keep helpers above updateTargeting; rewrite function from existing helpers' names
const helperSlice = tg.slice(0, start);
const livingName = /function living\w+/.exec(helperSlice)?.[0]?.replace("function ", "") ?? "livingEnemies";
const nearestName = /function nearest\w+/.exec(helperSlice)?.[0]?.replace("function ", "") ?? "nearestUnit";
const goalTargetName = /function goal\w+/.exec(helperSlice)?.[0]?.replace("function ", "") ?? "goalTarget";
const attackRangeName = /function attack\w+/.exec(helperSlice)?.[0]?.replace("function ", "") ?? "attackRange";
const enemySideName = /function enemy\w+/.exec(helperSlice)?.[0]?.replace("function ", "") ?? "enemySide";

console.log({ livingName, nearestName, goalTargetName, attackRangeName, enemySideName });

const body = `export function updateTargeting(state: GameState): void {
  const baseDetect = state.config.unitDetectRange;
  for (const unit of state.units) {
    if (unit.hp <= 0 || unit.deathT > 0) continue;
    if (unit.spawnT > 0) continue;
    const def = getUnitDef(unit.defId);

    // Buildings (Wall etc.) never acquire targets.
    if (unitCategory(def) === "building" || def.damage <= 0) {
      unit.target = null;
      unit.activeRange = 0;
      continue;
    }

    const enemies = ${livingName}(state, unit.side);
    const reach = ${attackRangeName}(state, unit);
    const aggro = Math.max(baseDetect, reach);
    const foe = ${enemySideName}(unit.side);

    if (def.targetFilter === "goalsOnly") {
      unit.target = ${goalTargetName}(state, unit);
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
      const nearBuilding = ${nearestName}(unit, buildings);
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

    // Default unitThenGoal: nearest troop in aggro, else nearest goal.
    const near = ${nearestName}(
      unit,
      enemies.filter((e) => distUnits(unit, e) <= aggro),
    );

    if (!near) {
      unit.target = ${goalTargetName}(state, unit);
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

fs.writeFileSync("src/systems/targeting.ts", head + body + (tail.startsWith("\n") ? tail : "\n" + tail), "utf8");
console.log("updateTargeting rewritten");
