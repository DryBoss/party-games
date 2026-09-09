import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import BackButton from '../components/BackButton';
import { MIN_PLAYERS, suggestedWerewolfCount, maxWerewolfCount } from '../games/werewolf';
import type { WerewolfConfig } from '../games/werewolf';
import type { Player } from '../types/player';

interface WerewolfSetupScreenProps {
  players: Player[];
  onBack: () => void;
  onStart: (config: WerewolfConfig) => void;
}

export default function WerewolfSetupScreen({ players, onBack, onStart }: WerewolfSetupScreenProps) {
  const notEnough = players.length < MIN_PLAYERS;
  const [hasSeer, setHasSeer] = useState(true);
  const [hasDoctor, setHasDoctor] = useState(true);
  const [werewolfCount, setWerewolfCount] = useState(() => suggestedWerewolfCount(players.length));

  const maxWolves = Math.max(1, maxWerewolfCount(players.length, hasSeer, hasDoctor));
  const clampedCount = Math.min(werewolfCount, maxWolves);
  const villagerCount = players.length - clampedCount - (hasSeer ? 1 : 0) - (hasDoctor ? 1 : 0);

  const toggleSeer = () => {
    const next = !hasSeer;
    setHasSeer(next);
    setWerewolfCount((c) => Math.min(c, Math.max(1, maxWerewolfCount(players.length, next, hasDoctor))));
  };
  const toggleDoctor = () => {
    const next = !hasDoctor;
    setHasDoctor(next);
    setWerewolfCount((c) => Math.min(c, Math.max(1, maxWerewolfCount(players.length, hasSeer, next))));
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 animate-enter">
      <div className="w-full max-w-md">
        <BackButton label="Back to games" onClick={onBack} />
        <p className="mt-6 font-display text-lg font-semibold text-coral">Werewolf</p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-[1.05] text-ink">Game settings</h1>

        {notEnough ? (
          <p className="mt-8 border-[3px] border-dashed border-ink/30 p-5 text-center text-sm text-ink/60">
            Werewolf needs at least {MIN_PLAYERS} players — add more from the
            game screen first.
          </p>
        ) : (
          <>
            <div className="mt-8 flex flex-col gap-6">
              <div className="border-[3px] border-ink bg-paper p-4 shadow-[4px_4px_0_0_var(--color-ink)]">
                <p className="text-sm font-semibold text-ink">Werewolves</p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setWerewolfCount((c) => Math.max(1, c - 1))}
                    disabled={clampedCount <= 1}
                    aria-label="Fewer werewolves"
                    className="inline-flex h-9 w-9 items-center justify-center border-[2px] border-ink bg-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4 text-ink" strokeWidth={2.5} />
                  </button>
                  <span className="min-w-[3ch] text-center font-display text-lg font-bold text-ink">
                    {clampedCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWerewolfCount((c) => Math.min(maxWolves, c + 1))}
                    disabled={clampedCount >= maxWolves}
                    aria-label="More werewolves"
                    className="inline-flex h-9 w-9 items-center justify-center border-[2px] border-ink bg-coral shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4 text-ink" strokeWidth={2.5} />
                  </button>
                </div>
                <p className="mt-2 text-xs text-ink/60">
                  {villagerCount} villager{villagerCount === 1 ? '' : 's'}
                  {hasSeer ? ', 1 seer' : ''}
                  {hasDoctor ? ', 1 doctor' : ''}, {clampedCount} werewol
                  {clampedCount === 1 ? 'f' : 'ves'}.
                </p>
              </div>

              <div className="border-[3px] border-ink bg-paper p-4 shadow-[4px_4px_0_0_var(--color-ink)]">
                <p className="text-sm font-semibold text-ink">Special roles</p>
                <div className="mt-3 flex flex-col gap-3">
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink">
                      Seer — learns one player's true side each night
                    </span>
                    <input
                      type="checkbox"
                      checked={hasSeer}
                      onChange={toggleSeer}
                      className="h-5 w-5 shrink-0 accent-lime"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink">
                      Doctor — can save one player each night
                    </span>
                    <input
                      type="checkbox"
                      checked={hasDoctor}
                      onChange={toggleDoctor}
                      className="h-5 w-5 shrink-0 accent-lime"
                    />
                  </label>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onStart({ werewolfCount: clampedCount, hasSeer, hasDoctor })}
              className="mt-8 w-full border-[3px] border-ink bg-coral py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
            >
              Start game
            </button>
          </>
        )}
      </div>
    </div>
  );
}
