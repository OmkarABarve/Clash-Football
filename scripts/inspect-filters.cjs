const fs = require("fs");
const u = fs.readFileSync("src/config/units.ts", "utf8");
const blocks = [...u.matchAll(/(\w+): \{[\s\S]*?targetFilter: "([^"]+)"/g)];
for (const m of blocks) console.log(m[1], m[2]);
const h = fs.readFileSync("src/ui/hud.ts", "utf8");
const i = h.indexOf("isSpellDef(def)");
console.log("--- hud ---");
console.log(h.slice(i, i + 700));
