const fs = require("fs");

function read(p) {
  const b = fs.readFileSync(p);
  return b[1] === 0
    ? b.toString("utf16le").replace(/^\uFEFF/, "")
    : b.toString("utf8");
}
function write(p, s) {
  fs.writeFileSync(p, s, "utf8");
}

// --- Align match.ts keys with MatchConfig ---
let types = read("src/config/types.ts");
const matchKeys = [...read("src/config/match.ts").matchAll(/^\s+(\w+):/gm)].map(
  (x) => x[1],
);
const typeBody = types.match(/export interface MatchConfig \{([\s\S]*?)\n\}/)[1];
const typeKeys = [...typeBody.matchAll(/^\s+(\w+)/gm)].map((x) => x[1]);
console.log("in match not types", matchKeys.filter((k) => !typeKeys.includes(k)));
console.log("in types not match", typeKeys.filter((k) => !matchKeys.includes(k)));

// Print UnitDef ability fields and Unit spawn conversion site
const units = read("src/config/units.ts");
console.log("ability kinds", units.match(/kind: \"\w+\"/g));
const factoryPath = fs.existsSync("src/entities/factory.ts")
  ? "src/entities/factory.ts"
  : "src/entities/factory.ts";
console.log("factory", factoryPath);
const fac = read(factoryPath);
console.log(
  "createUnit speed/range",
  fac.match(/speed:[\s\S]{0,80}range:[\s\S]{0,80}/)?.[0],
);
console.log("ChargeAbility", types.match(/export interface ChargeAbility[\s\S]*?\n\}/)?.[0]);
console.log("AuraAbility", types.match(/export interface AuraAbility[\s\S]*?\n\}/)?.[0]);
console.log("SpawnVariant", types.match(/export interface SpawnVariant[\s\S]*?\n\}/)?.[0]);
