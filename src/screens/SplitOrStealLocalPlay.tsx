import { useState } from 'react';
import { HandCoins, Skull } from 'lucide-react';
import BackButton from '../components/BackButton';
import { generateSchedule, resolveChoices } from '../games/splitOrSteal';
import type { Choice, ScheduledMatch } from '../games/splitOrSteal';
import type { Player } from '../types/player';

interface SplitOrStealLocalPlayProps {
  players: Player[];
  rounds: number;
  onExit: () => void;
}

type Phase = 'pass' | 'choose' | 'result' | 'finished';

export default function SplitOrStealLocalPlay({
  players,
  rounds,
  onExit,
}: SplitOrStealLocalPlayProps) {
  const [schedule, setSchedule] = useState(() => generateSchedule(players, rounds));
  const [index, setIndex] = useState(0);
  const [turn, setTurn] = useState<'a' | 'b'>('a');
  const [phase, setPhase] = useState<Phase>(schedule.length > 0 ? 'pass' : 'finished');
  const [choices, setChoices] = useState<{ a?: Choice; b?: Choice }>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [lastResult, setLastResult] = useState<{
    match: ScheduledMatch;
    aChoice: Choice;
    bChoice: Choice;
    aPoints: number;
    bPoints: number;
  } | null>(null);

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? '???';
  const match = schedule[index];

  const handleReady = () => setPhase('choose');

  const handleChoose = (choice: Choice) => {
    const next = { ...choices, [turn]: choice };
    setChoices(next);

    if (turn === 'a') {
      setTurn('b');
      setPhase('pass');
      return;
    }

    // Both chosen — resolve.
    const aChoice = next.a as Choice;
    const bChoice = choice;
    const { aPoints, bPoints } = resolveChoices(aChoice, bChoice);
    setScores((prev) => ({
      ...prev,
      [match.playerAId]: (prev[match.playerAId] ?? 0) + aPoints,
      [match.playerBId]: (prev[match.playerBId] ?? 0) + bPoints,
    }));
    setLastResult({ match, aChoice, bChoice, aPoints, bPoints });
    setPhase('result');
  };

  const handleNext = () => {
    const nextIndex = index + 1;
    setChoices({});
    setLastResult(null);
    setTurn('a');
    if (nextIndex >= schedule.length) {
      setPhase('finished');
    } else {
      setIndex(nextIndex);
      setPhase('pass');
    }
  };

  const handlePlayAgain = () => {
    setSchedule(generateSchedule(players, rounds));
    setIndex(0);
    setTurn('a');
    setChoices({});
    setScores({});
    setLastResult(null);
    setPhase('pass');
  };

  if (phase === 'finished') {
    const ranked = [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
    return (
      <div className="flex min-h-screen flex-col items-center bg-cream px-6 py-16">
        <div className="w-full max-w-md">
          <BackButton label="Back to games" onClick={onExit} />
          <p className="mt-6 font-display text-lg font-semibold text-coral">Split or Steal</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-ink">Final results</h1>
          <ol className="mt-8 flex flex-col gap-3">
            {ranked.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center justify-between border-[3px] border-ink bg-paper px-4 py-3 shadow-[4px_4px_0_0_var(--color-ink)]"
              >
                <span className="font-medium text-ink">
                  {i + 1}. {p.name}
                </span>
                <span className="font-display font-bold text-ink">{scores[p.id] ?? 0}</span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={handlePlayAgain}
            className="mt-10 w-full border-[3px] border-ink bg-lime py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={onExit}
            className="mt-3 w-full border-[3px] border-ink bg-paper py-3 font-medium text-ink shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
          >
            Back to games
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'result' && lastResult) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16">
        <div className="w-full max-w-md text-center">
          <p className="font-display text-lg font-semibold text-coral">Result</p>
          <div className="mt-6 flex items-center justify-center gap-6">
            <ResultCard
              name={nameOf(lastResult.match.playerAId)}
              choice={lastResult.aChoice}
              points={lastResult.aPoints}
            />
            <span className="font-display text-2xl text-ink/40">vs</span>
            <ResultCard
              name={nameOf(lastResult.match.playerBId)}
              choice={lastResult.bChoice}
              points={lastResult.bPoints}
            />
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="mt-10 w-full border-[3px] border-ink bg-lime py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
          >
            {index + 1 >= schedule.length ? 'See final results' : 'Next match'}
          </button>
        </div>
      </div>
    );
  }

  const chooserName = nameOf(turn === 'a' ? match.playerAId : match.playerBId);

  if (phase === 'choose') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16">
        <div className="w-full max-w-md text-center">
          <p className="font-display text-lg font-semibold text-coral">{chooserName}'s turn</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink">Split or Steal?</h1>
          <div className="mt-10 grid grid-cols-2 gap-5">
            <button
              type="button"
              onClick={() => handleChoose('split')}
              className="flex flex-col items-center gap-3 border-[3px] border-ink bg-lime p-6 shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)] active:translate-y-0"
            >
              <HandCoins className="h-8 w-8 text-ink" strokeWidth={2} />
              <span className="font-display text-xl font-semibold text-ink">Split</span>
            </button>
            <button
              type="button"
              onClick={() => handleChoose('steal')}
              className="flex flex-col items-center gap-3 border-[3px] border-ink bg-coral p-6 shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)] active:translate-y-0"
            >
              <Skull className="h-8 w-8 text-ink" strokeWidth={2} />
              <span className="font-display text-xl font-semibold text-ink">Steal</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // phase === 'pass'
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-medium text-ink/50">
          Match {index + 1} of {schedule.length}
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-ink">
          Pass the device to
          <br />
          {chooserName}
        </h1>
        <p className="mt-3 text-ink/70">
          {turn === 'a'
            ? `Playing against ${nameOf(match.playerBId)}`
            : `Playing against ${nameOf(match.playerAId)}`}
        </p>
        <button
          type="button"
          onClick={handleReady}
          className="mt-10 w-full border-[3px] border-ink bg-lime py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
        >
          I've got it
        </button>
      </div>
    </div>
  );
}

function ResultCard({
  name,
  choice,
  points,
}: {
  name: string;
  choice: Choice;
  points: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2 border-[3px] border-ink bg-paper px-5 py-4 shadow-[4px_4px_0_0_var(--color-ink)]">
      {choice === 'split' ? (
        <HandCoins className="h-6 w-6 text-ink" strokeWidth={2} />
      ) : (
        <Skull className="h-6 w-6 text-ink" strokeWidth={2} />
      )}
      <span className="font-medium text-ink">{name}</span>
      <span className="text-xs uppercase tracking-wide text-ink/50">{choice}</span>
      <span className="font-display text-lg font-bold text-ink">+{points}</span>
    </div>
  );
}
