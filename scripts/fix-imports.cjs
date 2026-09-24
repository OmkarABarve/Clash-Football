const fs = require("fs");

function fix(file, pairs) {
  let s = fs.readFileSync(file, "utf8");
  for (const [from, to] of pairs) {
    s = s.split(from).join(to);
  }
  fs.writeFileSync(file, s);
  console.log("fixed", file);
}

fix("src/systems/targeting.ts", [
  ["closestPointOnGoal", "closestPointOnGoal"],
  ["distUnits", "distUnits"],
  ["nearestEnemyGoal", "nearestEnemyGoal"],
  ["distToGoal", "distToGoal"],
]);

// Actually set correct disk names:
fix("src/systems/targeting.ts", [
  ["import { closestPointOnGoal, distToGoal, distUnits }", "import { closestPointOnGoal, distToGoal, distUnits }"],
]);

// Read and rewrite imports properly
let targeting = fs.readFileSync("src/systems/targeting.ts", "utf8");
targeting = targeting
  .replace(
    /import \{[^}]+\} from "\.\/geometry";/,
    'import { closestPointOnGoal, distToGoal, distUnits } from "./geometry";',
  )
  .replace(
    /import \{[^}]+\} from "\.\/goals";/,
    'import { findGoal, nearestEnemyGoal } from "./goals";',
  )
  .replace(/closestPointOnGoal/g, "closestPointOnGoal")
  .replace(/distUnits/g, "distUnits")
  .replace(/nearestEnemyGoal/g, "nearestEnemyGoal");
fs.writeFileSync("src/systems/targeting.ts", targeting);

let projectiles = fs.readFileSync("src/systems/projectiles.ts", "utf8");
projectiles = projectiles
  .replace(/applyGoalDamage/g, "applyGoalDamage")
  .replace(/applyUnitDamage/g, "applyUnitDamage");
// damage file exports applyGoalDamage / applyUnitDamage — verify
const damage = fs.readFileSync("src/systems/damage.ts", "utf8");
const goalFn = damage.includes("export function applyGoalDamage")
  ? "applyGoalDamage"
  : damage.includes("export function applyGoalDamage")
    ? "applyGoalDamage"
    : "applyGoalDamage";
const unitFn = damage.includes("export function applyUnitDamage")
  ? "applyUnitDamage"
  : "applyUnitDamage";
projectiles = projectiles
  .replace(/applyGoalDamage|applyGoalDamage/g, goalFn)
  .replace(/applyUnitDamage|applyUnitDamage/g, unitFn);
fs.writeFileSync("src/systems/projectiles.ts", projectiles);

let intents = fs.readFileSync("src/systems/intents.ts", "utf8");
const goalsSrc = fs.readFileSync("src/systems/goals.ts", "utf8");
const deployFn = goalsSrc.includes("export function deployBoundY")
  ? "deployBoundY"
  : "deployBoundY";
intents = intents.replace(/deployBoundY|deployBoundY/g, deployFn);
const spawnFn = fs.readFileSync("src/entities/factory.ts", "utf8").includes(
  "export function spawnFromCard",
)
  ? "spawnFromCard"
  : "spawnFromCard";
intents = intents.replace(/spawnFromCard|spawnFromCard/g, spawnFn);
fs.writeFileSync("src/systems/intents.ts", intents);

let ai = fs.readFileSync("src/systems/ai.ts", "utf8");
ai = ai.replace(/deployBoundY|deployBoundY/g, deployFn);
fs.writeFileSync("src/systems/ai.ts", ai);

console.log("geometry exports check done");
console.log("damage goal fn", goalFn, "unit fn", unitFn, "deploy", deployFn, "spawn", spawnFn);
