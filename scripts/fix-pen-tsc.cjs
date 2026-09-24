const fs = require("fs");

function fix(rel, fn) {
  let s = fs.readFileSync(rel, "utf8");
  if (s.charCodeAt(1) === 0) s = Buffer.from(s, "utf16le").toString("utf8").replace(/^\uFEFF/, "");
  const out = fn(s);
  if (out !== s) {
    fs.writeFileSync(rel, out, "utf8");
    console.log("updated", rel);
  } else {
    console.log("no change", rel);
  }
}

// HighLine: pushTiles is optional on SpellDef — assert for highline cast
fix("src/systems/spells.ts", (s) => {
  return s.replace(
    `  const spell = getSpellDef("highline");
  const foe = enemyOf(caster);
  const sign = behindSign(foe);
  const dist = spell.pushTiles * state.config.tileSize;`,
    `  const spell = getSpellDef("highline");
  const foe = enemyOf(caster);
  const sign = behindSign(foe);
  const pushTiles = spell.pushTiles ?? 5;
  const dist = pushTiles * state.config.tileSize;`,
  );
});

// Render preview: require pushTiles number; update label
fix("src/ui/render.ts", (s) => {
  let out = s.replace(
    `  if (isSpellDef(def) && def.spell === "highline") {
    drawHighLinePreview(ctx, state, def.pushTiles);
    return;
  }`,
    `  if (isSpellDef(def) && def.spell === "highline") {
    drawHighLinePreview(ctx, state, def.pushTiles ?? 5);
    return;
  }`,
  );
  out = out.replace(
    /HighLine · push \$\{pushTiles\} tiles/,
    "HighLine · to half line",
  );
  // Also handle template without escape
  out = out.replace(
    "`HighLine · push ${pushTiles} tiles`",
    "`HighLine · to half line`",
  );
  return out;
});

// Ensure Neymar is buffed
fix("src/config/units.ts", (s) => {
  return s
    .replace(/(neymar: \{[\s\S]*?speed: )[\d.]+/, "$13.1")
    .replace(/(neymar: \{[\s\S]*?radius: )[\d.]+/, "$10.48");
});

console.log("done");
