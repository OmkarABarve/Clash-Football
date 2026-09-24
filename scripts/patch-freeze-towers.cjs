const fs = require("fs");

function read(p) {
  const b = fs.readFileSync(p);
  return b[1] === 0
    ? b.toString("utf16le").replace(/^\uFEFF/, "")
    : b.toString("utf8");
}
function write(p, s) {
  fs.writeFileSync(p, s, "utf8");
}

// --- types ---
let types = read("src/config/types.ts");

if (!types.includes("FreezeAbility")) {
  types = types.replace(
    `export type Ability = ChargeAbility | AuraAbility;`,
    `export interface FreezeAbility {
  kind: "freeze";
  /** Stun duration in seconds applied on each hit. */
  duration: number;
}

export type Ability = ChargeAbility | AuraAbility | FreezeAbility;`,
  );
}

if (!types.includes("freezeT:")) {
  types = types.replace(
    `  /** Death anim countdown. > 0 keeps the unit alive for the shrink/ring. */
  deathT: number;
}`,
    `  /** Death anim countdown. > 0 keeps the unit alive for the shrink/ring. */
  deathT: number;
  /** Stun / freeze timer (seconds). > 0 = cannot move or attack. */
  freezeT: number;
}`,
  );
}

if (!types.includes("freezeDuration")) {
  types = types.replace(
    `  speed: number;
  empowered: boolean;
}`,
    `  speed: number;
  empowered: boolean;
  /** Optional stun applied on hit (Iniesta). */
  freezeDuration: number;
}`,
  );
}

write("src/config/types.ts", types);
console.log("types patched");

// --- units: Iniesta freeze ---
let units = read("src/config/units.ts");
if (!units.includes('kind: "freeze"')) {
  units = units.replace(
    `  iniesta: {
    id: "iniesta",
    name: "Iniesta",
    label: "I",
    cost: 5,
    hp: 600,
    speed: 2.3,
    range: 0,
    meleeRange: 1,
    damage: 120,
    attackCooldown: 2.0,
    attackMode: "melee",
    targetFilter: "unitThenGoal",
    radius: 0.55,
  },`,
    `  iniesta: {
    id: "iniesta",
    name: "Iniesta",
    label: "I",
    cost: 5,
    hp: 600,
    speed: 2.3,
    range: 0,
    meleeRange: 1,
    damage: 120,
    attackCooldown: 2.0,
    attackMode: "melee",
    targetFilter: "unitThenGoal",
    radius: 0.55,
    ability: {
      kind: "freeze",
      duration: 0.3,
    },
  },`,
  );
  write("src/config/units.ts", units);
  console.log("iniesta freeze ability added");
} else console.log("iniesta already has freeze");

// --- factory ---
let fac = read("src/entities/factory.ts");
if (!fac.includes("freezeT:")) {
  fac = fac.replace(
    `    deathT: 0,
  };
}`,
    `    deathT: 0,
    freezeT: 0,
  };
}`,
  );
}
if (!fac.includes("freezeDuration")) {
  // createProjectile opts + return
  if (fac.includes("empowered: boolean;")) {
    fac = fac.replace(
      `empowered: boolean;
  }`,
      `empowered: boolean;
    freezeDuration?: number;
  }`,
    );
  }
  fac = fac.replace(
    `    empowered: opts.empowered,
  };
}`,
    `    empowered: opts.empowered,
    freezeDuration: opts.freezeDuration ?? 0,
  };
}`,
  );
}
write("src/entities/factory.ts", fac);
console.log("factory patched");

