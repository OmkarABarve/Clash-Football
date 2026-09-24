const fs = require("fs");
const t = fs.readFileSync("src/config/types.ts", "utf8");
console.log("TargetFilter", t.match(/TargetFilter = [^;]+/)?.[0]);
console.log("AttackMode", t.match(/AttackMode = [^;]+/)?.[0]);
console.log("has category", t.includes("category"));
console.log(
  "goals",
  [...fs.readFileSync("src/systems/goals.ts", "utf8").matchAll(/export function (\w+)/g)].map(
    (m) => m[1],
  ),
);
console.log(
  "targeting uses filter?",
  fs.readFileSync("src/systems/targeting.ts", "utf8").includes("targetFilter"),
);
const u = fs.readFileSync("src/config/units.ts", "utf8");
console.log(
  "filters",
  [...u.matchAll(/targetFilter: "([^"]+)"/g)].map((m) => m[1]),
);
console.log("Unit interface snippet");
console.log(t.match(/export interface Unit \{[\s\S]*?\n\}/)?.[0]?.slice(0, 600));
console.log("UnitDef attack field names");
console.log(t.match(/attackMode|attackMode|meleeRange|meleeRange/g));
