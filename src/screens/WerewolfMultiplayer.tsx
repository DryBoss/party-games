import { useState } from 'react';
import { Moon, Sun, Eye, ShieldCheck, Skull, Users } from 'lucide-react';
import BackButton from '../components/BackButton';
import type { Role, WerewolfAction, WerewolfPublicState } from '../games/werewolf';
import type { Player } from '../types/player';

interface WerewolfMultiplayerProps {
  publicState: WerewolfPublicState;
  seatIds: string[];
  myId: string | null;
  isHost: boolean;
  players: Player[];
  myRole: { role: Role; packmates: string[] } | null;
  wolfTally: Record<number, number>;
  seerLog: { targetSeat: number; isWerewolf: boolean }[];
  dispatch: (action: WerewolfAction) => void;
  onExit: () => void;
  onPlayAgain: () => void;
}

const roleLabel: Record<Role, string> = {
  werewolf: 'Werewolf',
  villager: 'Villager',
  seer: 'Seer',
  doctor: 'Doctor',
};

function AlivePlayerList({
  seatIds,
  players,
  alive,
  emphasizeSeat,
}: {
  seatIds: string[];
  players: Player[];
  alive: boolean[];
  emphasizeSeat?: number;
}) {
  const nameOf = (seat: number) => players.find((p) => p.id === seatIds[seat])?.name ?? '???';
  return (
    <ul className="mt-4 flex flex-wrap justify-center gap-2">
      {seatIds.map((_, seat) => (
        <li
          key={seat}
          className={`border-[2px] px-3 py-1 text-sm font-medium ${
            !alive[seat]
              ? 'border-ink/30 bg-ink/5 text-ink/30 line-through'
              : seat === emphasizeSeat
                ? 'border-ink bg-lime text-ink'
                : 'border-ink bg-paper text-ink'
          }`}
        >
          {nameOf(seat)}
        </li>
      ))}
    </ul>
  );
}

