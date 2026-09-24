const fs = require("fs");

function setImport(src, modulePath, names) {
  const re = new RegExp(
    String.raw`import \{[^}]*\} from "` + modulePath.replace("/", "\\/") + String.raw`";`,
  );
  return src.replace(re, `import { ${names.join(", ")} } from "${modulePath}";`);
}

let targeting = fs.readFileSync("src/systems/targeting.ts", "utf8");
targeting = setImport(targeting, "./geometry", [
  "closestPointOnGoal",
  "distToGoal",
  "distUnits",
]);
targeting = setImport(targeting, "./goals", ["findGoal", "nearestEnemyGoal"]);
targeting = targeting
  .replace(/\bclosestPointOnGoal\b/g, "closestPointOnGoal")
  .replace(/\bdistUnits\b/g, "distUnits")
  .replace(/\bnearestEnemyGoal\b/g, "nearestEnemyGoal")
  .replace(/\bdistToGoal\b/g, "distToGoal");
fs.writeFileSync("src/systems/targeting.ts", targeting);

let projectiles = fs.readFileSync("src/systems/projectiles.ts", "utf8");
projectiles = setImport(projectiles, "./damage", [
  "applyGoalDamage",
  "applyUnitDamage",
]);
projectiles = projectiles
  .replace(/\bapplyGoalDamage\b/g, "applyGoalDamage")
  .replace(/\bapplyUnitDamage\b/g, "applyUnitDamage");
fs.writeFileSync("src/systems/projectiles.ts", projectiles);

let intents = fs.readFileSync("src/systems/intents.ts", "utf8");
intents = setImport(intents, "../entities/factory", ["spawnFromCard"]);
intents = setImport(intents, "./goals", ["deployBoundY"]);
intents = intents
  .replace(/\bspawnFromCard\b/g, "spawnFromCard")
  .replace(/\bdeployBoundY\b/g, "deployBoundY");
fs.writeFileSync("src/systems/intents.ts", intents);

let ai = fs.readFileSync("src/systems/ai.ts", "utf8");
ai = setImport(ai, "./goals", ["deployBoundY"]);
ai = ai.replace(/\bdeployBoundY\b/g, "deployBoundY");
fs.writeFileSync("src/systems/ai.ts", ai);

console.log("done");
console.log("targeting geom:", targeting.match(/from "\.\/geometry";/)?.[0]);
console.log(targeting.split("\n").slice(0, 5).join("\n"));
