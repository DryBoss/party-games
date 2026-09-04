export interface GameInfo {
  id: string;
  name: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  /** Tailwind color token used for the game's accent chip, e.g. "coral" or "lime". */
  accent: 'coral' | 'lime';
}
