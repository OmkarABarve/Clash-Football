import type { DeckState } from "../config/types";

export function shuffleIds(ids: string[]): string[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

/** Clash-style circular cycle: hand of N, rest in queue, next slot shows queue[0]. */
export function buildDeck(unitIds: string[], handSize: number): DeckState {
  if (unitIds.length === 0) {
    return { hand: [], queue: [] };
  }
  const roster = [...unitIds];
  const size = Math.min(handSize, roster.length);
  return {
    hand: roster.slice(0, size),
    queue: roster.slice(size),
  };
}

/** Shuffle, cap at deckSize, then deal a Clash-style hand. */
export function buildShuffledDeck(
  unitIds: string[],
  handSize: number,
  deckSize: number,
): DeckState {
  const capped = shuffleIds(unitIds).slice(0, Math.min(deckSize, unitIds.length));
  return buildDeck(capped, handSize);
}

export function nextCardId(deck: DeckState): string | null {
  return deck.queue[0] ?? null;
}

/** Play a hand card: remove from hand, push to back of queue, draw into empty slot. */
export function playCard(deck: DeckState, defId: string): boolean {
  const index = deck.hand.indexOf(defId);
  if (index < 0) return false;

  deck.hand.splice(index, 1);
  deck.queue.push(defId);

  const drawn = deck.queue.shift();
  if (drawn !== undefined) {
    deck.hand.splice(index, 0, drawn);
  }
  return true;
}

export function isInHand(deck: DeckState, defId: string): boolean {
  return deck.hand.includes(defId);
}
