const fs = require("fs");
const t = fs.readFileSync("src/config/types.ts", "utf8");
console.log(t.match(/export type TargetRef =[\s\S]*?(?=\nexport )/)[0]);
const tw = fs.readFileSync("src/systems/towers.ts", "utf8");
console.log("towers has unit kind", /kind:\s*"unit"/.test(tw));
const p = fs.readFileSync("src/systems/projectiles.ts", "utf8");
console.log("projectile kinds", p.match(/kind === "[^"]+"/g));
console.log("createProjectile call sites use", tw.match(/target: \{[\s\S]*?\}/)[0]);
