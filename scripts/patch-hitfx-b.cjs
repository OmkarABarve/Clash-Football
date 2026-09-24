const fs = require("fs");

let render = fs.readFileSync("src/ui/render.ts", "utf8");

// Update draw loop to also draw floats after units
if (!render.includes("drawDamageFloats")) {
  const old = `  for (const u of state.units) drawUnit(ctx, state, u);
  for (const p of state.projectiles) drawProjectile(ctx, p);`;
  const neu = `  for (const u of state.units) drawUnit(ctx, state, u);
  for (const p of state.projectiles) drawProjectile(ctx, p);
  drawDamageFloats(ctx, state);`;
  if (!render.includes(old)) {
    console.error("draw loop missing");
    process.exit(1);
  }
  render = render.replace(old, neu);
}

const oldUnitStart = `function drawUnit(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  unit: Unit,
): void {
  const def = getUnitDef(unit.defId);
  const color = unit.side === "player" ? "#2196f3" : "#e53935";
  const r = def.radius;
  const puff = state.config.deployPuffDuration;
  const scale =
    unit.spawnT > 0 && puff > 0
      ? Math.max(0.05, 1 - unit.spawnT / puff)
      : 1;`;

const newUnitStart = `function drawUnit(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  unit: Unit,
): void {
  const def = getUnitDef(unit.defId);
  const color = unit.side === "player" ? "#2196f3" : "#e53935";
  const r = def.radius;
  const puff = state.config.deployPuffDuration;
  const spawnScale =
    unit.spawnT > 0 && puff > 0
      ? Math.max(0.05, 1 - unit.spawnT / puff)
      : 1;
  const deathDur = state.config.deathDuration;
  const deathProgress =
    unit.deathT > 0 && deathDur > 0
      ? 1 - unit.deathT / deathDur
      : 0;
  const scale =
    deathProgress > 0
      ? Math.max(0.05, spawnScale * (1 - deathProgress))
      : spawnScale;`;

if (!render.includes(oldUnitStart)) {
  console.error("drawUnit start missing");
  process.exit(1);
}
render = render.replace(oldUnitStart, newUnitStart);

// After body fill, add white flash overlay; before restore add death ring in world space after restore
const fillBlock = `  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.45 + 0.55 * scale;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#0d1b2a";
  ctx.lineWidth = 2;
  ctx.stroke();`;

const fillBlockNew = `  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.45 + 0.55 * scale;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#0d1b2a";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Hit flash — white body / overlay for a few frames
  if (unit.hitFlash > 0) {
    const flashA = Math.min(
      1,
      unit.hitFlash / Math.max(0.0001, state.config.hitFlashDuration),
    );
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = \`rgba(255, 255, 255, \${0.55 + flashA * 0.45})\`;
    ctx.fill();
  }`;

if (!render.includes(fillBlock)) {
  console.error("fill block missing");
  process.exit(1);
}
render = render.replace(fillBlock, fillBlockNew);

// After restore + HP bar, skip HP bar when dying; draw death ring in world space
const hpBlock = `  ctx.restore();

  // HP bar (unrotated, world space)
  const barW = r * 2.2;
  const barH = 4;
  const bx = unit.x - barW / 2;
  const by = unit.y - r - 10;
  const pct = Math.max(0, unit.hp / unit.maxHp);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(bx, by, barW, barH);
  ctx.fillStyle = pct > 0.35 ? "#66bb6a" : "#ef5350";
  ctx.fillRect(bx, by, barW * pct, barH);
}`;

const hpBlockNew = `  ctx.restore();

  // Death ring expands in world space while the body shrinks
  if (deathProgress > 0) {
    const ringR = r * (1 + deathProgress * 2.2);
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = \`rgba(255, 255, 255, \${0.55 * (1 - deathProgress)})\`;
    ctx.lineWidth = 3 * (1 - deathProgress * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, ringR * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = \`rgba(255, 255, 255, \${0.25 * (1 - deathProgress)})\`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // HP bar (hidden while dying)
  if (deathProgress <= 0) {
    const barW = r * 2.2;
    const barH = 4;
    const bx = unit.x - barW / 2;
    const by = unit.y - r - 10;
    const pct = Math.max(0, unit.hp / unit.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = pct > 0.35 ? "#66bb6a" : "#ef5350";
    ctx.fillRect(bx, by, barW * pct, barH);
  }
}

function drawDamageFloats(
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  for (const f of state.damageFloats) {
    const life = f.t / Math.max(0.0001, f.duration);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, life));
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 3;
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = String(f.amount);
    ctx.strokeText(label, f.x, f.y);
    ctx.fillText(label, f.x, f.y);
    ctx.restore();
  }
}`;

if (!render.includes(hpBlock)) {
  console.error("hp block missing");
  process.exit(1);
}
render = render.replace(hpBlock, hpBlockNew);

fs.writeFileSync("src/ui/render.ts", render, "utf8");
console.log("patched render");

// Ensure dying units don't keep acting (belt and suspenders — hp<=0 already skips most)
for (const file of [
  "src/systems/movement.ts",
  "src/systems/combat.ts",
  "src/systems/targeting.ts",
]) {
  let s = fs.readFileSync(file, "utf8");
  const needle = "if (unit.hp <= 0) continue;";
  const repl = "if (unit.hp <= 0 || unit.deathT > 0) continue;";
  if (s.includes(needle) && !s.includes("unit.deathT > 0")) {
    s = s.split(needle).join(repl);
    fs.writeFileSync(file, s, "utf8");
    console.log("patched", file, "death skip");
  } else {
    console.log("skip/already", file);
  }
}

console.log("phase B done");
