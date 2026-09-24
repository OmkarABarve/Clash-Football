const fs = require("fs");
let f = fs.readFileSync("src/entities/factory.ts", "utf8");
if (!f.includes("cooldownLeft: 0")) {
  f = f.replace(/activated: true,/g, "activated: true,\n      cooldownLeft: 0,");
  f = f.replace(/activated: false,/g, "activated: false,\n      cooldownLeft: 0,");
  fs.writeFileSync("src/entities/factory.ts", f, "utf8");
  console.log("factory cooldownLeft added");
} else {
  console.log("factory already has cooldownLeft");
}

const t = fs.readFileSync("src/config/types.ts", "utf8");
console.log("TargetRef", t.match(/export type TargetRef[\s\S]*?;/)?.[0]);
console.log("match king", fs.readFileSync("src/config/match.ts", "utf8").includes("kingTowerDamage"));
console.log("Goal cooldown", /export interface Goal \{[\s\S]*?cooldownLeft/.test(t));
