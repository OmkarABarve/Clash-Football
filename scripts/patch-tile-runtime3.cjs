const fs = require("fs");

function read(p) {
  const b = fs.readFileSync(p);
  if (b[1] === 0) {
    const s = b.toString("utf16le").replace(/^\uFEFF/, "");
    fs.writeFileSync(p, s, "utf8");
    return s;
  }
  return b.toString("utf8");
}
function write(p, s) {
  fs.writeFileSync(p, s, "utf8");
}

// Fix charge distance
let mov = read("src/systems/movement.ts");
if (!mov.includes("moveDistance * state.config.tileSize")) {
  mov = mov.replace(
    "charge.movingDistance >= ability.moveDistance",
    "charge.movingDistance >= ability.moveDistance * state.config.tileSize",
  );
  write("src/systems/movement.ts", mov);
  console.log("charge fixed");
} else console.log("charge already ok");

// intents: convert radius to px at call sites
let intents = read("src/systems/intents.ts");
intents = intents.replace(
  /isInOwnHalf\(state, intent\.side, intent\.x, intent\.y, def\.radius\)/g,
  `isInOwnHalf(state, intent.side, intent.x, intent.y, def.radius * state.config.tileSize)`,
);
write("src/systems/intents.ts", intents);

let input = read("src/systems/input.ts");
input = input.replace(
  /isInOwnHalf\(state, "player", world\.x, world\.y, def\.radius\)/g,
  `isInOwnHalf(state, "player", world.x, world.y, def.radius * state.config.tileSize)`,
);
write("src/systems/input.ts", input);
console.log("intents/input radius fixed");

// AI margin uses unitRadiusDefault which is already px — ok
// render deploy preview — check
let render = read("src/ui/render.ts");
console.log(
  "preview radius",
  render.match(/def\.radius/g)?.length,
  render.includes("def.radius * state.config.tileSize"),
);

// Ensure MatchConfig has the new fields (types)
let types = read("src/config/types.ts");
if (!types.includes("centerCircleRadius")) {
  // try alternate insert after tileSize
  if (types.includes("tileSize: number;")) {
    types = types.replace(
      "tileSize: number;",
      `tileSize: number;
  /** Center-circle radius in world px (authored in tiles). */
  centerCircleRadius: number;
  /** Penalty-area width in world px. */
  penaltyWidth: number;
  /** Penalty-area depth in world px. */
  penaltyDepth: number;`,
    );
    write("src/config/types.ts", types);
    console.log("added pitch fields to MatchConfig");
  } else {
    console.log("WARN: tileSize not found in types");
  }
} else console.log("types pitch fields ok");

// Verify match imports
const match = read("src/config/match.ts");
const tiles = read("src/config/tiles.ts");
console.log(
  "match imports buildPitchLayout",
  match.includes("buildPitchLayout"),
  "tiles exports",
  tiles.includes("export function buildPitchLayout"),
);

console.log("done");
