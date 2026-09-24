const fs = require("fs");

let mov = fs.readFileSync("src/systems/movement.ts", "utf8");
mov = mov.replace(
  /updateCharge\(unit, dt, 0, false\)/g,
  "updateCharge(unit, dt, 0, false, state.config.tileSize)",
);
mov = mov.replace(
  "updateCharge(unit, dt, moved, unit.movedThisTick);",
  "updateCharge(unit, dt, moved, unit.movedThisTick, state.config.tileSize);",
);
mov = mov.replace(
  `function updateCharge(
  unit: Unit,
  dt: number,
  distanceMoved: number,
  moved: boolean,
): void {`,
  `function updateCharge(
  unit: Unit,
  dt: number,
  distanceMoved: number,
  moved: boolean,
  tileSize: number,
): void {`,
);
mov = mov.replace(
  "charge.movingDistance >= ability.moveDistance * state.config.tileSize",
  "charge.movingDistance >= ability.moveDistance * tileSize",
);
fs.writeFileSync("src/systems/movement.ts", mov, "utf8");
console.log("movement ok");

let render = fs.readFileSync("src/ui/render.ts", "utf8");

// Patch deploy preview radius / offset (tiles → px)
const oldPreview = `  const { arena } = state.config;
  const valid = isInOwnHalf(state, "player", state.hover.x, state.hover.y, def.radius);
  const count = def.spawnCount ?? 1;

  ctx.save();
  ctx.globalAlpha = valid ? 0.72 : 0.35;
  for (let i = 0; i < count; i++) {
    const variant = def.spawnVariants?.[i];
    const offsetX = variant?.offsetX ?? 0;
    const x = clamp(state.hover.x + offsetX, def.radius, arena.width - def.radius);
    const y = clamp(state.hover.y, def.radius, arena.height - def.radius);
    const r = def.radius * state.config.tileSize;`;

const newPreview = `  const { arena } = state.config;
  const rPx = def.radius * state.config.tileSize;
  const valid = isInOwnHalf(state, "player", state.hover.x, state.hover.y, rPx);
  const count = def.spawnCount ?? 1;

  ctx.save();
  ctx.globalAlpha = valid ? 0.72 : 0.35;
  for (let i = 0; i < count; i++) {
    const variant = def.spawnVariants?.[i];
    const offsetX = (variant?.offsetX ?? 0) * state.config.tileSize;
    const x = clamp(state.hover.x + offsetX, rPx, arena.width - rPx);
    const y = clamp(state.hover.y, rPx, arena.height - rPx);
    const r = rPx;`;

if (render.includes(oldPreview)) {
  render = render.replace(oldPreview, newPreview);
  console.log("preview block replaced");
} else {
  console.log("preview block NOT found — dumping nearby");
  const i = render.indexOf("drawDeployPreview");
  console.log(render.slice(i, i + 700));
}

// Add pitch markings after river/bridges in drawPitch
if (!render.includes("centerCircleRadius")) {
  const marker = `  // half tint for deploy zones`;
  const markings = `  // Halfway line + center circle (tile grid markings)
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, state.config.midlineY);
  ctx.lineTo(width, state.config.midlineY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width / 2, state.config.midlineY, state.config.centerCircleRadius, 0, Math.PI * 2);
  ctx.stroke();
  // Penalty boxes
  const pw = state.config.penaltyWidth;
  const pd = state.config.penaltyDepth;
  const px = (width - pw) / 2;
  ctx.strokeRect(px, 0, pw, pd);
  ctx.strokeRect(px, height - pd, pw, pd);

  // half tint for deploy zones`;
  if (render.includes(marker)) {
    render = render.replace(marker, markings);
    console.log("pitch markings added");
  } else {
    console.log("deploy zone marker not found");
  }
}

fs.writeFileSync("src/ui/render.ts", render, "utf8");
console.log("render written");