// --- combat: attach freezeDuration ---
let combat = read("src/systems/combat.ts");
if (!combat.includes("freezeDuration")) {
  combat = combat.replace(
    `    unit.shootRecoil = state.config.shootRecoilDuration;

    state.projectiles.push(
      createProjectile(state, {
        side: unit.side,
        x: unit.x,
        y: unit.y,
        target: { ...unit.target },
        damage,
        goalHpDelta,
        empowered,
      }),
    );
    unit.cooldownLeft = def.attackCooldown;`,
    `    unit.shootRecoil = state.config.shootRecoilDuration;

    const freezeDuration =
      def.ability?.kind === "freeze" ? def.ability.duration : 0;

    state.projectiles.push(
      createProjectile(state, {
        side: unit.side,
        x: unit.x,
        y: unit.y,
        target: { ...unit.target },
        damage,
        goalHpDelta,
        empowered,
        freezeDuration,
      }),
    );
    unit.cooldownLeft = def.attackCooldown;`,
  );
  // Frozen units cannot attack
  combat = combat.replace(
    `    if (unit.hp <= 0 || unit.deathT > 0) continue;
    if (unit.spawnT > 0) continue;

    if (unit.cooldownLeft > 0) {
      unit.cooldownLeft = Math.max(0, unit.cooldownLeft - dt);
    }`,
    `    if (unit.hp <= 0 || unit.deathT > 0) continue;
    if (unit.spawnT > 0) continue;

    if (unit.freezeT > 0) {
      unit.freezeT = Math.max(0, unit.freezeT - dt);
      continue;
    }

    if (unit.cooldownLeft > 0) {
      unit.cooldownLeft = Math.max(0, unit.cooldownLeft - dt);
    }`,
  );
  write("src/systems/combat.ts", combat);
  console.log("combat patched");
}

// --- projectiles: tile radius + freeze on hit ---
let proj = read("src/systems/projectiles.ts");
proj = proj.replace(
  `      const radius = getUnitDef(victim.defId).radius;
      if (len <= radius || step >= len - radius) {
        applyUnitDamage(state, victim, shot.damage);
        continue;
      }`,
  `      const radius =
        getUnitDef(victim.defId).radius * state.config.tileSize;
      if (len <= radius || step >= len - radius) {
        applyUnitDamage(state, victim, shot.damage);
        if (shot.freezeDuration > 0 && victim.hp > 0) {
          victim.freezeT = Math.max(victim.freezeT, shot.freezeDuration);
        }
        continue;
      }`,
);
write("src/systems/projectiles.ts", proj);
console.log("projectiles patched");

// --- movement: freeze lock ---
let mov = read("src/systems/movement.ts");
if (!mov.includes("freezeT")) {
  mov = mov.replace(
    `    if (unit.shootRecoil > 0) {
      unit.shootRecoil = Math.max(0, unit.shootRecoil - dt);
    }

    // HighLine shove owns position this tick
    if (unitLockedBySpell(state, unit)) {`,
    `    if (unit.shootRecoil > 0) {
      unit.shootRecoil = Math.max(0, unit.shootRecoil - dt);
    }

    // Iniesta freeze / stun — cannot walk
    if (unit.freezeT > 0) {
      unit.freezeT = Math.max(0, unit.freezeT - dt);
      updateCharge(unit, dt, 0, false, state.config.tileSize);
      continue;
    }

    // HighLine shove owns position this tick
    if (unitLockedBySpell(state, unit)) {`,
  );
  write("src/systems/movement.ts", mov);
  console.log("movement patched");
}

// --- render: cyan tint while frozen ---
let render = read("src/ui/render.ts");
if (!render.includes("freezeT") && render.includes("hitFlash")) {
  // soft visual cue after color pick
  if (render.includes('const color = unit.side === "player"')) {
    render = render.replace(
      /const color = unit\.side === "player" \? "[^"]+" : "[^"]+";/,
      (m) =>
        m +
        `\n  const colorDrawn = unit.freezeT > 0 ? "#4dd0e1" : color;`,
    );
    // replace first fillStyle = color in drawUnit carefully — too risky
  }
  // Simpler: after drawing body, overlay freeze ring
  const marker = `  // HP bar (hidden while dying)`;
  if (render.includes(marker) && !render.includes("freeze ring")) {
    render = render.replace(
      marker,
      `  // Freeze ring
  if (unit.freezeT > 0) {
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(77, 208, 225, 0.9)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // HP bar (hidden while dying)`,
    );
    write("src/ui/render.ts", render);
    console.log("render freeze ring added");
  } else {
    console.log("render freeze visual skipped", render.includes(marker));
  }
}

console.log("DONE");