export default function WerewolfMultiplayer({
  publicState,
  seatIds,
  myId,
  isHost,
  players,
  myRole,
  wolfTally,
  seerLog,
  dispatch,
  onExit,
  onPlayAgain,
}: WerewolfMultiplayerProps) {
  const [showRoster, setShowRoster] = useState(false);
  const mySeat = myId ? seatIds.indexOf(myId) : -1;
  const nameOf = (seat: number) => players.find((p) => p.id === seatIds[seat])?.name ?? '???';
  const iAmAlive = mySeat >= 0 && publicState.alive[mySeat];

  const RosterButton = () => (
    <button
      type="button"
      onClick={() => setShowRoster(true)}
      className="inline-flex items-center gap-1.5 border-[2px] border-ink bg-paper px-3 py-1.5 text-xs font-medium text-ink shadow-[2px_2px_0_0_var(--color-ink)]"
    >
      <Users className="h-3.5 w-3.5" /> Players
    </button>
  );

  const RosterDialog = () =>
    showRoster ? (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 p-6"
        onClick={() => setShowRoster(false)}
      >
        <div
          className="w-full max-w-xs border-[3px] border-ink bg-paper p-5 shadow-[6px_6px_0_0_var(--color-ink)] animate-pop"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-display text-lg font-bold text-ink">Players</p>
          <AlivePlayerList seatIds={seatIds} players={players} alive={publicState.alive} />
          <button
            type="button"
            onClick={() => setShowRoster(false)}
            className="mt-4 w-full border-[2px] border-ink bg-lime py-2 text-sm font-semibold text-ink"
          >
            Close
          </button>
        </div>
      </div>
    ) : null;

  // --- finished ---
  if (publicState.phase === 'finished') {
    return (
      <div key="finished" className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md text-center">
          <BackButton label="Back to games" onClick={onExit} />
          <span className="mx-auto mt-8 inline-flex h-14 w-14 items-center justify-center border-[3px] border-ink bg-lime shadow-[6px_6px_0_0_var(--color-ink)] animate-pop">
            {publicState.winner === 'werewolves' ? (
              <Skull className="h-7 w-7 text-ink" />
            ) : (
              <ShieldCheck className="h-7 w-7 text-ink" />
            )}
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold text-ink">
            {publicState.winner === 'werewolves' ? 'The werewolves win' : 'The village wins'}
          </h1>
          <ul className="mt-6 flex flex-col gap-2 text-left">
            {seatIds.map((_, seat) => (
              <li
                key={seat}
                className="flex items-center justify-between border-[2px] border-ink bg-paper px-4 py-2 text-sm"
              >
                <span className={publicState.alive[seat] ? 'text-ink' : 'text-ink/40 line-through'}>
                  {nameOf(seat)}
                </span>
                <span className="font-medium text-ink/70">
                  {publicState.revealedRoles ? roleLabel[publicState.revealedRoles[seat]] : ''}
                </span>
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

  // --- night ---
  if (publicState.phase === 'night') {
    const iHaveNightAction = iAmAlive && myRole && myRole.role !== 'villager';

    if (iHaveNightAction && myRole) {
      if (myRole.role === 'werewolf') {
        const targets = seatIds
          .map((_, i) => i)
          .filter((i) => publicState.alive[i] && !myRole.packmates.includes(nameOf(i)) && i !== mySeat);
        const myVote = wolfTally[mySeat];
        return (
          <div key="night-wolf" className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 animate-enter">
            <div className="w-full max-w-md text-center">
              <Skull className="mx-auto h-8 w-8 text-coral" />
              <p className="mt-3 text-sm font-medium text-ink/60">Night {publicState.nightNumber}</p>
              <h1 className="mt-1 font-display text-2xl font-bold text-ink">Choose a victim</h1>
              {myRole.packmates.length > 0 && (
                <p className="mt-2 text-sm text-ink/60">
                  With: <strong>{myRole.packmates.join(', ')}</strong>
                </p>
              )}
              <div className="mt-6 flex flex-col gap-2 text-left">
                {targets.map((seat) => (
                  <button
                    key={seat}
                    type="button"
                    onClick={() => dispatch({ type: 'WOLF_VOTE', targetSeat: seat })}
                    className={`flex items-center justify-between border-[2px] border-ink px-4 py-2 text-sm font-medium ${myVote === seat ? 'bg-lime text-ink' : 'bg-paper text-ink'}`}
                  >
                    {nameOf(seat)}
                    {wolfTally[seat] !== undefined && (
                      <span className="text-xs text-ink/50">
                        {Object.values(wolfTally).filter((v) => v === seat).length} vote
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs text-ink/50">Votes update live for your pack.</p>
            </div>
          </div>
        );
      }
      if (myRole.role === 'seer') {
        const targets = seatIds.map((_, i) => i).filter((i) => publicState.alive[i] && i !== mySeat);
        const last = seerLog.at(-1);
        return (
          <div key="night-seer" className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 animate-enter">
            <div className="w-full max-w-md text-center">
              <Eye className="mx-auto h-8 w-8 text-coral" />
              <p className="mt-3 text-sm font-medium text-ink/60">Night {publicState.nightNumber}</p>
              <h1 className="mt-1 font-display text-2xl font-bold text-ink">Inspect a player</h1>
              <div className="mt-6 flex flex-col gap-2 text-left">
                {targets.map((seat) => (
                  <button
                    key={seat}
                    type="button"
                    onClick={() => dispatch({ type: 'SEER_INSPECT', targetSeat: seat })}
                    className="border-[2px] border-ink bg-paper px-4 py-2 text-sm font-medium text-ink"
                  >
                    {nameOf(seat)}
                  </button>
                ))}
              </div>
              {last && (
                <p className="mt-4 border-[2px] border-ink bg-paper px-4 py-2 text-sm font-medium text-ink animate-pop">
                  {nameOf(last.targetSeat)} is {last.isWerewolf ? 'a werewolf!' : 'not a werewolf.'}
                </p>
              )}
              {seerLog.length > 1 && (
                <details className="mt-3 text-left text-xs text-ink/50">
                  <summary className="cursor-pointer">Past inspections</summary>
                  <ul className="mt-1">
                    {seerLog.slice(0, -1).map((e, i) => (
                      <li key={i}>
                        {nameOf(e.targetSeat)}: {e.isWerewolf ? 'werewolf' : 'not a werewolf'}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        );
      }
      // doctor
      const targets = seatIds.map((_, i) => i).filter((i) => publicState.alive[i]);
      return (
        <div key="night-doctor" className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 animate-enter">
          <div className="w-full max-w-md text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-coral" />
            <p className="mt-3 text-sm font-medium text-ink/60">Night {publicState.nightNumber}</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-ink">Protect a player</h1>
            <div className="mt-6 flex flex-col gap-2 text-left">
              {targets.map((seat) => (
                <button
                  key={seat}
                  type="button"
                  onClick={() => dispatch({ type: 'DOCTOR_PROTECT', targetSeat: seat })}
                  className="border-[2px] border-ink bg-paper px-4 py-2 text-sm font-medium text-ink"
                >
                  {nameOf(seat)}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // waiting (villager, dead, or no role loaded yet)
    return (
      <div key="night-wait" className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md text-center">
          <Moon className="mx-auto h-10 w-10 text-coral animate-pulse-soft" />
          <p className="mt-4 text-sm font-medium text-ink/60">Night {publicState.nightNumber}</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">
            {iAmAlive ? 'The village sleeps…' : "You've died — you're watching now."}
          </h1>
          <p className="mt-3 text-ink/70">Something's happening in the dark.</p>
          {isHost && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'RESOLVE_NIGHT' })}
              className="mt-8 w-full border-[3px] border-ink bg-coral py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
            >
              Resolve the night
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- dawn ---
  if (publicState.phase === 'dawn') {
    const lastDeath = publicState.deathLog.at(-1);
    return (
      <div key={`dawn-${publicState.nightNumber}`} className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md text-center">
          <Sun className="mx-auto h-10 w-10 text-coral animate-pop" />
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">
            {publicState.lastNightVictim === null
              ? 'Nobody died last night.'
              : `${nameOf(publicState.lastNightVictim)} was found dead.`}
          </h1>
          {publicState.lastNightVictim !== null && lastDeath && (
            <p className="mt-2 text-ink/70">They were the {roleLabel[lastDeath.role]}.</p>
          )}
          {isHost ? (
            <button
              type="button"
              onClick={() => dispatch({ type: 'CONTINUE_TO_DAY' })}
              className="mt-8 w-full border-[3px] border-ink bg-lime py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
            >
              Begin the day
            </button>
          ) : (
            <p className="mt-8 text-sm text-ink/50">Waiting for the host to continue…</p>
          )}
        </div>
      </div>
    );
  }

  // --- day ---
  const targets = seatIds.map((_, i) => i).filter((i) => publicState.alive[i]);
  const myVote = mySeat >= 0 ? publicState.dayVotes[mySeat] : undefined;
  return (
    <div key={`day-${publicState.nightNumber}`} className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 animate-enter">
      <div className="w-full max-w-md">
        <div className="flex justify-end">
          <RosterButton />
        </div>
        <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-ink/60">
          <Sun className="h-4 w-4" /> Day {publicState.nightNumber}
        </p>
        <h1 className="mt-2 text-center font-display text-2xl font-bold text-ink">
          {iAmAlive ? 'Who do you vote out?' : "You've died — you're watching now."}
        </h1>
        {iAmAlive && (
          <div className="mt-6 flex flex-col gap-2 text-left">
            {targets.map((seat) => (
              <button
                key={seat}
                type="button"
                onClick={() => dispatch({ type: 'DAY_VOTE', targetSeat: seat })}
                className={`flex items-center justify-between border-[2px] border-ink px-4 py-2 text-sm font-medium ${myVote === seat ? 'bg-lime text-ink' : 'bg-paper text-ink'}`}
              >
                {nameOf(seat)}
                <span className="text-xs text-ink/50">
                  {Object.values(publicState.dayVotes).filter((v) => v === seat).length} vote
                  {Object.values(publicState.dayVotes).filter((v) => v === seat).length === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
        )}
        {isHost && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'RESOLVE_DAY' })}
            className="mt-8 w-full border-[3px] border-ink bg-coral py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
          >
            Reveal the vote
          </button>
        )}
      </div>
      <RosterDialog />
    </div>
  );
}
