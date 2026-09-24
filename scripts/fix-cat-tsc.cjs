const fs = require("fs");

// Fix HUD: cat in scope for both branches
let h = fs.readFileSync("src/ui/hud.ts", "utf8");
h = h.replace(
  `    if (isSpellDef(def)) {
      btn.innerHTML = \`
        <span class="card-name">\${def.name}</span>
        <span class="card-label">\${def.label}</span>
        <span class="card-cost">\${def.cost} M</span>
        <span class="card-stats">\${cat} · \${
          def.spell === "dive"
            ? "SPELL · Tower −1 / YC"
            : def.spell === "highline"
              ? "SPELL · To half line"
              : "SPELL"
        }</span>
      \`;
    } else {
      const dps = unitDps(def);
      const hit = unitHitSpeed(def);
      const cat = cardCategory(def).toUpperCase();
      btn.innerHTML = \`
        <span class="card-name">\${def.name}</span>
        <span class="card-label">\${def.label}</span>
        <span class="card-cost">\${def.cost} M</span>
        <span class="card-stats">DMG \${def.damage} · Hit \${hit}s · DPS \${dps}</span>
      \`;
    }`,
  `    const cat = cardCategory(def).toUpperCase();
    if (isSpellDef(def)) {
      btn.innerHTML = \`
        <span class="card-name">\${def.name}</span>
        <span class="card-label">\${def.label}</span>
        <span class="card-cost">\${def.cost} M</span>
        <span class="card-stats">\${cat} · \${
          def.spell === "dive"
            ? "Tower −1 / YC"
            : def.spell === "highline"
              ? "To half line"
              : "SPELL"
        }</span>
      \`;
    } else {
      const dps = unitDps(def);
      const hit = unitHitSpeed(def);
      btn.innerHTML = \`
        <span class="card-name">\${def.name}</span>
        <span class="card-label">\${def.label}</span>
        <span class="card-cost">\${def.cost} M</span>
        <span class="card-stats">\${cat} · DMG \${def.damage} · Hit \${hit}s · DPS \${dps}</span>
      \`;
    }`,
);

if (!h.includes("cardCategory")) {
  throw new Error("cardCategory import missing");
}
fs.writeFileSync("src/ui/hud.ts", h, "utf8");
console.log("hud fixed");

// Simplify targeting wall/building skip — use category primarily
let tg = fs.readFileSync("src/systems/targeting.ts", "utf8");
const old = `    if (def.ability?.kind === "wall" || unitCategory(def) === "building") {
      // Buildings do not acquire targets.
      if (def.ability?.kind === "wall" || def.damage <= 0) {
        unit.target = null;
        unit.activeRange = 0;
        continue;
      }
    }
    if (def.ability?.kind === "wall") {
      unit.target = null;
      unit.activeRange = 0;
      continue;
    }
`;
const neu = `    // Buildings (e.g. Wall) never acquire targets.
    if (unitCategory(def) === "building" || def.damage <= 0) {
      unit.target = null;
      unit.activeRange = 0;
      continue;
    }
`;
if (tg.includes(old)) {
  tg = tg.replace(old, neu);
} else if (tg.includes('unitCategory(def) === "building"')) {
  // already partially there — force-replace first building block loosely
  tg = tg.replace(
    /\/\/ Buildings do not acquire targets\.[\s\S]*?continue;\n    \}\n\n    const enemies/,
    `// Buildings (e.g. Wall) never acquire targets.
    if (unitCategory(def) === "building" || def.damage <= 0) {
      unit.target = null;
      unit.activeRange = 0;
      continue;
    }

    const enemies`,
  );
  // remove leftover wall-only block if any
  tg = tg.replace(
    /if \(def\.ability\?\.kind === "wall" \|\| unitCategory\(def\) === "building"\) \{[\s\S]*?continue;\n    \}\n/g,
    "",
  );
  tg = tg.replace(
    /if \(def\.ability\?\.kind === "wall"\) \{[\s\S]*?continue;\n    \}\n/g,
    "",
  );
}
fs.writeFileSync("src/systems/targeting.ts", tg, "utf8");
console.log("targeting cleaned");
