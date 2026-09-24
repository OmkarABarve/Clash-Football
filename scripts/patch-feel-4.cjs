const fs = require("fs");

let render = fs.readFileSync("src/ui/render.ts", "utf8");

const oldFrame = `  ctx.clearRect(0, 0, cssW, cssH);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  drawPitch(ctx, state);
  drawGoals(ctx, state);
  drawAuras(ctx, state);
  for (const u of state.units) drawUnit(ctx, u);
  for (const p of state.projectiles) drawProjectile(ctx, p);
  if (state.selectedId) drawDeployHint(ctx, state);
  drawDeployPreview(ctx, state);

  ctx.restore();
}`;

const newFrame = `  ctx.clearRect(0, 0, cssW, cssH);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  if (state.shake > 0.05) {
    const mag = state.shake;
    ctx.translate((Math.random() - 0.5) * 2 * mag, (Math.random() - 0.5) * 2 * mag);
  }

  drawPitch(ctx, state);
  drawGoals(ctx, state);
  drawAuras(ctx, state);
  for (const u of state.units) drawUnit(ctx, state, u);
  for (const p of state.projectiles) drawProjectile(ctx, p);
  if (state.selectedId) drawDeployHint(ctx, state);
  drawDeployPreview(ctx, state);

  ctx.restore();
}`;

if (!render.includes(oldFrame)) {
  console.error("renderFrame body missing");
  process.exit(1);
}
render = render.replace(oldFrame, newFrame);

const oldGoals = `function drawGoals(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const goal of state.goals) {
    if (goal.hp <= 0) continue;
    const color = goal.side === "ai" ? "#c62828" : "#1565c0";
    drawGoal(ctx, goal, color);
  }
}

function drawGoal(
  ctx: CanvasRenderingContext2D,
  goal: Goal,
  color: string,
): void {
  const isKing = goal.role === "king";
  const fill = isKing && !goal.activated
    ? goal.side === "ai"
      ? "#6d2a2a"
      : "#1a3a6d"
    : color;

  ctx.fillStyle = fill;
  ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
  ctx.strokeStyle = isKing ? "#ffd54f" : "#fff";
  ctx.lineWidth = isKing ? 3 : 2;
  ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);

  ctx.fillStyle = "#fff";
  ctx.font = isKing
    ? "bold 18px system-ui, sans-serif"
    : "bold 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tag = isKing ? "K" : goal.lane === "left" ? "L" : "R";
  ctx.fillText(
    \`\${tag} \${goal.hp}\`,
    goal.x + goal.w / 2,
    goal.y + goal.h / 2,
  );
}`;

const newGoals = `function drawGoals(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const goal of state.goals) {
    if (goal.hp <= 0) continue;
    const color = goal.side === "ai" ? "#c62828" : "#1565c0";
    const flash = state.goalFlashes.find((f) => f.goalId === goal.id);
    drawGoal(ctx, goal, color, flash?.t ?? 0, state.config.goalFlashDuration);
  }
}

function drawGoal(
  ctx: CanvasRenderingContext2D,
  goal: Goal,
  color: string,
  flashT: number,
  flashDuration: number,
): void {
  const isKing = goal.role === "king";
  const fill = isKing && !goal.activated
    ? goal.side === "ai"
      ? "#6d2a2a"
      : "#1a3a6d"
    : color;

  ctx.fillStyle = fill;
  ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
  ctx.strokeStyle = isKing ? "#ffd54f" : "#fff";
  ctx.lineWidth = isKing ? 3 : 2;
  ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);

  if (flashT > 0 && flashDuration > 0) {
    const a = Math.min(1, flashT / flashDuration);
    ctx.fillStyle = \`rgba(255, 255, 255, \${0.25 + a * 0.7})\`;
    ctx.fillRect(goal.x - 2, goal.y - 2, goal.w + 4, goal.h + 4);
    ctx.strokeStyle = \`rgba(255, 240, 180, \${a})\`;
    ctx.lineWidth = 4;
    ctx.strokeRect(goal.x - 3, goal.y - 3, goal.w + 6, goal.h + 6);
  }

  ctx.fillStyle = "#fff";
  ctx.font = isKing
    ? "bold 18px system-ui, sans-serif"
    : "bold 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tag = isKing ? "K" : goal.lane === "left" ? "L" : "R";
  ctx.fillText(
    \`\${tag} \${goal.hp}\`,
    goal.x + goal.w / 2,
    goal.y + goal.h / 2,
  );
}`;

if (!render.includes(oldGoals)) {
  console.error("drawGoals missing");
  process.exit(1);
}
render = render.replace(oldGoals, newGoals);

