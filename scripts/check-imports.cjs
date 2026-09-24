const fs = require("fs");
const r = fs.readFileSync("src/ui/render.ts", "utf8");
const i = fs.readFileSync("src/systems/intents.ts", "utf8");
const ri = r.match(/import \{([^}]+)\} from "\.\.\/systems\/intents"/)[1];
const ie = [...i.matchAll(/export function (\w+)/g)].map((x) => x[1]);
console.log("render imports from intents:", JSON.stringify(ri));
console.log("intents exports:", JSON.stringify(ie));
for (const name of ri.split(",").map((s) => s.trim())) {
  console.log(name, "=>", ie.includes(name));
}

const spells = fs.readFileSync("src/systems/spells.ts", "utf8");
console.log("first line", spells.split("\n")[0]);
console.log("death filter", spells.includes("deathT"), spells.includes("u.deathT"));
console.log("cooldown", spells.includes("cooldownLeft"));
