import { useEffect, useState } from 'react';
import { HandCoins, Skull, Users } from 'lucide-react';
import BackButton from '../components/BackButton';
import { resolveChoices } from '../games/splitOrSteal';
import type { Choice, SplitOrStealEvent, SplitOrStealState } from '../games/splitOrSteal';
import type { Player } from '../types/player';

interface SplitOrStealMultiplayerProps {
  players: Player[];
  isHost: boolean;
  myId: string | null;
  activeGame: SplitOrStealState;
  /** Host-only: applies an event locally AND broadcasts it to everyone. */
  dispatchAsHost: (event: SplitOrStealEvent) => void;
  sendGameMessage: (msg: unknown) => void;
  onGameMessage: (listener: (data: unknown) => void) => () => void;
  /** Host-only: starts a fresh game with the same round count. */
  onPlayAgain: () => void;
  onExit: () => void;
}

interface ChoiceMessage {
  type: 'choice';
  index: number;
  playerId: string;
  choice: Choice;
}

function isChoiceMessage(data: unknown): data is ChoiceMessage {
  const d = data as Partial<ChoiceMessage>;
  return d?.type === 'choice' && typeof d.index === 'number' && typeof d.playerId === 'string';
}

function Scoreboard({ players, scores }: { players: Player[]; scores: Record<string, number> }) {
  const ranked = [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  return (
    <div className="mt-8 w-full">
      <p className="flex items-center gap-2 text-sm font-medium text-ink/60">
        <Users className="h-4 w-4" /> Scoreboard
      </p>
      <ol className="mt-2 flex flex-col gap-2">
        {ranked.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between border-[2px] border-ink bg-paper px-3 py-2 text-sm"
          >
            <span className="font-medium text-ink">{p.name}</span>
            <span className="font-display font-bold text-ink">{scores[p.id] ?? 0}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function SplitOrStealMultiplayer({
  players,
  isHost,
  myId,
  activeGame,
  dispatchAsHost,
  sendGameMessage,
  onGameMessage,
  onPlayAgain,
  onExit,
}: SplitOrStealMultiplayerProps) {
  const [pendingChoices, setPendingChoices] = useState<{ index: number; a?: Choice; b?: Choice }>({
    index: -1,
  });
  const [myChoiceRecord, setMyChoiceRecord] = useState<{ index: number; choice: Choice } | null>(
    null,
  );

  const match = activeGame.schedule[activeGame.currentIndex];
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? '???';
  const revealedForCurrent = activeGame.lastReveal?.index === activeGame.currentIndex;

  // Only ever trust choices tagged for the CURRENT match index — never a
  // reset-effect racing against a reveal-check effect (both would otherwise
  // read the same stale pre-reset snapshot in the same commit).
  const currentPending =
    pendingChoices.index === activeGame.currentIndex ? pendingChoices : { index: activeGame.currentIndex };
  const myChoice =
    myChoiceRecord?.index === activeGame.currentIndex ? myChoiceRecord.choice : null;

  // Host: collect private choice submissions from whichever two players are
  // in the current match (including relaying its own choice, set directly
  // below rather than over the network — sending it would broadcast it).
  useEffect(() => {
    if (!isHost || !match) return;
    return onGameMessage((data) => {
      if (!isChoiceMessage(data) || data.index !== activeGame.currentIndex) return;
      setPendingChoices((prev) => {
        const base = prev.index === activeGame.currentIndex ? prev : { index: activeGame.currentIndex };
        if (data.playerId === match.playerAId) return { ...base, a: data.choice };
        if (data.playerId === match.playerBId) return { ...base, b: data.choice };
        return base;
      });
    });
  }, [isHost, onGameMessage, activeGame.currentIndex, match]);

  // Host: once both choices are in for the current match, reveal.
  useEffect(() => {
    if (!isHost || !match || revealedForCurrent) return;
    if (currentPending.a && currentPending.b) {
      const { aPoints, bPoints } = resolveChoices(currentPending.a, currentPending.b);
      const scores = { ...activeGame.scores };
      scores[match.playerAId] = (scores[match.playerAId] ?? 0) + aPoints;
      scores[match.playerBId] = (scores[match.playerBId] ?? 0) + bPoints;
      dispatchAsHost({
        type: 'reveal',
        index: activeGame.currentIndex,
        aChoice: currentPending.a,
        bChoice: currentPending.b,
        scores,
      });
    }
  }, [
    isHost,
    match,
    revealedForCurrent,
    currentPending.a,
    currentPending.b,
    activeGame.currentIndex,
    activeGame.scores,
    dispatchAsHost,
  ]);

  const submitChoice = (choice: Choice) => {
    if (!match) return;
    setMyChoiceRecord({ index: activeGame.currentIndex, choice });
    if (isHost) {
      // Host's own choice — applied directly, never sent over the network
      // (broadcasting it would reveal it to everyone before the other
      // player has chosen).
      setPendingChoices((prev) => {
        const base = prev.index === activeGame.currentIndex ? prev : { index: activeGame.currentIndex };
        if (myId === match.playerAId) return { ...base, a: choice };
        if (myId === match.playerBId) return { ...base, b: choice };
        return base;
      });
    } else {
      sendGameMessage({
        type: 'choice',
        index: activeGame.currentIndex,
        playerId: myId,
        choice,
      });
    }
  };

  const handleContinue = () => {
    const nextIndex = activeGame.currentIndex + 1;
    if (nextIndex >= activeGame.schedule.length) {
      dispatchAsHost({ type: 'game-end', scores: activeGame.scores });
    } else {
      dispatchAsHost({ type: 'match-advance', index: nextIndex });
    }
  };

  // --- Finished ---
  if (activeGame.finished || !match) {
    const ranked = [...players].sort(
      (a, b) => (activeGame.scores[b.id] ?? 0) - (activeGame.scores[a.id] ?? 0),
    );
    return (
      <div key="finished" className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md">
          <BackButton label="Back to games" onClick={onExit} />
          <p className="mt-6 font-display text-lg font-semibold text-coral">Split or Steal</p>
          <h1 className="mt-2 font-display text-4xl font-bold text-ink">Final results</h1>
          <ol className="mt-8 flex flex-col gap-3">
            {ranked.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center justify-between border-[3px] border-ink bg-paper px-4 py-3 shadow-[4px_4px_0_0_var(--color-ink)] animate-stagger"
                style={{ '--stagger-index': i } as React.CSSProperties}
              >
                <span className="font-medium text-ink">
                  {i + 1}. {p.name}
                </span>
                <span className="font-display font-bold text-ink">
                  {activeGame.scores[p.id] ?? 0}
                </span>
              </li>
            ))}
          </ol>
          {isHost ? (
            <>
              <button
                type="button"
                onClick={onPlayAgain}
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
            </>
          ) : (
            <p className="mt-8 text-center text-sm text-ink/50">
              Waiting for the host to start a new game or head back…
            </p>
          )}
        </div>
      </div>
    );
  }

  // --- Reveal for current match ---
  if (revealedForCurrent && activeGame.lastReveal) {
    const { aChoice, bChoice } = activeGame.lastReveal;
    const isLast = activeGame.currentIndex + 1 >= activeGame.schedule.length;
    return (
      <div key={`reveal-${activeGame.currentIndex}`} className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md text-center">
          <p className="font-display text-lg font-semibold text-coral">Result</p>
          <div className="mt-6 flex items-center justify-center gap-6">
            <ResultCard name={nameOf(match.playerAId)} choice={aChoice} />
            <span className="font-display text-2xl text-ink/40">vs</span>
            <ResultCard name={nameOf(match.playerBId)} choice={bChoice} />
          </div>
          {isHost ? (
            <button
              type="button"
              onClick={handleContinue}
              className="mt-10 w-full border-[3px] border-ink bg-lime py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
            >
              {isLast ? 'See final results' : 'Next match'}
            </button>
          ) : (
            <p className="mt-8 text-sm text-ink/50">Waiting for the host to continue…</p>
          )}
          <Scoreboard players={players} scores={activeGame.scores} />
        </div>
      </div>
    );
  }

  // --- I'm one of the two players in this match, choosing ---
  const amPlaying = myId === match.playerAId || myId === match.playerBId;
  if (amPlaying && !myChoice) {
    const opponent = nameOf(myId === match.playerAId ? match.playerBId : match.playerAId);
    return (
      <div key={`choose-${activeGame.currentIndex}`} className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md text-center">
          <p className="font-display text-lg font-semibold text-coral">vs {opponent}</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink">Split or Steal?</h1>
          <div className="mt-10 grid grid-cols-2 gap-5">
            <button
              type="button"
              onClick={() => submitChoice('split')}
              className="flex flex-col items-center gap-3 border-[3px] border-ink bg-lime p-6 shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)] active:translate-y-0"
            >
              <HandCoins className="h-8 w-8 text-ink" strokeWidth={2} />
              <span className="font-display text-xl font-semibold text-ink">Split</span>
            </button>
            <button
              type="button"
              onClick={() => submitChoice('steal')}
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

  // --- Waiting: either I already chose, or I'm spectating this match ---
  return (
    <div key={`waiting-${activeGame.currentIndex}`} className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 animate-enter">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-medium text-ink/50">
          Match {activeGame.currentIndex + 1} of {activeGame.schedule.length}
        </p>
        <h1 className="mt-3 font-display text-2xl font-bold leading-tight text-ink">
          {nameOf(match.playerAId)} vs {nameOf(match.playerBId)}
        </h1>
        <p className="mt-3 text-ink/70">
          {amPlaying ? "Choice locked in. Waiting for the other player…" : 'Waiting for both players to choose…'}
        </p>
        <Scoreboard players={players} scores={activeGame.scores} />
      </div>
    </div>
  );
}

function ResultCard({ name, choice }: { name: string; choice: Choice }) {
  return (
    <div className="flex flex-col items-center gap-2 border-[3px] border-ink bg-paper px-5 py-4 shadow-[4px_4px_0_0_var(--color-ink)] animate-pop">
      {choice === 'split' ? (
        <HandCoins className="h-6 w-6 text-ink" strokeWidth={2} />
      ) : (
        <Skull className="h-6 w-6 text-ink" strokeWidth={2} />
      )}
      <span className="font-medium text-ink">{name}</span>
      <span className="text-xs uppercase tracking-wide text-ink/50">{choice}</span>
    </div>
  );
}
