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

for (const f of [
  "src/config/types.ts",
  "src/config/match.ts",
  "src/config/units.ts",
  "src/config/tiles.ts",
  "src/entities/factory.ts",
  "src/systems/targeting.ts",
  "src/systems/damage.ts",
  "src/systems/movement.ts",
]) {
  if (fs.existsSync(f)) read(f);
}

// Fix spawn clamp radius (tiles → px)
let fac = read("src/entities/factory.ts");
fac = fac.replace(
  /const x = clamp\(\s*intent\.x \+ offsetX,\s*def\.radius,\s*state\.config\.arena\.width - def\.radius,\s*\);/,
  `const r = def.radius * state.config.tileSize;
    const x = clamp(
      intent.x + offsetX,
      r,
      state.config.arena.width - r,
    );`,
);
fac = fac.replace(
  /const y = clamp\(\s*intent\.y,\s*def\.radius,\s*state\.config\.arena\.height - def\.radius,\s*\);/,
  `const y = clamp(
      intent.y,
      r,
      state.config.arena.height - r,
    );`,
);
write("src/entities/factory.ts", fac);
console.log("factory radius clamp fixed");

// Charge moveDistance in tiles
let mov = read("src/systems/movement.ts");
console.log("before charge", mov.match(/moveDistance[\s\S]{0,100}/)?.[0]);
if (mov.includes("def.ability.moveDistance") && !mov.includes("moveDistance *")) {
  mov = mov.replace(
    /charge\.movingDistance >= def\.ability\.moveDistance/,
    `charge.movingDistance >= def.ability.moveDistance * state.config.tileSize`,
  );
  mov = mov.replace(
    /charge\.movingDistance >= [\w.]+moveDistance/,
    (m) =>
      m.includes("tileSize")
        ? m
        : m.replace(/moveDistance/, "moveDistance * state.config.tileSize"),
  );
  write("src/systems/movement.ts", mov);
  console.log("movement charge fixed");
} else {
  // show context
  const i = mov.indexOf("moveDistance");
  console.log(mov.slice(i - 80, i + 120));
}

// Damage aura
let dmg = read("src/systems/damage.ts");
console.log("damage aura line", dmg.match(/.{0,40}ability\.radius.{0,60}/)?.[0]);
if (/ability\.radius(?! \* state\.config\.tileSize)/.test(dmg)) {
  dmg = dmg.replace(
    /(<=\s*)(def\.ability\.radius)\b/g,
    "$1$2 * state.config.tileSize",
  );
  write("src/systems/damage.ts", dmg);
  console.log("damage retouched");
}

// Render: unit radius from def is tiles — multiply
let render = read("src/ui/render.ts");
const radiusUses = render.match(/def\.radius/g) || [];
console.log("render def.radius count", radiusUses.length);
if (radiusUses.length && !render.includes("def.radius * state.config.tileSize") && !render.includes("def.radius *")) {
  // common pattern: const r = def.radius;
  render = render.replace(
    /const r = def\.radius;/g,
    `const r = def.radius * state.config.tileSize;`,
  );
  render = render.replace(
    /getUnitDef\((\w+)\.defId\)\.radius/g,
    `getUnitDef($1.defId).radius * state.config.tileSize`,
  );
  write("src/ui/render.ts", render);
  console.log("render radius patched");
}

// intents isInOwnHalf uses def.radius
let intents = read("src/systems/intents.ts");
console.log("intents radius", intents.match(/.{0,30}radius.{0,40}/g)?.slice(0, 5));

// input similarly
let input = read("src/systems/input.ts");
console.log("input radius", input.match(/.{0,30}\.radius.{0,40}/g)?.slice(0, 5));

console.log("phase2 done");
