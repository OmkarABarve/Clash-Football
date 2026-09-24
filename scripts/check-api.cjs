const fs = require("fs");
const t = fs.readFileSync("src/config/types.ts", "utf8");
const m = fs.readFileSync("src/config/match.ts", "utf8");
const mc = t.match(/export interface MatchConfig \{([\s\S]*?)\n\}/)[1];
const typeKeys = [...mc.matchAll(/^\s+(\w+)[?:]?:/gm)].map((x) => x[1]);
const matchKeys = [...m.matchAll(/^\s+(\w+):/gm)]
  .map((x) => x[1])
  .filter((k) => k !== "width" && k !== "height");
console.log("in match not types", matchKeys.filter((k) => !typeKeys.includes(k)));
console.log("in types not match", typeKeys.filter((k) => !matchKeys.includes(k)));

const s = fs.readFileSync("src/systems/spells.ts", "utf8");
console.log(
  "spells exports",
  [...s.matchAll(/export function (\w+)/g)].map((x) => x[1]),
);
const lim = s.match(/import \{([^}]+)\} from "\.\/lanes"/);
console.log("spells lanes import", lim && lim[1]);
const lanes = fs.readFileSync("src/systems/lanes.ts", "utf8");
console.log(
  "lanes exports",
  [...lanes.matchAll(/export function (\w+)/g)].map((x) => x[1]),
);

const ai = fs.readFileSync("src/systems/ai.ts", "utf8");
console.log("ai livingEnemy", /livingEnemyCount/.test(ai), "midlineY", /midlineY/.test(ai), "midlineY", /midlineY/.test(ai));
console.log("ai unitRadius", /unitRadiusDefault/.test(ai), "aiInterval", /aiInterval/.test(ai));

const loop = fs.readFileSync("src/systems/loop.ts", "utf8");
console.log("loop updateHighLine", /updateHighLine/.test(loop), "updateHighLine", /updateHighLine/.test(loop));

const mov = fs.readFileSync("src/systems/movement.ts", "utf8");
console.log("mov unitLockedBySpell", /unitLockedBySpell/.test(mov), "unitLockedBySpell", /unitLockedBySpell/.test(mov));

const cards = fs.readFileSync("src/config/cards.ts", "utf8");
console.log("cards enabledUnitIds", /enabledUnitIds/.test(cards), "enabledUnitIds", /enabledUnitIds/.test(cards));
const units = fs.readFileSync("src/config/units.ts", "utf8");
console.log("units exports", [...units.matchAll(/export function (\w+)/g)].map((x) => x[1]));

const render = fs.readFileSync("src/ui/render.ts", "utf8");
console.log("render drawHighLine", /drawHighLine/.test(render), "behindSign", /behindSign/.test(render), "enemyOf", /enemyOf/.test(render));
