const fs = require("fs");
const mov = fs.readFileSync("src/systems/movement.ts", "utf8");
const fac = fs.readFileSync("src/entities/factory.ts", "utf8");
const com = fs.readFileSync("src/systems/combat.ts", "utf8");
const typ = fs.readFileSync("src/config/types.ts", "utf8");
const mat = fs.readFileSync("src/config/match.ts", "utf8");
const ren = fs.readFileSync("src/ui/render.ts", "utf8");
const loop = fs.readFileSync("src/systems/loop.ts", "utf8");
const ai = fs.readFileSync("src/systems/ai.ts", "utf8");
const intents = fs.readFileSync("src/systems/intents.ts", "utf8");
const damage = fs.readFileSync("src/systems/damage.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");

function grab(src, re) {
  const m = src.match(re);
  return m ? m[0] : "NOT FOUND";
}

console.log("CHARGE TYPE:", grab(typ, /interface ChargeState[\s\S]*?\n}/));
console.log("FACTORY CHARGE:", grab(fac, /const charge[\s\S]*?: null/));
console.log("MOVE CHARGE PROPS:", [...mov.matchAll(/charge\.\w+/g)].map((m) => m[0]));
console.log("COMBAT CHARGE PROPS:", [...com.matchAll(/charge\.\w+/g)].map((m) => m[0]));
console.log("RENDER CHARGE PROPS:", [...ren.matchAll(/charge\.\w+/g)].map((m) => m[0]));
console.log("MATCH EXPORT:", grab(mat, /export const \w+/));
console.log(
  "DETECT/HYBRID match:",
  {
    unitDetectRange: mat.includes("unitDetectRange"),
    unitDetectRange2: mat.includes("unitDetectRange"),
    hybridMeleeExit: mat.includes("hybridMeleeExit"),
    hybridMeleeExit2: mat.includes("hybridMeleeExit"),
  },
);
console.log(
  "DETECT/HYBRID types:",
  {
    unitDetectRange: typ.includes("unitDetectRange"),
    unitDetectRange2: typ.includes("unitDetectRange"),
    hybridMeleeExit: typ.includes("hybridMeleeExit"),
    hybridMeleeExit2: typ.includes("hybridMeleeExit"),
  },
);
console.log("LOOP IMPORTS:", [...loop.matchAll(/import .*/g)].map((m) => m[0]).join("\n"));
console.log("AI FN:", grab(ai, /export function \w+/));
console.log("INTENTS FN:", grab(intents, /export function \w+/));
console.log("DAMAGE GOAL:", grab(damage, /export function applyGoal\w+/));
console.log("MAIN:", main);
