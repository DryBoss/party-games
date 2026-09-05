import type { GameInfo } from '../types/game';

/**
 * Every game in this list works in single_device, hotspot, and online rooms —
 * the network layer is abstracted away from the games themselves, so nothing
 * here needs to know which mode it's running in.
 */
export const GAMES: GameInfo[] = [
  {
    id: 'split-or-steal',
    name: 'Split or Steal',
    tagline: 'Every pairing, one secret choice — split the pot, or take it all.',
    minPlayers: 2,
    maxPlayers: 12,
    accent: 'coral',
  },
  {
    id: 'quick-trivia',
    name: 'Quick Trivia',
    tagline: 'Race the clock to answer before anyone else.',
    minPlayers: 2,
    maxPlayers: 12,
    accent: 'coral',
  },
  {
    id: 'hangman-friends',
    name: 'Hangman Friends',
    tagline: 'Pick a secret word, guess it letter by letter, judge if it counts.',
    minPlayers: 2,
    maxPlayers: 12,
    accent: 'lime',
  },
  {
    id: 'would-you-rather',
    name: 'Would You Rather',
    tagline: 'Pick a side, then see how the room voted.',
    minPlayers: 2,
    maxPlayers: 16,
    accent: 'lime',
  },
  {
    id: 'drawing-duel',
    name: 'Drawing Duel',
    tagline: 'Sketch the prompt, let everyone else guess it.',
    minPlayers: 3,
    maxPlayers: 8,
    accent: 'coral',
  },
];
