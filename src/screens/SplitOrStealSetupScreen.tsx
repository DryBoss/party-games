import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import BackButton from '../components/BackButton';
import type { Player } from '../types/player';

interface SplitOrStealSetupScreenProps {
  players: Player[];
  onBack: () => void;
  onStart: (rounds: number) => void;
}

export default function SplitOrStealSetupScreen({
  players,
  onBack,
  onStart,
}: SplitOrStealSetupScreenProps) {
  const [rounds, setRounds] = useState(1);
  const pairsPerRound = (players.length * (players.length - 1)) / 2;
  const totalMatches = pairsPerRound * rounds;
  const notEnoughPlayers = players.length < 2;

  return (
    <div className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 animate-enter">
      <div className="w-full max-w-md">
        <BackButton label="Back to games" onClick={onBack} />
        <p className="mt-6 font-display text-lg font-semibold text-coral">Split or Steal</p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-[1.05] text-ink">
          How many rounds?
        </h1>
        <p className="mt-4 text-lg text-ink/70">
          1 round means every player faces every other player once.
        </p>

        {notEnoughPlayers ? (
          <p className="mt-8 border-[3px] border-dashed border-ink/30 p-5 text-center text-sm text-ink/60">
            Split or Steal needs at least 2 players — add more from the game
            screen first.
          </p>
        ) : (
          <>
            <div className="mt-10 flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => setRounds((r) => Math.max(1, r - 1))}
                disabled={rounds <= 1}
                aria-label="Fewer rounds"
                className="inline-flex h-14 w-14 items-center justify-center border-[3px] border-ink bg-paper shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="h-5 w-5 text-ink" strokeWidth={2.5} />
              </button>
              <span className="font-display text-6xl font-bold text-ink">{rounds}</span>
              <button
                type="button"
                onClick={() => setRounds((r) => Math.min(20, r + 1))}
                disabled={rounds >= 20}
                aria-label="More rounds"
                className="inline-flex h-14 w-14 items-center justify-center border-[3px] border-ink bg-lime shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-5 w-5 text-ink" strokeWidth={2.5} />
              </button>
            </div>

            <p className="mt-6 text-center text-sm text-ink/60">
              {players.length} players · {totalMatches} match{totalMatches === 1 ? '' : 'es'} total
            </p>

            <button
              type="button"
              onClick={() => onStart(rounds)}
              className="mt-10 w-full border-[3px] border-ink bg-coral py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
            >
              Start game
            </button>
          </>
        )}
      </div>
    </div>
  );
}
