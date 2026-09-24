import type { GameState, Goal, Unit } from "../config/types";
import { getCardDef, isSpellDef } from "../config/cards";
import { getUnitDef } from "../config/units";
import { deployRadiusPx, isInOwnHalf, isOnPitch } from "../systems/intents";
import { riverLayout } from "../systems/lanes";
import { behindSign, enemyOf, findDiveTarget } from "../systems/spells";

export type CanvasView = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale: number;
  offsetX: number;
  offsetY: number;
  toWorld: (clientX: number, clientY: number) => { x: number; y: number } | null;
  resize: () => void;
};

export function createCanvasView(canvas: HTMLCanvasElement): CanvasView {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  const view: CanvasView = {
    canvas,
    ctx,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    toWorld(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const cssX = clientX - rect.left;
      const cssY = clientY - rect.top;
      const x = (cssX - view.offsetX) / view.scale;
      const y = (cssY - view.offsetY) / view.scale;
      return { x, y };
    },
    resize() {
      // filled below
    },
  };

  view.resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return;
    const nextW = Math.floor(cssW * dpr);
    const nextH = Math.floor(cssH * dpr);
    if (canvas.width === nextW && canvas.height === nextH) return;
    canvas.width = nextW;
    canvas.height = nextH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  view.resize();
  const observer = new ResizeObserver(() => view.resize());
  observer.observe(canvas);
  return view;
}

export function renderFrame(view: CanvasView, state: GameState): void {
  const { ctx, canvas } = view;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const { width: aw, height: ah } = state.config.arena;

  const scale = Math.min(cssW / aw, cssH / ah);
  const offsetX = (cssW - aw * scale) / 2;
  const offsetY = (cssH - ah * scale) / 2;
  view.scale = scale;
  view.offsetX = offsetX;
  view.offsetY = offsetY;

  ctx.clearRect(0, 0, cssW, cssH);
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
  drawHighLine(ctx, state);
  drawDamageFloats(ctx, state);
  if (state.selectedId) drawDeployHint(ctx, state);
  drawDeployPreview(ctx, state);

  ctx.restore();
}

function drawPitch(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state.config.arena;

  ctx.fillStyle = "#1a6b3a";
  ctx.fillRect(0, 0, width, height);

  // stripes
  ctx.fillStyle = "#1f7542";
  for (let i = 0; i < 8; i++) {
    if (i % 2 === 0) {
      ctx.fillRect(0, (height / 8) * i, width, height / 8);
    }
  }

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, width - 8, height - 8);

  const river = riverLayout(state.config);
  ctx.fillStyle = "#1a4f86";
  ctx.fillRect(0, river.top, width, river.bottom - river.top);

  for (const bridge of [river.left, river.right]) {
    ctx.fillStyle = "#c4b49a";
    ctx.fillRect(bridge.x, bridge.y, bridge.w, bridge.h);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(bridge.x, bridge.y, bridge.w, bridge.h);
  }

  // Halfway line + center circle (tile grid markings)
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

  // half tint for deploy zones
  ctx.fillStyle = "rgba(60,120,255,0.06)";
  ctx.fillRect(0, river.bottom, width, height - river.bottom);
  ctx.fillStyle = "rgba(220,60,60,0.06)";
  ctx.fillRect(0, 0, width, river.top);
}

