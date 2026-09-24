import type { SpellDef } from "./types";
import { UNIT_DEFS, enabledUnitIds, getUnitDef } from "./units";

export const SPELL_DEFS: Record<string, SpellDef> = {
  highline: {
    id: "highline",
    name: "HighLine",
    label: "HL",
    cost: 6,
    kind: "spell",
    spell: "highline",
    pushTiles: 5,
  },
};

export type CardDef = import("./types").UnitDef | SpellDef;

export function getSpellDef(id: string): SpellDef {
  const def = SPELL_DEFS[id];
  if (!def) throw new Error(`Unknown spell def: ${id}`);
  return def;
}

export function getCardDef(id: string): CardDef {
  if (SPELL_DEFS[id]) return SPELL_DEFS[id]!;
  return getUnitDef(id);
}

export function isSpellDef(def: CardDef): def is SpellDef {
  return (def as SpellDef).kind === "spell";
}

export function isSpellId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(SPELL_DEFS, id);
}

/** Units + spells that can appear in a deck. */
export function enabledCardIds(): string[] {
  const spells = Object.keys(SPELL_DEFS).filter(
    (id) => SPELL_DEFS[id]!.enabled !== false,
  );
  return [...enabledUnitIds(), ...spells];
}

export { UNIT_DEFS, enabledUnitIds, getUnitDef };
