const fs = require("fs");

let factory = fs.readFileSync("src/entities/factory.ts", "utf8");

// Align imports/calls with actual module exports
factory = factory
  .replace(/import \{ nextId \} from "\.\/ids";/g, 'import { nextId } from "./ids";')
  .replace(/import \{ buildDeck \} from "\.\.\/systems\/cycle";/g, 'import { buildDeck } from "../systems/cycle";')
  .replace(/\bnextId\(/g, "nextId(")
  .replace(/\bbuildDeck\(/g, "buildDeck(");

// If I incorrectly used nextId/buildDeck as different wrong names:
factory = factory
  .replace(/import \{ [^}]+ \} from "\.\/ids";/, 'import { nextId } from "./ids";')
  .replace(/import \{ [^}]+ \} from "\.\.\/systems\/cycle";/, 'import { buildDeck } from "../systems/cycle";');

// Ensure createUnit uses nextId(state)
factory = factory.replace(/id: (?!nextId)[a-zA-Z]+\(state\)/g, "id: nextId(state)");

fs.writeFileSync("src/entities/factory.ts", factory);

// Fix goals helpers used by damage/match to consistent names already present
let goals = fs.readFileSync("src/systems/goals.ts", "utf8");
if (!goals.includes("export function findGoal")) {
  goals = goals.replace("export function findGoal", "export function findGoal");
}
fs.writeFileSync("src/systems/goals.ts", goals);

// Fix damage imports
let damage = fs.readFileSync("src/systems/damage.ts", "utf8");
damage = damage
  .replace(/activateKing/g, "activateKing")
  .replace(/findGoal/g, "findGoal")
  .replace(/role === "princess"/g, 'role === "princess"')
  .replace(/role === "king"/g, 'role === "king"');
fs.writeFileSync("src/systems/damage.ts", damage);

// Fix match system
let match = fs.readFileSync("src/systems/match.ts", "utf8");
match = match
  .replace(/MatchStatus/g, "MatchStatus")
  .replace(/kingGoal/g, "kingGoal")
  .replace(/"aiWin"/g, '"aiWin"')
  .replace(/"playerWin"/g, '"playerWin"');
fs.writeFileSync("src/systems/match.ts", match);

console.log("factory head:\n", factory.split("\n").slice(0, 16).join("\n"));
console.log("---");
console.log(fs.readFileSync("src/systems/match.ts", "utf8"));
