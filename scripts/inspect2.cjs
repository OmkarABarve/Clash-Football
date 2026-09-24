const fs = require("fs");

function read(p) {
  const b = fs.readFileSync(p);
  return b[1] === 0 ? b.toString("utf16le").replace(/^\uFEFF/, "") : b.toString("utf8");
}

console.log("--- combat import ---");
console.log(read("src/systems/combat.ts").split("\n").slice(0, 6).join("\n"));
console.log("--- match head ---");
console.log(read("src/config/match.ts").split("\n").slice(0, 8).join("\n"));
console.log("--- Goal create ---");
const f = read("src/entities/factory.ts");
console.log(f.includes("cooldownLeft"));
console.log("--- UnitDef attackMode ---");
const t = read("src/config/types.ts");
console.log(/attackMode/.test(t), /attackMode/.test(t));
console.log(t.match(/export interface UnitDef \{[\s\S]*?enabled\?: boolean;/)?.[0]?.slice(0, 400));
console.log("--- loop simulate ---");
console.log(read("src/systems/loop.ts").match(/function simulate[\s\S]*?^}/m)?.[0]);