function drawGoals(ctx: CanvasRenderingContext2D, state: GameState): void {
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
    ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + a * 0.7})`;
    ctx.fillRect(goal.x - 2, goal.y - 2, goal.w + 4, goal.h + 4);
    ctx.strokeStyle = `rgba(255, 240, 180, ${a})`;
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
    `${tag} ${goal.hp}`,
    goal.x + goal.w / 2,
    goal.y + goal.h / 2,
  );
}

function drawAuras(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const u of state.units) {
    if (u.hp <= 0) continue;
    const def = getUnitDef(u.defId);
    if (def.ability?.kind !== "aura") continue;
    ctx.beginPath();
    ctx.arc(u.x, u.y, def.ability.radius * state.config.tileSize, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(80, 220, 120, 0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(80, 220, 120, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawUnit(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  unit: Unit,
): void {
  const def = getUnitDef(unit.defId);
  const color = unit.side === "player" ? "#2196f3" : "#e53935";
  const r = def.radius * state.config.tileSize;
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
      : spawnScale;
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

  // Wall: wide horizontal barrier (3 tiles)
  if (def.ability?.kind === "wall") {
    const tile = state.config.tileSize;
    const w = def.ability.widthTiles * tile;
    const h = Math.max(r * 2, tile * 0.7);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.45 + 0.55 * scale;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#0d1b2a";
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // Brick seams
    ctx.strokeStyle = "rgba(13, 27, 42, 0.45)";
    ctx.lineWidth = 1;
    for (let i = 1; i < def.ability.widthTiles; i++) {
      const sx = -w / 2 + (w * i) / def.ability.widthTiles;
      ctx.beginPath();
      ctx.moveTo(sx, -h / 2);
      ctx.lineTo(sx, h / 2);
      ctx.stroke();
    }
    if (unit.hitFlash > 0) {
      const flashA = Math.min(
        1,
        unit.hitFlash / Math.max(0.0001, state.config.hitFlashDuration),
      );
      ctx.fillStyle = `rgba(255, 255, 255, ${0.55 + flashA * 0.45})`;
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(unit.label, 0, 0);
    ctx.restore();

    if (deathProgress > 0) {
      const ringR = (w / 2) * (1 + deathProgress * 0.6);
      ctx.beginPath();
      ctx.ellipse(unit.x, unit.y, ringR, h * (1 + deathProgress), 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * (1 - deathProgress)})`;
      ctx.lineWidth = 3 * (1 - deathProgress * 0.5);
      ctx.stroke();
    }

    if (deathProgress <= 0) {
      const barW = w * 0.9;
      const barH = 4;
      const bx = unit.x - barW / 2;
      const by = unit.y - h / 2 - 10;
      const pct = Math.max(0, unit.hp / unit.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = pct > 0.35 ? "#66bb6a" : "#ef5350";
      ctx.fillRect(bx, by, barW * pct, barH);
    }
    return;
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

  // Hit flash — white body / overlay for a few frames
  if (unit.hitFlash > 0) {
    const flashA = Math.min(
      1,
      unit.hitFlash / Math.max(0.0001, state.config.hitFlashDuration),
    );
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.55 + flashA * 0.45})`;
    ctx.fill();
  }

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

  // Death ring expands in world space while the body shrinks
  if (deathProgress > 0) {
    const ringR = r * (1 + deathProgress * 2.2);
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * (1 - deathProgress)})`;
    ctx.lineWidth = 3 * (1 - deathProgress * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, ringR * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 * (1 - deathProgress)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Yellow card (Dive)
  if (unit.yellowCard) {
    const qw = 9;
    const qh = 12;
    const qx = unit.x + r * 0.65;
    const qy = unit.y - r - 4;
    ctx.fillStyle = "#fdd835";
    ctx.fillRect(qx, qy, qw, qh);
    ctx.strokeStyle = "#f9a825";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(qx, qy, qw, qh);
  }

  // Freeze ring
  if (unit.freezeT > 0) {
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(77, 208, 225, 0.9)";
    ctx.lineWidth = 3;
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
}

function drawProjectile(
  ctx: CanvasRenderingContext2D,
  p: GameState["projectiles"][number],
): void {
  const r = p.empowered ? 7 : 4;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = p.empowered
    ? "#ffeb3b"
    : p.side === "player"
      ? "#90caf9"
      : "#ef9a9a";
  ctx.fill();
}

function drawDeployHint(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (!state.selectedId) return;
  const def = getCardDef(state.selectedId);
  if (isSpellDef(def)) {
    // Spells cast anywhere — subtle whole-pitch cue
    const { arena } = state.config;
    ctx.fillStyle = "rgba(229, 57, 53, 0.08)";
    ctx.fillRect(0, 0, arena.width, arena.height);
    ctx.strokeStyle = "rgba(229, 57, 53, 0.45)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.strokeRect(8, 8, arena.width - 16, arena.height - 16);
    ctx.setLineDash([]);
    return;
  }

  const { arena } = state.config;
  const river = riverLayout(state.config);
  const y = river.bottom;
  const h = arena.height - y;
  ctx.fillStyle = "rgba(33, 150, 243, 0.12)";
  ctx.fillRect(0, y, arena.width, h);
  ctx.strokeStyle = "rgba(33, 150, 243, 0.5)";
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(6, y + 6, arena.width - 12, h - 12);
  ctx.setLineDash([]);
}

function drawDeployPreview(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (!state.selectedId || !state.hover || state.status !== "playing") return;
  const def = getCardDef(state.selectedId);

  if (isSpellDef(def) && def.spell === "highline") {
    drawHighLinePreview(ctx, state, def.pushTiles ?? 5);
    return;
  }
  if (isSpellDef(def) && def.spell === "dive") {
    drawDivePreview(ctx, state);
    return;
  }
  if (isSpellDef(def)) return;

  const { arena } = state.config;

  // Wall deploy preview — 3-tile barrier ghost
  if (def.ability?.kind === "wall") {
    const tile = state.config.tileSize;
    const w = def.ability.widthTiles * tile;
    const h = Math.max(def.radius * tile * 2, tile * 0.7);
    const margin = deployRadiusPx(state, state.selectedId!);
    const valid = isInOwnHalf(state, "player", state.hover.x, state.hover.y, margin);
    const x = clamp(state.hover.x, margin, arena.width - margin);
    const y = clamp(state.hover.y, h / 2, arena.height - h / 2);
    ctx.save();
    ctx.globalAlpha = valid ? 0.72 : 0.35;
    ctx.fillStyle = valid ? "#2196f3" : "#e53935";
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.strokeStyle = valid ? "#ffeb3b" : "#ef9a9a";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.label, x, y);
    ctx.restore();
    return;
  }

  const rPx = def.radius * state.config.tileSize;
  const valid = isInOwnHalf(state, "player", state.hover.x, state.hover.y, deployRadiusPx(state, state.selectedId!));
  const count = def.spawnCount ?? 1;

  ctx.save();
  ctx.globalAlpha = valid ? 0.72 : 0.35;
  for (let i = 0; i < count; i++) {
    const variant = def.spawnVariants?.[i];
    const offsetX = (variant?.offsetX ?? 0) * state.config.tileSize;
    const x = clamp(state.hover.x + offsetX, rPx, arena.width - rPx);
    const y = clamp(state.hover.y, rPx, arena.height - rPx);
    const r = rPx;
    const label = variant?.label ?? def.label;

    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = valid ? "#ffeb3b" : "#ef9a9a";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = valid ? "#2196f3" : "#e53935";
    ctx.fill();
    ctx.strokeStyle = "#0d1b2a";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
  }
  ctx.restore();
}

