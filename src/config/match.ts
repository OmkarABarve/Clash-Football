import type { MatchConfig } from "./types";
import { TILE_SIZE, buildPitchLayout } from "./tiles";

const pitch = buildPitchLayout(TILE_SIZE);

/**
 * Match tunables. Pitch size / tower placement / river come from the
 * 18×32 tile grid in `tiles.ts` — change TILE_SIZE there to rescale.
 *
 * Distances on cards are authored in tiles; gameplay converts via tileSize.
 */
export const MATCH_CONFIG: MatchConfig = {
  princessMaxHp: 20,
  kingMaxHp: 20,
  startingM: 5,
  maxM: 10,
  regenInterval: 2.8,
  handSize: 4,

  // --- Pitch (derived from 18×32 tile grid) ---
  tileSize: pitch.tileSize,
  arena: pitch.arena,
  midlineY: pitch.midlineY,
  riverHeight: pitch.riverHeight,
  bridgeWidth: pitch.bridgeWidth,
  bridgeTowardCenter: pitch.bridgeTowardCenter,
  princessWidth: pitch.princessWidth,
  princessHeight: pitch.princessHeight,
  kingWidth: pitch.kingWidth,
  kingHeight: pitch.kingHeight,
  princessInsetX: pitch.princessInsetX,
  princessInsetY: pitch.princessInsetY,
  kingInset: pitch.kingInset,
  centerCircleRadius: pitch.centerCircleRadius,
  penaltyWidth: pitch.penalty.width,
  penaltyDepth: pitch.penalty.depth,

  // Card distances are in tiles; these scales stay at 1 so 1 tile = tileSize px.
  rangeScale: 1,
  speedScale: 1,

  // Projectiles / detect (tiles → px)
  projectileSpeed: 14 * TILE_SIZE, // 14 tiles/s
  unitRadiusDefault: 0.55 * TILE_SIZE,
  unitDetectRange: 2 * TILE_SIZE,
  hybridMeleeExit: 1.5 * TILE_SIZE,
  damageFloatRise: 1 * TILE_SIZE,

  aiInterval: [3, 6],
  step: 1 / 60,
  goalHitDelta: 1,
  deckSize: 8,
  deployPuffDuration: 0.3,
  matchDuration: 180,
  lastMinuteSeconds: 60,
  overtimeRegenInterval: 1.4,
  goalShakeAmount: 7,
  goalShakeDecay: 18,
  goalFlashDuration: 0.22,
  shootRecoilDuration: 0.09,
  hitFlashDuration: 4 / 60,
  deathDuration: 0.2,
  damageFloatDuration: 0.7,
  highLineDuration: 0.55,
  princessTowerDamage: 85,
  princessTowerCooldown: 1.25,
  kingTowerDamage: 105,
  kingTowerCooldown: 1.4,
};
