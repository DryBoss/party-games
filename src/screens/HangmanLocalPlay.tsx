import { useState } from 'react';
import { ArrowRight, Star, Users } from 'lucide-react';
import BackButton from '../components/BackButton';
import { HangmanWordDisplay, HangmanKeyboard, HangmanTimer } from '../components/HangmanShared';
import {
  initState,
  reduce,
  maskForBroadcast,
  toEngineSettings,
  validateWord,
} from '../games/hangman';
import type { HangmanAction, HangmanFullSettings } from '../games/hangman';
import type { Player } from '../types/player';

interface HangmanLocalPlayProps {
  players: Player[];
  settings: HangmanFullSettings;
  onExit: () => void;
}

export default function HangmanLocalPlay({ players, settings, onExit }: HangmanLocalPlayProps) {
  const playerCount = players.length;
  const [state, setState] = useState(() => initState(playerCount, toEngineSettings(settings)));
  const [showStandings, setShowStandings] = useState(false);
  const nameOf = (i: number) => players[i]?.name ?? '???';

  const dispatch = (action: HangmanAction) => {
    const result = reduce(state, action, { seatIndex: 0, playerCount, bypassAuth: true });
    if (!result.error) setState(result.state);
  };

  const handleRestart = () => setState(initState(playerCount, toEngineSettings(settings)));

  const masked = maskForBroadcast(state);
  const leaderboard = () =>
    players
      .map((p, i) => ({ name: p.name, points: state.score[i] }))
      .sort((a, b) => b.points - a.points);

  const StandingsButton = () => (
    <button
      type="button"
      onClick={() => setShowStandings(true)}
      className="inline-flex items-center gap-1.5 border-[2px] border-ink bg-paper px-3 py-1.5 text-xs font-medium text-ink shadow-[2px_2px_0_0_var(--color-ink)]"
    >
      <Star className="h-3.5 w-3.5" /> Standings
    </button>
  );

  const StandingsDialog = () =>
    showStandings ? (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 p-6" onClick={() => setShowStandings(false)}>
        <div
          className="w-full max-w-xs border-[3px] border-ink bg-paper p-5 shadow-[6px_6px_0_0_var(--color-ink)]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-display text-lg font-bold text-ink">Standings</p>
          <ul className="mt-3 flex flex-col gap-2">
            {leaderboard().map((p, i) => (
              <li key={p.name} className="flex items-center justify-between text-sm">
                <span className="text-ink">#{i + 1} {p.name}</span>
                <span className="font-bold text-ink">{p.points} pts</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setShowStandings(false)}
            className="mt-4 w-full border-[2px] border-ink bg-lime py-2 text-sm font-semibold text-ink"
          >
            Close
          </button>
        </div>
      </div>
    ) : null;

  // --- finished ---
  if (state.phase === 'finished') {
    return (
      <div className="flex min-h-screen flex-col items-center bg-cream px-6 py-16">
        <div className="w-full max-w-md text-center">
          <BackButton label="Back to games" onClick={onExit} />
          <Star className="mx-auto mt-8 h-10 w-10 text-coral" fill="currentColor" />
          <h1 className="mt-4 font-display text-3xl font-bold text-ink">
            {nameOf(state.winnerIndex ?? 0)} wins!
          </h1>
          <ul className="mt-6 flex flex-col gap-2">
            {leaderboard().map((p, i) => (
              <li
                key={p.name}
                className="flex items-center justify-between border-[2px] border-ink bg-paper px-4 py-2"
              >
                <span className="text-ink">#{i + 1} {p.name}</span>
                <span className="font-display font-bold text-ink">{p.points} pts</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleRestart}
            className="mt-8 w-full border-[3px] border-ink bg-lime py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={onExit}
            className="mt-3 w-full border-[3px] border-ink bg-paper py-3 font-medium text-ink shadow-[4px_4px_0_0_var(--color-ink)]"
          >
            Back to games
          </button>
        </div>
      </div>
    );
  }

  // --- select ---
  if (state.phase === 'select') {
    return (
      <WordSelectScreen
        selectorName={nameOf(state.selectorIndex)}
        minLength={settings.minWordLength}
        maxLength={settings.maxWordLength}
        onSubmit={(word) => dispatch({ type: 'SELECT_WORD', word })}
        standings={<StandingsButton />}
        dialog={<StandingsDialog />}
      />
    );
  }

  // --- pass (turn handoff) ---
  if (state.phase === 'pass') {
    const isFirstGuesser = state.guessedLetters.length === 0;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16">
        <div className="w-full max-w-md text-center">
          <ArrowRight className="mx-auto h-8 w-8 text-coral" />
          <p className="mt-4 text-sm font-medium text-ink/60">Up next</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink">{nameOf(state.guesserIndex)}</h1>
          <p className="mt-3 text-ink/70">
            {isFirstGuesser ? "You'll be the first to guess this word." : 'Your turn to guess a letter.'}
          </p>
          <button
            type="button"
            onClick={() => dispatch({ type: 'READY_TO_GUESS' })}
            className="mt-8 w-full border-[3px] border-ink bg-lime py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
          >
            I'm ready
          </button>
        </div>
      </div>
    );
  }

  // --- guess ---
  if (state.phase === 'guess') {
    return (
      <div className="flex min-h-screen flex-col items-center bg-cream px-6 py-10">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between">
            <StandingsButton />
            <HangmanTimer turnDeadline={state.turnDeadline} onTimeUp={() => dispatch({ type: 'TIME_UP' })} />
          </div>
          <h1 className="mt-6 text-center font-display text-2xl font-bold text-ink">
            {nameOf(state.guesserIndex)}'s turn
          </h1>
          <div className="mt-6">
            <HangmanWordDisplay word={masked.word ?? []} />
          </div>
          <p className="mt-4 text-center text-xs text-ink/50">
            Each correct letter is <strong>+1</strong>, plus <strong>+2</strong> for finishing —
            nothing lost for a wrong guess, but running out the clock costs <strong>−1</strong>.
          </p>
          <div className="mt-6">
            <HangmanKeyboard
              guessedLetters={state.guessedLetters}
              word={masked.word ?? []}
              onGuess={(letter) => dispatch({ type: 'GUESS_LETTER', letter })}
              listenPhysicalKeyboard
            />
          </div>
        </div>
        <StandingsDialog />
      </div>
    );
  }

  // --- judge ---
  if (state.phase === 'judge') {
    const preview = players
      .map((p, i) => ({ name: p.name, delta: state.roundDelta[i] }))
      .filter((e) => e.delta !== 0)
      .sort((a, b) => b.delta - a.delta);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16">
        <div className="w-full max-w-md text-center">
          <p className="font-display text-lg font-semibold text-coral">Was this a fair word?</p>
          <p className="mt-2 font-display text-3xl font-bold tracking-wide text-ink">
            {state.word?.join('')}
          </p>
          <p className="mt-3 text-sm text-ink/70">
            Check it's spelled correctly and it's a real, appropriate word. If
            rejected, nobody scores this round.
          </p>
          {preview.length > 0 && (
            <ul className="mt-6 flex flex-col gap-1.5">
              {preview.map((e) => (
                <li key={e.name} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{e.name}</span>
                  <span className={e.delta > 0 ? 'font-bold text-ink' : 'font-bold text-coral'}>
                    {e.delta > 0 ? '+' : ''}
                    {e.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-8 grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => dispatch({ type: 'JUDGE_DECIDE', approve: true })}
              className="border-[3px] border-ink bg-lime py-3 font-display font-semibold text-ink shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'JUDGE_DECIDE', approve: false })}
              className="border-[3px] border-ink bg-coral py-3 font-display font-semibold text-ink shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- roundSummary ---
  const breakdown = players
    .map((p, i) => ({ name: p.name, delta: state.roundDelta[i] }))
    .filter((e) => e.delta !== 0)
    .sort((a, b) => b.delta - a.delta);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16">
      <div className="w-full max-w-md text-center">
        {state.roundVoided ? (
          <p className="font-display text-2xl font-bold text-coral">Word rejected</p>
        ) : (
          <p className="flex items-center justify-center gap-2 font-display text-2xl font-bold text-ink">
            <Star className="h-6 w-6 text-coral" fill="currentColor" /> Solved!
          </p>
        )}
        <p className="mt-2 font-display text-3xl font-bold tracking-wide text-ink">
          {state.word?.join('')}
        </p>
        {state.roundVoided && <p className="mt-2 text-sm text-ink/60">No points were awarded this round.</p>}
        {!state.roundVoided && breakdown.length > 0 && (
          <ul className="mt-6 flex flex-col gap-1.5">
            {breakdown.map((e) => (
              <li key={e.name} className="flex items-center justify-between text-sm">
                <span className="text-ink">{e.name}</span>
                <span className="font-bold text-ink">
                  {e.delta > 0 ? '+' : ''}
                  {e.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-ink/60">
          <Users className="h-4 w-4" /> Standings
        </p>
        <ul className="mt-2 flex flex-col gap-2">
          {leaderboard().map((p, i) => (
            <li key={p.name} className="flex items-center justify-between border-[2px] border-ink bg-paper px-3 py-2 text-sm">
              <span className="text-ink">#{i + 1} {p.name}</span>
              <span className="font-bold text-ink">{p.points} pts</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => dispatch({ type: 'NEXT_ROUND' })}
          className="mt-8 w-full border-[3px] border-ink bg-lime py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function WordSelectScreen({
  selectorName,
  minLength,
  maxLength,
  onSubmit,
  standings,
  dialog,
}: {
  selectorName: string;
  minLength: number;
  maxLength: number;
  onSubmit: (word: string) => void;
  standings: React.ReactNode;
  dialog: React.ReactNode;
}) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const error = validateWord(value, minLength, maxLength);
  const canSubmit = value.length > 0 && !error;
  const lengthHint = minLength === maxLength ? `exactly ${minLength}` : `${minLength}–${maxLength}`;

  const submit = () => {
    if (!canSubmit) {
      setTouched(true);
      return;
    }
    onSubmit(value);
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-cream px-6 py-16">
      <div className="w-full max-w-md">
        <div className="flex justify-end">{standings}</div>
        <div className="mt-6 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">{selectorName}, enter a secret word</h1>
          <p className="mt-3 text-sm text-ink/70">
            {lengthHint} letters. Spaces or hyphens allowed in the middle (e.g. "well-known"). Make
            sure no one else can see your screen!
          </p>
          <input
            type="text"
            autoFocus
            value={value}
            maxLength={maxLength * 2}
            placeholder="secret word or phrase"
            className="mt-6 w-full border-[3px] border-ink bg-paper px-4 py-3 text-center text-lg text-ink placeholder:text-ink/30 shadow-[4px_4px_0_0_var(--color-ink)] focus:outline-none"
            onChange={(e) => {
              setValue(e.target.value.replace(/[^a-zA-Z -]/g, ''));
              setTouched(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <div className="mt-2 h-5 text-sm text-coral">{touched && error ? error : '\u00A0'}</div>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="mt-4 w-full border-[3px] border-ink bg-coral py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Lock it in
          </button>
        </div>
      </div>
      {dialog}
    </div>
  );
}
