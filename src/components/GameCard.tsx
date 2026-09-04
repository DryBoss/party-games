import type { GameInfo } from '../types/game';

interface GameCardProps {
  game: GameInfo;
  onSelect: () => void;
}

const accentBg: Record<GameInfo['accent'], string> = {
  coral: 'bg-coral',
  lime: 'bg-lime',
};

export default function GameCard({ game, onSelect }: GameCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="
        group relative flex flex-col gap-3 border-[3px] border-ink bg-paper p-5
        text-left shadow-[4px_4px_0_0_var(--color-ink)] transition-transform
        duration-150 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-ink)]
        focus-visible:-translate-y-0.5 focus-visible:shadow-[6px_6px_0_0_var(--color-ink)]
        focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coral
        active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-ink)]
      "
    >
      <span
        className={`h-2 w-10 ${accentBg[game.accent]} border-[1.5px] border-ink`}
      />
      <span className="font-display text-xl font-semibold leading-tight text-ink">
        {game.name}
      </span>
      <span className="text-sm leading-snug text-ink/70">{game.tagline}</span>
      <span className="mt-auto pt-2 text-xs font-medium text-ink/50">
        {game.minPlayers}–{game.maxPlayers} players
      </span>
    </button>
  );
}
