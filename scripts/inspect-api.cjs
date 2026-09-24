const fs = require("fs");
const u = fs.readFileSync("src/config/units.ts", "utf8");
console.log("cooldowns", u.match(/attackCooldown: [0-9.]+/g));
console.log("get fn", /export function get\w+/.exec(u)?.[0]);
console.log("defs const", /export const \w+/.exec(u)?.[0]);

const t = fs.readFileSync("src/config/types.ts", "utf8");
console.log("Unit interface", t.match(/export interface Unit \{[\s\S]*?\n\}/)?.[0]?.slice(0, 500));
console.log("Goal interface", t.match(/export interface Goal \{[\s\S]*?\n\}/)?.[0]);
console.log("MatchConfig tower-ish", (t.match(/tower\w+|princess\w+|king\w+|midline\w+/gi) || []).slice(0, 30));

const c = fs.readFileSync("src/systems/combat.ts", "utf8");
console.log("combat fields", [...new Set(c.match(/unit\.\w+/g) || [])]);

const m = fs.readFileSync("src/config/match.ts", "utf8");
console.log("match export", /export const \w+/.exec(m)?.[0]);
console.log("match keys", [...m.matchAll(/^\s+(\w+):/gm)].map((x) => x[1]).join(","));

const f = fs.readFileSync("src/entities/factory.ts", "utf8");
console.log("factory createUnit fields sample");
const body = f.match(/return \{[\s\S]*?deathT: 0,[\s\S]*?\};/)?.[0];
console.log(body?.slice(0, 600));
