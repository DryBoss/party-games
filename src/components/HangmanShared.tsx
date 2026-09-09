import { useEffect, useRef, useState } from 'react';

const KEY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

export function HangmanWordDisplay({ word }: { word: (string | null)[] }) {
  return (
    <div className="flex flex-wrap items-end justify-center gap-1.5">
      {word.map((letter, index) => {
        if (letter === ' ') return <span key={index} className="w-3" aria-hidden="true" />;
        if (letter === '-') {
          return (
            <span key={index} className="pb-1 text-xl font-bold text-ink/40">
              -
            </span>
          );
        }
        return (
          <span
            key={index}
            className="flex h-9 w-7 items-end justify-center border-b-[3px] border-ink pb-0.5 font-display text-xl font-bold text-ink"
          >
            {letter ?? ''}
          </span>
        );
      })}
    </div>
  );
}

export function HangmanKeyboard({
  guessedLetters,
  word,
  onGuess,
  disabled = false,
  listenPhysicalKeyboard = false,
}: {
  guessedLetters: string[];
  word: (string | null)[];
  onGuess: (letter: string) => void;
  disabled?: boolean;
  listenPhysicalKeyboard?: boolean;
}) {
  const onGuessRef = useRef(onGuess);
  onGuessRef.current = onGuess;

  useEffect(() => {
    if (!listenPhysicalKeyboard) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (disabled) return;
      const letter = e.key.toUpperCase();
      if (/^[A-Z]$/.test(letter)) onGuessRef.current(letter);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [listenPhysicalKeyboard, disabled]);

  return (
    <div className="flex flex-col gap-1.5">
      {KEY_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1.5">
          {row.map((key) => {
            const guessed = guessedLetters.includes(key);
            const correct = guessed && word.includes(key);
            return (
              <button
                type="button"
                key={key}
                disabled={guessed || disabled}
                onClick={() => onGuess(key)}
                className={`
                  flex h-9 w-7 items-center justify-center border-[2px] border-ink text-sm font-semibold
                  sm:h-10 sm:w-8
                  ${guessed ? (correct ? 'bg-lime text-ink animate-pop' : 'bg-ink/10 text-ink/30 animate-pop') : 'bg-paper text-ink hover:-translate-y-0.5'}
                  disabled:cursor-not-allowed transition-all
                `}
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Purely presentational — reads the shared turnDeadline. In multiplayer a
 * host-side watchdog is what actually fires the timeout action; only local
 * (single-device) mode passes onTimeUp, since there's no separate host
 * process to do it there. */
export function HangmanTimer({
  turnDeadline,
  onTimeUp,
}: {
  turnDeadline: number | null;
  onTimeUp?: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(
    turnDeadline ? Math.max(0, Math.round((turnDeadline - Date.now()) / 1000)) : null,
  );
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    if (!turnDeadline) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      const secs = Math.max(0, Math.round((turnDeadline - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0 && !firedRef.current) {
        firedRef.current = true;
        onTimeUp?.();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnDeadline]);

  const lowOnTime = remaining != null && remaining <= 5;

  return (
    <span
      className={`font-display text-lg font-bold ${lowOnTime ? 'text-coral animate-pulse-soft' : 'text-ink'}`}
    >
      {remaining == null ? '∞' : `${remaining}s`}
    </span>
  );
}
