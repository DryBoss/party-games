import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import BackButton from '../components/BackButton';
import {
  DEFAULT_SETTINGS,
  MIN_TURN_DURATION,
  MAX_TURN_DURATION,
  MIN_POINTS_TO_WIN,
  MAX_POINTS_TO_WIN,
  POINTS_STEP,
  MIN_ROUNDS,
  MAX_ROUNDS,
  WORD_LENGTH_FLOOR,
  WORD_LENGTH_CEILING,
} from '../games/hangman';
import type { HangmanFullSettings } from '../games/hangman';
import type { Player } from '../types/player';

interface HangmanSetupScreenProps {
  players: Player[];
  onBack: () => void;
  onStart: (settings: HangmanFullSettings) => void;
}

function Stepper({
  label,
  value,
  display,
  onDecrease,
  onIncrease,
  disabledDecrease,
  disabledIncrease,
}: {
  label: string;
  value: number;
  display?: string;
  onDecrease: () => void;
  onIncrease: () => void;
  disabledDecrease?: boolean;
  disabledIncrease?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onDecrease}
        disabled={disabledDecrease}
        aria-label={`Decrease ${label}`}
        className="inline-flex h-9 w-9 items-center justify-center border-[2px] border-ink bg-paper shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="h-4 w-4 text-ink" strokeWidth={2.5} />
      </button>
      <span className="min-w-[3ch] text-center font-display text-lg font-bold text-ink">
        {display ?? value}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        disabled={disabledIncrease}
        aria-label={`Increase ${label}`}
        className="inline-flex h-9 w-9 items-center justify-center border-[2px] border-ink bg-lime shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4 text-ink" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default function HangmanSetupScreen({ players, onBack, onStart }: HangmanSetupScreenProps) {
  const [settings, setSettings] = useState<HangmanFullSettings>(DEFAULT_SETTINGS);
  const notEnoughPlayers = players.length < 2;
  const patch = (fields: Partial<HangmanFullSettings>) => setSettings((s) => ({ ...s, ...fields }));

  const clampTurn = (v: number) => Math.min(MAX_TURN_DURATION, Math.max(MIN_TURN_DURATION, v));
  const clampPoints = (v: number) => Math.min(MAX_POINTS_TO_WIN, Math.max(MIN_POINTS_TO_WIN, v));
  const clampRounds = (v: number) => Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, v));
  const setMinWord = (delta: number) => {
    const next = Math.min(WORD_LENGTH_CEILING, Math.max(WORD_LENGTH_FLOOR, settings.minWordLength + delta));
    patch({ minWordLength: next, maxWordLength: Math.max(next, settings.maxWordLength) });
  };
  const setMaxWord = (delta: number) => {
    const next = Math.min(WORD_LENGTH_CEILING, Math.max(WORD_LENGTH_FLOOR, settings.maxWordLength + delta));
    patch({ maxWordLength: next, minWordLength: Math.min(next, settings.minWordLength) });
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 animate-enter">
      <div className="w-full max-w-md">
        <BackButton label="Back to games" onClick={onBack} />
        <p className="mt-6 font-display text-lg font-semibold text-coral">Hangman Friends</p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-[1.05] text-ink">Game settings</h1>

        {notEnoughPlayers ? (
          <p className="mt-8 border-[3px] border-dashed border-ink/30 p-5 text-center text-sm text-ink/60">
            Hangman Friends needs at least 2 players — add more from the game
            screen first.
          </p>
        ) : (
          <>
            <div className="mt-8 flex flex-col gap-6">
              <div className="border-[3px] border-ink bg-paper p-4 shadow-[4px_4px_0_0_var(--color-ink)]">
                <p className="text-sm font-semibold text-ink">Turn duration</p>
                <div className="mt-3 flex items-center justify-between">
                  {settings.noTimeLimit ? (
                    <span className="font-display text-lg font-bold text-ink">No limit</span>
                  ) : (
                    <Stepper
                      label="turn duration"
                      value={settings.turnDuration ?? MIN_TURN_DURATION}
                      display={`${settings.turnDuration ?? MIN_TURN_DURATION}s`}
                      onDecrease={() => patch({ turnDuration: clampTurn((settings.turnDuration ?? MIN_TURN_DURATION) - 5) })}
                      onIncrease={() => patch({ turnDuration: clampTurn((settings.turnDuration ?? MIN_TURN_DURATION) + 5) })}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => patch({ noTimeLimit: !settings.noTimeLimit })}
                    className="border-[2px] border-ink bg-paper px-3 py-1.5 text-xs font-medium text-ink shadow-[2px_2px_0_0_var(--color-ink)]"
                  >
                    {settings.noTimeLimit ? '✓ No time limit' : 'No time limit'}
                  </button>
                </div>
              </div>

              <div className="border-[3px] border-ink bg-paper p-4 shadow-[4px_4px_0_0_var(--color-ink)]">
                <p className="text-sm font-semibold text-ink">Game length</p>
                <div className="mt-3 flex border-[2px] border-ink">
                  <button
                    type="button"
                    onClick={() => patch({ gameMode: 'points' })}
                    className={`flex-1 py-2 text-sm font-medium ${settings.gameMode === 'points' ? 'bg-lime text-ink' : 'bg-paper text-ink/60'}`}
                  >
                    Points
                  </button>
                  <button
                    type="button"
                    onClick={() => patch({ gameMode: 'rounds' })}
                    className={`flex-1 border-l-[2px] border-ink py-2 text-sm font-medium ${settings.gameMode === 'rounds' ? 'bg-lime text-ink' : 'bg-paper text-ink/60'}`}
                  >
                    Rounds
                  </button>
                </div>
                <div className="mt-3">
                  {settings.gameMode === 'points' ? (
                    <>
                      <Stepper
                        label="points to win"
                        value={settings.pointsToWin}
                        onDecrease={() => patch({ pointsToWin: clampPoints(settings.pointsToWin - POINTS_STEP) })}
                        onIncrease={() => patch({ pointsToWin: clampPoints(settings.pointsToWin + POINTS_STEP) })}
                      />
                      <p className="mt-2 text-xs text-ink/60">First to reach this score wins.</p>
                    </>
                  ) : (
                    <>
                      <Stepper
                        label="rounds"
                        value={settings.roundsToPlay}
                        onDecrease={() => patch({ roundsToPlay: clampRounds(settings.roundsToPlay - 1) })}
                        onIncrease={() => patch({ roundsToPlay: clampRounds(settings.roundsToPlay + 1) })}
                      />
                      <p className="mt-2 text-xs text-ink/60">
                        Game ends after {settings.roundsToPlay} word{settings.roundsToPlay === 1 ? '' : 's'} —
                        highest score wins.
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="border-[3px] border-ink bg-paper p-4 shadow-[4px_4px_0_0_var(--color-ink)]">
                <p className="text-sm font-semibold text-ink">Word length</p>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <div>
                    <span className="mb-1 block text-xs text-ink/50">Min</span>
                    <Stepper
                      label="minimum word length"
                      value={settings.minWordLength}
                      onDecrease={() => setMinWord(-1)}
                      onIncrease={() => setMinWord(1)}
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-xs text-ink/50">Max</span>
                    <Stepper
                      label="maximum word length"
                      value={settings.maxWordLength}
                      onDecrease={() => setMaxWord(-1)}
                      onIncrease={() => setMaxWord(1)}
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-ink/60">
                  Secret words must be {settings.minWordLength}
                  {settings.maxWordLength > settings.minWordLength ? `–${settings.maxWordLength}` : ''} letters.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onStart(settings)}
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