function drawHighLinePreview(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  pushTiles: number,
): void {
  if (!state.hover) return;
  const valid = isOnPitch(state, state.hover.x, state.hover.y);
  const foe = enemyOf("player");
  const sign = behindSign(foe);
  const dist = pushTiles * state.config.tileSize;
  const { width } = state.config.arena;
  const enemies = state.units.filter(
    (u) => u.side === foe && u.hp > 0 && u.deathT <= 0,
  );

  let lineY = state.config.midlineY;
  if (enemies.length > 0) {
    const ys = enemies.map((u) => u.y);
    lineY = foe === "ai" ? Math.max(...ys) : Math.min(...ys);
  }

  ctx.save();
  ctx.globalAlpha = valid ? 0.85 : 0.35;

  // Ghost trail showing shove direction
  const grad = ctx.createLinearGradient(0, lineY, 0, lineY + sign * dist);
  grad.addColorStop(0, "rgba(229, 57, 53, 0.05)");
  grad.addColorStop(1, "rgba(229, 57, 53, 0.28)");
  ctx.fillStyle = grad;
  const top = Math.min(lineY, lineY + sign * dist);
  const h = Math.abs(sign * dist);
  ctx.fillRect(0, top, width, h);

  ctx.strokeStyle = "#e53935";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(12, lineY);
  ctx.lineTo(width - 12, lineY);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 235, 238, 0.95)";
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`HighLine · to half line`, width / 2, lineY - sign * 18);
  ctx.restore();
}

