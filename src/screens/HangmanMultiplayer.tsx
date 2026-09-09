import { useState } from 'react';
import { ArrowRight, Star, Users } from 'lucide-react';
import BackButton from '../components/BackButton';
import { HangmanWordDisplay, HangmanKeyboard, HangmanTimer } from '../components/HangmanShared';
import { validateWord } from '../games/hangman';
import type { HangmanAction, HangmanState } from '../games/hangman';
import type { Player } from '../types/player';

interface HangmanMultiplayerProps {
  state: HangmanState;
  seatIds: string[];
  myId: string | null;
  isHost: boolean;
  players: Player[];
  minWordLength: number;
  maxWordLength: number;
  dispatch: (action: HangmanAction) => void;
  onExit: () => void;
  onPlayAgain: () => void;
}

export default function HangmanMultiplayer({
  state,
  seatIds,
  myId,
  isHost,
  players,
  minWordLength,
  maxWordLength,
  dispatch,
  onExit,
  onPlayAgain,
}: HangmanMultiplayerProps) {
  const [showStandings, setShowStandings] = useState(false);
  const mySeat = myId ? seatIds.indexOf(myId) : -1;
  const nameOf = (seat: number) => players.find((p) => p.id === seatIds[seat])?.name ?? '???';

  const leaderboard = () =>
    seatIds
      .map((id, i) => ({ name: players.find((p) => p.id === id)?.name ?? '???', points: state.score[i] }))
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
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 p-6"
        onClick={() => setShowStandings(false)}
      >
        <div
          className="w-full max-w-xs border-[3px] border-ink bg-paper p-5 shadow-[6px_6px_0_0_var(--color-ink)] animate-pop"
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
      <div key="finished" className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md text-center">
          <BackButton label="Back to games" onClick={onExit} />
          <Star className="mx-auto mt-8 h-10 w-10 text-coral animate-pop" fill="currentColor" />
          <h1 className="mt-4 font-display text-3xl font-bold text-ink">
            {nameOf(state.winnerIndex ?? 0)} wins!
          </h1>
          <ul className="mt-6 flex flex-col gap-2">
            {leaderboard().map((p, i) => (
              <li
                key={p.name}
                className="flex items-center justify-between border-[2px] border-ink bg-paper px-4 py-2 animate-stagger"
                style={{ '--stagger-index': i } as React.CSSProperties}
              >
                <span className="text-ink">#{i + 1} {p.name}</span>
                <span className="font-display font-bold text-ink">{p.points} pts</span>
              </li>
            ))}
          </ul>
          {isHost ? (
            <>
              <button
                type="button"
                onClick={onPlayAgain}
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
            </>
          ) : (
            <p className="mt-8 text-sm text-ink/50">Waiting for the host to start a new game or head back…</p>
          )}
        </div>
      </div>
    );
  }

  // --- select ---
  if (state.phase === 'select') {
    const isMe = mySeat === state.selectorIndex;
    return (
      <div key="select" className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md">
          <div className="flex justify-end">
            <StandingsButton />
          </div>
          {isMe ? (
            <WordSelectForm
              minLength={minWordLength}
              maxLength={maxWordLength}
              onSubmit={(word) => dispatch({ type: 'SELECT_WORD', word })}
            />
          ) : (
            <div className="mt-6 text-center">
              <p className="text-sm font-medium text-ink/60">Picking a secret word</p>
              <h1 className="mt-2 font-display text-2xl font-bold text-ink">{nameOf(state.selectorIndex)}</h1>
              <p className="mt-3 text-ink/70">Hang tight while they choose a word or phrase.</p>
            </div>
          )}
        </div>
        <StandingsDialog />
      </div>
    );
  }

  // --- pass ---
  if (state.phase === 'pass') {
    const isMe = mySeat === state.guesserIndex;
    const isFirstGuesser = state.guessedLetters.length === 0;
    return (
      <div key={`pass-${state.turnSeq}`} className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md text-center">
          <ArrowRight className="mx-auto h-8 w-8 text-coral" />
          <p className="mt-4 text-sm font-medium text-ink/60">{isMe ? 'Your turn is up next' : 'Up next'}</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink">{nameOf(state.guesserIndex)}</h1>
          {isMe ? (
            <>
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
            </>
          ) : (
            <p className="mt-3 text-ink/70">Waiting for {nameOf(state.guesserIndex)} to get ready…</p>
          )}
        </div>
      </div>
    );
  }

  // --- guess ---
  if (state.phase === 'guess') {
    const isMe = mySeat === state.guesserIndex;
    return (
      <div key={`guess-${state.turnSeq}`} className="flex min-h-screen flex-col items-center bg-cream px-6 py-10 animate-enter">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between">
            <StandingsButton />
            <HangmanTimer turnDeadline={state.turnDeadline} />
          </div>
          <h1 className="mt-6 text-center font-display text-2xl font-bold text-ink">
            {nameOf(state.guesserIndex)}'s turn
          </h1>
          <div className="mt-6">
            <HangmanWordDisplay word={state.word ?? []} />
          </div>
          <p className="mt-4 text-center text-xs text-ink/50">
            {isMe
              ? 'Each correct letter is +1, plus +2 for finishing — running out the clock costs −1.'
              : `Waiting for ${nameOf(state.guesserIndex)} to guess a letter…`}
          </p>
          <div className="mt-6">
            <HangmanKeyboard
              guessedLetters={state.guessedLetters}
              word={state.word ?? []}
              onGuess={(letter) => dispatch({ type: 'GUESS_LETTER', letter })}
              disabled={!isMe}
              listenPhysicalKeyboard={isMe}
            />
          </div>
        </div>
        <StandingsDialog />
      </div>
    );
  }

  // --- judge ---
  if (state.phase === 'judge') {
    const isGuesser = mySeat === state.guesserIndex;
    const myVote = mySeat >= 0 ? (state.judgeVotes[mySeat] ?? null) : null;
    const votesIn = Object.keys(state.judgeVotes).length;
    const eligibleVoters = seatIds.length - 1;
    const approveCount = Object.values(state.judgeVotes).filter(Boolean).length;
    const preview = seatIds
      .map((id, i) => ({ name: players.find((p) => p.id === id)?.name ?? '???', delta: state.roundDelta[i] }))
      .filter((e) => e.delta !== 0)
      .sort((a, b) => b.delta - a.delta);

    return (
      <div key="judge" className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md text-center">
          <p className="font-display text-lg font-semibold text-coral">Was this a fair word?</p>
          <p className="mt-2 font-display text-3xl font-bold tracking-wide text-ink animate-pop">{state.word?.join('')}</p>
          <p className="mt-3 text-sm text-ink/70">
            Check it's spelled correctly and it's a real, appropriate word. If rejected, nobody scores this round.
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

          <p className="mt-6 text-xs text-ink/50">
            {votesIn} of {eligibleVoters} votes in ({approveCount} approve)
          </p>

          {isGuesser ? (
            <p className="mt-4 text-sm text-ink/70">Waiting on the rest of the group to vote…</p>
          ) : myVote != null ? (
            <p className="mt-4 text-sm text-ink/70">
              You voted {myVote ? 'Approve' : 'Reject'}. Waiting on the rest of the group…
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => dispatch({ type: 'JUDGE_VOTE', approve: true })}
                className="border-[3px] border-ink bg-lime py-3 font-display font-semibold text-ink shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: 'JUDGE_VOTE', approve: false })}
                className="border-[3px] border-ink bg-coral py-3 font-display font-semibold text-ink shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- roundSummary ---
  const breakdown = seatIds
    .map((id, i) => ({ name: players.find((p) => p.id === id)?.name ?? '???', delta: state.roundDelta[i] }))
    .filter((e) => e.delta !== 0)
    .sort((a, b) => b.delta - a.delta);

  return (
    <div key={`summary-${state.wordsPlayed}`} className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 animate-enter">
      <div className="w-full max-w-md text-center">
        {state.roundVoided ? (
          <p className="font-display text-2xl font-bold text-coral">Word rejected</p>
        ) : (
          <p className="flex items-center justify-center gap-2 font-display text-2xl font-bold text-ink">
            <Star className="h-6 w-6 text-coral" fill="currentColor" /> Solved!
          </p>
        )}
        <p className="mt-2 font-display text-3xl font-bold tracking-wide text-ink animate-pop">{state.word?.join('')}</p>
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
            <li
              key={p.name}
              className="flex items-center justify-between border-[2px] border-ink bg-paper px-3 py-2 text-sm animate-stagger"
              style={{ '--stagger-index': i } as React.CSSProperties}
            >
              <span className="text-ink">#{i + 1} {p.name}</span>
              <span className="font-bold text-ink">{p.points} pts</span>
            </li>
          ))}
        </ul>
        {isHost ? (
          <button
            type="button"
            onClick={() => dispatch({ type: 'NEXT_ROUND' })}
            className="mt-8 w-full border-[3px] border-ink bg-lime py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
          >
            Continue
          </button>
        ) : (
          <p className="mt-8 text-sm text-ink/50">Waiting for the host to continue…</p>
        )}
      </div>
    </div>
  );
}

function WordSelectForm({
  minLength,
  maxLength,
  onSubmit,
}: {
  minLength: number;
  maxLength: number;
  onSubmit: (word: string) => void;
}) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const error = validateWord(value, minLength, maxLength);
  const canSubmit = value.length > 0 && !error;

  const submit = () => {
    if (!canSubmit) {
      setTouched(true);
      return;
    }
    onSubmit(value);
  };

  return (
    <div className="mt-6 text-center">
      <h1 className="font-display text-2xl font-bold text-ink">Enter a secret word</h1>
      <p className="mt-3 text-sm text-ink/70">
        {minLength}–{maxLength} letters. Spaces or hyphens allowed in the middle (e.g. "well-known").
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
      <div className={`mt-2 h-5 text-sm text-coral ${touched && error ? 'animate-shake' : ''}`}>{touched && error ? error : '\u00A0'}</div>
      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-4 w-full border-[3px] border-ink bg-coral py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Lock it in
      </button>
    </div>
  );
}
