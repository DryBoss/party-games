import type { Player } from '../types/player';

export type Choice = 'split' | 'steal';

export interface ScheduledMatch {
  index: number;
  round: number;
  playerAId: string;
  playerBId: string;
}

/**
 * "1 round" means every player faces every other player exactly once — so a
 * round is just every unique pair, and N rounds repeats that pairing N times.
 * Matches are presented one at a time (not simultaneously), so there's no
 * need for classic non-overlapping round-robin scheduling — just enumerate
 * pairs, in a fresh shuffled order each round for variety.
 */
export function generateSchedule(players: Player[], rounds: number): ScheduledMatch[] {
  const matches: ScheduledMatch[] = [];
  let index = 0;
  for (let r = 1; r <= rounds; r++) {
    const pairs: [Player, Player][] = [];
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        pairs.push([players[i], players[j]]);
      }
    }
    shuffle(pairs);
    for (const [a, b] of pairs) {
      matches.push({ index: index++, round: r, playerAId: a.id, playerBId: b.id });
    }
  }
  return matches;
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function resolveChoices(
  aChoice: Choice,
  bChoice: Choice,
): { aPoints: number; bPoints: number } {
  if (aChoice === 'split' && bChoice === 'split') return { aPoints: 3, bPoints: 3 };
  if (aChoice === 'steal' && bChoice === 'steal') return { aPoints: 1, bPoints: 1 };
  if (aChoice === 'steal' && bChoice === 'split') return { aPoints: 5, bPoints: 0 };
  return { aPoints: 0, bPoints: 5 }; // a split, b steal
}

export interface SplitOrStealState {
  schedule: ScheduledMatch[];
  currentIndex: number;
  scores: Record<string, number>;
  lastReveal?: { index: number; aChoice: Choice; bChoice: Choice };
  finished: boolean;
}

export type SplitOrStealEvent =
  | { type: 'game-start'; schedule: ScheduledMatch[] }
  | { type: 'match-advance'; index: number }
  | { type: 'reveal'; index: number; aChoice: Choice; bChoice: Choice; scores: Record<string, number> }
  | { type: 'game-end'; scores: Record<string, number> };

/** Every client (host and guests alike) reaches the same state by replaying
 * the same events — hosts apply them locally right before broadcasting,
 * guests apply them as they arrive. Nobody computes scores independently. */
export function applyGameEvent(
  state: SplitOrStealState | null,
  event: SplitOrStealEvent,
): SplitOrStealState | null {
  switch (event.type) {
    case 'game-start':
      return { schedule: event.schedule, currentIndex: 0, scores: {}, finished: false };
    case 'match-advance':
      if (!state) return state;
      return { ...state, currentIndex: event.index, lastReveal: undefined };
    case 'reveal':
      if (!state) return state;
      return {
        ...state,
        scores: event.scores,
        lastReveal: { index: event.index, aChoice: event.aChoice, bChoice: event.bChoice },
      };
    case 'game-end':
      if (!state) return state;
      return { ...state, scores: event.scores, finished: true };
  }
}