const oldUnit = `function drawUnit(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
): void {
  const def = getUnitDef(unit.defId);
  const color = unit.side === "player" ? "#2196f3" : "#e53935";
  const r = def.radius;

  // Charge visuals
  if (unit.charge) {
    if (unit.charge.ready) {
      ctx.beginPath();
      ctx.arc(unit.x, unit.y, r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (unit.charge.movingTime > 0 || unit.charge.movingDistance > 0) {
      const ability = def.ability?.kind === "charge" ? def.ability : null;
      const t = ability
        ? Math.max(
            unit.charge.movingTime / ability.moveTime,
            unit.charge.movingDistance / ability.moveDistance,
          )
        : 0;
      ctx.beginPath();
      ctx.arc(unit.x, unit.y, r + 6, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 235, 59, 0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  ctx.beginPath();
  ctx.arc(unit.x, unit.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#0d1b2a";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(unit.label, unit.x, unit.y);

  // HP bar
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

const newUnit = `function drawUnit(
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
      : 1;
  const recoil =
    unit.shootRecoil > 0
      ? (unit.shootRecoil / state.config.shootRecoilDuration) * 5
      : 0;
  const ox = unit.x - Math.cos(unit.facing) * recoil;
  const oy = unit.y - Math.sin(unit.facing) * recoil;

  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(unit.facing + Math.PI / 2);
  ctx.scale(scale, scale);

  // Charge visuals
  if (unit.charge) {
    if (unit.charge.ready) {
      ctx.beginPath();
      ctx.arc(0, 0, r + 8, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (unit.charge.movingTime > 0 || unit.charge.movingDistance > 0) {
      const ability = def.ability?.kind === "charge" ? def.ability : null;
      const t = ability
        ? Math.max(
            unit.charge.movingTime / ability.moveTime,
            unit.charge.movingDistance / ability.moveDistance,
          )
        : 0;
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 235, 59, 0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.45 + 0.55 * scale;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#0d1b2a";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Facing tip
  ctx.beginPath();
  ctx.moveTo(0, -r - 3);
  ctx.lineTo(5, -r + 5);
  ctx.lineTo(-5, -r + 5);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(unit.label, 0, 0);

  ctx.restore();

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

if (!render.includes(oldUnit)) {
  console.error("drawUnit missing");
  process.exit(1);
}
render = render.replace(oldUnit, newUnit);
fs.writeFileSync("src/ui/render.ts", render, "utf8");
console.log("patched render");

// ---------- HUD timer ----------
let hud = fs.readFileSync("src/ui/hud.ts", "utf8");
if (!hud.includes("syncMsBar(state);")) {
  console.error("hud sync missing");
  process.exit(1);
}
hud = hud.replace(
  `export function syncHud(state: GameState): void {
  syncMsBar(state);
  syncHand(state);
  syncEndScreen(state);
}`,
  `export function syncHud(state: GameState): void {
  syncTimer(state);
  syncMsBar(state);
  syncHand(state);
  syncEndScreen(state);
}

function syncTimer(state: GameState): void {
  const el = document.getElementById("match-timer");
  if (!el) return;
  const total = Math.max(0, Math.ceil(state.timeLeft));
  const m = Math.floor(total / 60);
  const s = total % 60;
  el.textContent = \`\${m}:\${s.toString().padStart(2, "0")}\`;
  el.classList.toggle("overtime", state.timeLeft <= state.config.lastMinuteSeconds);
}`,
);
fs.writeFileSync("src/ui/hud.ts", hud, "utf8");
console.log("patched hud");

// ---------- HTML ----------
let html = fs.readFileSync("index.html", "utf8");
if (!html.includes('id="ms-bar-wrap"')) {
  console.error("html ms wrap missing");
  process.exit(1);
}
html = html.replace(
  `      <div id="hud">
        <div id="ms-bar-wrap">
          <div id="ms-label">M's <span id="ms-value">5</span>/10</div>`,
  `      <div id="hud">
        <div id="match-timer" aria-label="Match timer">3:00</div>
        <div id="ms-bar-wrap">
          <div id="ms-label">M's <span id="ms-value">5</span>/10</div>`,
);
fs.writeFileSync("index.html", html, "utf8");
console.log("patched html");

// ---------- CSS ----------
let css = fs.readFileSync("src/style.css", "utf8");
if (!css.includes("#ms-bar-wrap")) {
  console.error("css missing");
  process.exit(1);
}
if (!css.includes("#match-timer")) {
  css = css.replace(
    `#ms-bar-wrap {
  margin-bottom: 10px;
}`,
    `#match-timer {
  text-align: center;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
  color: #e8eef7;
  font-variant-numeric: tabular-nums;
}

#match-timer.overtime {
  color: #ff7043;
}

#ms-bar-wrap {
  margin-bottom: 10px;
}`,
  );
  fs.writeFileSync("src/style.css", css, "utf8");
  console.log("patched css");
}

console.log("phase4 ok");