function drawHighLine(ctx: CanvasRenderingContext2D, state: GameState): void {
  const fx = state.highLineFx;
  if (!fx) return;
  const { width } = state.config.arena;
  const progress = Math.min(1, fx.t / Math.max(0.0001, fx.duration));

  ctx.save();

  // Sweep band behind the line
  const bandH = 28 + progress * 18;
  const grad = ctx.createLinearGradient(
    0,
    fx.lineY - bandH,
    0,
    fx.lineY + bandH,
  );
  grad.addColorStop(0, "rgba(229, 57, 53, 0)");
  grad.addColorStop(0.45, "rgba(229, 57, 53, 0.35)");
  grad.addColorStop(0.5, "rgba(255, 120, 100, 0.55)");
  grad.addColorStop(0.55, "rgba(229, 57, 53, 0.35)");
  grad.addColorStop(1, "rgba(229, 57, 53, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, fx.lineY - bandH, width, bandH * 2);

  // Core red push line
  ctx.strokeStyle = `rgba(255, 40, 40, ${0.75 + 0.25 * (1 - progress)})`;
  ctx.lineWidth = 6;
  ctx.shadowColor = "rgba(255, 60, 40, 0.85)";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(0, fx.lineY);
  ctx.lineTo(width, fx.lineY);
  ctx.stroke();

  // Secondary thinner edge
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255, 220, 200, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, fx.lineY);
  ctx.lineTo(width, fx.lineY);
  ctx.stroke();

  ctx.restore();
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}


function drawDivePreview(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (!state.hover) return;
  const { x, y } = state.hover;
  const target = findDiveTarget(state, "player", x, y);
  const valid = isOnPitch(state, x, y);
  ctx.save();
  ctx.globalAlpha = valid ? 0.9 : 0.35;
  ctx.beginPath();
  ctx.arc(x, y, state.config.tileSize * 1.5, 0, Math.PI * 2);
  ctx.strokeStyle = target ? "#ffeb3b" : "#90a4ae";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  if (target?.kind === "goal") {
    const goal = state.goals.find((g) => g.id === target.goalId);
    if (goal) {
      ctx.strokeStyle = "#ffeb3b";
      ctx.lineWidth = 3;
      ctx.strokeRect(goal.x - 2, goal.y - 2, goal.w + 4, goal.h + 4);
      ctx.fillStyle = "#fff59d";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("−1", goal.x + goal.w / 2, goal.y + goal.h / 2);
    }
  } else if (target?.kind === "unit") {
    const unit = state.units.find((u) => u.id === target.unitId);
    if (unit) {
      const ur = getUnitDef(unit.defId).radius * state.config.tileSize;
      ctx.beginPath();
      ctx.arc(unit.x, unit.y, ur + 8, 0, Math.PI * 2);
      ctx.strokeStyle = "#fdd835";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#fdd835";
      ctx.font = "bold 11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("YC", unit.x, unit.y - ur - 12);
    }
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(
    target?.kind === "goal"
      ? "Dive · Tower −1"
      : target?.kind === "unit"
        ? "Dive · Yellow card"
        : "Dive · aim tower or troop",
    x,
    y - state.config.tileSize * 1.5 - 8,
  );
  ctx.restore();
}
