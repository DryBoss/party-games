import { useState } from 'react';
import { Moon, Sun, Eye, ShieldCheck, Skull, Users } from 'lucide-react';
import BackButton from '../components/BackButton';
import { initState, reduce } from '../games/werewolf';
import type { Role, WerewolfAction, WerewolfConfig, WerewolfState } from '../games/werewolf';
import type { Player } from '../types/player';

interface WerewolfLocalPlayProps {
  players: Player[];
  config: WerewolfConfig;
  onExit: () => void;
}

function buildNightQueue(state: WerewolfState): number[] {
  const queue: number[] = [];
  state.roles.forEach((r, i) => {
    if (r === 'werewolf' && state.alive[i]) queue.push(i);
  });
  const seer = state.roles.findIndex((r, i) => r === 'seer' && state.alive[i]);
  if (seer !== -1) queue.push(seer);
  const doctor = state.roles.findIndex((r, i) => r === 'doctor' && state.alive[i]);
  if (doctor !== -1) queue.push(doctor);
  return queue;
}

const roleLabel: Record<Role, string> = {
  werewolf: 'Werewolf',
  villager: 'Villager',
  seer: 'Seer',
  doctor: 'Doctor',
};
const roleBlurb: Record<Role, string> = {
  werewolf: 'Each night, work with the other werewolves to pick a victim.',
  villager: 'No special power — use the day discussion to find the werewolves.',
  seer: "Each night, learn whether one player is a werewolf.",
  doctor: 'Each night, pick one player to protect from the werewolves.',
};

type LocalPhase = 'reveal' | 'night-pass' | 'night-act' | 'night-resolve' | 'dawn' | 'day-vote' | 'day-resolve' | 'finished';

export default function WerewolfLocalPlay({ players, config, onExit }: WerewolfLocalPlayProps) {
  const playerCount = players.length;
  const [state, setState] = useState(() => initState(playerCount, config));
  const [phase, setPhase] = useState<LocalPhase>('reveal');
  const [revealIndex, setRevealIndex] = useState(0);
  const [nightQueue, setNightQueue] = useState<number[]>(() => buildNightQueue(state));
  const [nightIndex, setNightIndex] = useState(0);
  const [voteQueue, setVoteQueue] = useState<number[]>([]);
  const [voteIndex, setVoteIndex] = useState(0);
  const [seerReveal, setSeerReveal] = useState<{ target: number; isWerewolf: boolean } | null>(null);

  const nameOf = (seat: number) => players[seat]?.name ?? '???';
  const alivePlayers = () => players.map((p, i) => ({ p, i })).filter(({ i }) => state.alive[i]);

  const dispatch = (action: WerewolfAction, seatIndex: number) => {
    const { state: next } = reduce(state, action, { seatIndex, bypassAuth: true });
    setState(next);
    return next;
  };

  const startNight = (fromState: WerewolfState) => {
    const queue = buildNightQueue(fromState);
    setNightQueue(queue);
    setNightIndex(0);
    setPhase(queue.length > 0 ? 'night-pass' : 'night-resolve');
  };

  const handleRestart = () => {
    const fresh = initState(playerCount, config);
    setState(fresh);
    setPhase('reveal');
    setRevealIndex(0);
    setNightIndex(0);
    setNightQueue(buildNightQueue(fresh));
    setVoteQueue([]);
    setVoteIndex(0);
    setSeerReveal(null);
  };

  // --- finished ---
  if (phase === 'finished') {
    const ranked = players.map((p, i) => ({ name: p.name, role: state.roles[i], alive: state.alive[i] }));
    return (
      <div key="finished" className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md text-center">
          <BackButton label="Back to games" onClick={onExit} />
          <span className="mx-auto mt-8 inline-flex h-14 w-14 items-center justify-center border-[3px] border-ink bg-lime shadow-[6px_6px_0_0_var(--color-ink)] animate-pop">
            {state.winner === 'werewolves' ? <Skull className="h-7 w-7 text-ink" /> : <ShieldCheck className="h-7 w-7 text-ink" />}
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold text-ink">
            {state.winner === 'werewolves' ? 'The werewolves win' : 'The village wins'}
          </h1>
          <ul className="mt-6 flex flex-col gap-2 text-left">
            {ranked.map((r) => (
              <li key={r.name} className="flex items-center justify-between border-[2px] border-ink bg-paper px-4 py-2 text-sm">
                <span className={r.alive ? 'text-ink' : 'text-ink/40 line-through'}>{r.name}</span>
                <span className="font-medium text-ink/70">{roleLabel[r.role]}</span>
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

  // --- role reveal ---
  if (phase === 'reveal') {
    const seat = revealIndex;
    const role = state.roles[seat];
    const packmates =
      role === 'werewolf'
        ? state.roles.map((r, i) => (r === 'werewolf' && i !== seat ? nameOf(i) : null)).filter((n): n is string => !!n)
        : [];
    const advance = () => {
      if (seat + 1 >= playerCount) startNight(state);
      else setRevealIndex(seat + 1);
    };
    return (
      <PassAndReveal
        keyId={`reveal-${seat}`}
        name={nameOf(seat)}
        prompt="It's time to see your secret role."
        icon={role === 'werewolf' ? <Skull className="h-8 w-8 text-ink" /> : role === 'seer' ? <Eye className="h-8 w-8 text-ink" /> : role === 'doctor' ? <ShieldCheck className="h-8 w-8 text-ink" /> : <Users className="h-8 w-8 text-ink" />}
        title={roleLabel[role]}
        body={
          <>
            <p className="text-ink/70">{roleBlurb[role]}</p>
            {role === 'werewolf' && packmates.length > 0 && (
              <p className="mt-3 text-sm text-ink/60">
                Your fellow werew{packmates.length === 1 ? 'olf is' : 'olves are'}: <strong>{packmates.join(', ')}</strong>
              </p>
            )}
          </>
        }
        onContinue={advance}
      />
    );
  }

  // --- night: pass to next actor ---
  if (phase === 'night-pass') {
    const seat = nightQueue[nightIndex];
    return (
      <div key={`night-pass-${state.nightNumber}-${nightIndex}`} className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md text-center">
          <Moon className="mx-auto h-8 w-8 text-coral" />
          <p className="mt-4 text-sm font-medium text-ink/60">Night {state.nightNumber}</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink">Pass to {nameOf(seat)}</h1>
          <p className="mt-3 text-ink/70">Everyone else, close your eyes.</p>
          <button
            type="button"
            onClick={() => setPhase('night-act')}
            className="mt-8 w-full border-[3px] border-ink bg-lime py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
          >
            I've got it
          </button>
        </div>
      </div>
    );
  }

  // --- night: act ---
  if (phase === 'night-act') {
    const seat = nightQueue[nightIndex];
    const role = state.roles[seat];
    const advance = () => {
      if (nightIndex + 1 >= nightQueue.length) setPhase('night-resolve');
      else {
        setNightIndex(nightIndex + 1);
        setPhase('night-pass');
      }
    };

    if (role === 'werewolf') {
      const targets = players.map((p, i) => ({ p, i })).filter(({ i }) => state.alive[i] && state.roles[i] !== 'werewolf');
      const currentVote = state.wolfVotes[seat];
      return (
        <NightTargetScreen
          keyId={`wolf-${seat}`}
          icon={<Skull className="h-8 w-8 text-ink" />}
          title={`${nameOf(seat)}, choose a victim`}
          subtitle="Vote with your fellow werewolves — majority decides."
          targets={targets.map(({ p, i }) => ({ name: p.name, seat: i }))}
          selected={currentVote}
          onPick={(target) => dispatch({ type: 'WOLF_VOTE', targetSeat: target }, seat)}
          onContinue={advance}
        />
      );
    }
    if (role === 'seer') {
      const targets = players.map((p, i) => ({ p, i })).filter(({ i }) => state.alive[i] && i !== seat);
      return (
        <NightTargetScreen
          keyId={`seer-${seat}`}
          icon={<Eye className="h-8 w-8 text-ink" />}
          title={`${nameOf(seat)}, inspect a player`}
          subtitle="Learn whether they're a werewolf."
          targets={targets.map(({ p, i }) => ({ name: p.name, seat: i }))}
          selected={seerReveal?.target}
          onPick={(target) => {
            dispatch({ type: 'SEER_INSPECT', targetSeat: target }, seat);
            setSeerReveal({ target, isWerewolf: state.roles[target] === 'werewolf' });
          }}
          resultText={
            seerReveal
              ? `${nameOf(seerReveal.target)} is ${seerReveal.isWerewolf ? 'a werewolf!' : 'not a werewolf.'}`
              : undefined
          }
          onContinue={() => {
            setSeerReveal(null);
            advance();
          }}
        />
      );
    }
    // doctor
    const targets = players.map((p, i) => ({ p, i })).filter(({ i }) => state.alive[i]);
    return (
      <NightTargetScreen
        keyId={`doctor-${seat}`}
        icon={<ShieldCheck className="h-8 w-8 text-ink" />}
        title={`${nameOf(seat)}, protect a player`}
        subtitle="They'll survive tonight even if targeted."
        targets={targets.map(({ p, i }) => ({ name: p.name, seat: i }))}
        selected={state.doctorTarget ?? undefined}
        onPick={(target) => dispatch({ type: 'DOCTOR_PROTECT', targetSeat: target }, seat)}
        onContinue={advance}
      />
    );
  }

  // --- night: resolve (dramatic pause before dawn) ---
  if (phase === 'night-resolve') {
    return (
      <div key="night-resolve" className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md text-center">
          <Moon className="mx-auto h-10 w-10 text-coral animate-pulse-soft" />
          <p className="mt-4 text-ink/70">Everyone, wake up.</p>
          <button
            type="button"
            onClick={() => {
              const next = dispatch({ type: 'RESOLVE_NIGHT' }, -1);
              setPhase(next.phase === 'finished' ? 'finished' : 'dawn');
            }}
            className="mt-8 w-full border-[3px] border-ink bg-coral py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
          >
            See what happened
          </button>
        </div>
      </div>
    );
  }

  // --- dawn ---
  if (phase === 'dawn') {
    return (
      <div key={`dawn-${state.nightNumber}`} className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md text-center">
          <Sun className="mx-auto h-10 w-10 text-coral animate-pop" />
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">
            {state.lastNightVictim === null
              ? 'Nobody died last night.'
              : `${nameOf(state.lastNightVictim)} was found dead.`}
          </h1>
          {state.lastNightVictim !== null && (
            <p className="mt-2 text-ink/70">They were the {roleLabel[state.deathLog.at(-1)!.role]}.</p>
          )}
          <button
            type="button"
            onClick={() => {
              const queue = alivePlayers().map(({ i }) => i);
              setVoteQueue(queue);
              setVoteIndex(0);
              setPhase('day-vote');
            }}
            className="mt-8 w-full border-[3px] border-ink bg-lime py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
          >
            Begin the day
          </button>
        </div>
      </div>
    );
  }

  // --- day: vote (open — everyone can see this, matches real gameplay) ---
  if (phase === 'day-vote') {
    const voter = voteQueue[voteIndex];
    const targets = alivePlayers();
    const advance = () => {
      if (voteIndex + 1 >= voteQueue.length) setPhase('day-resolve');
      else setVoteIndex(voteIndex + 1);
    };
    return (
      <div key={`day-vote-${voteIndex}`} className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md">
          <p className="flex items-center gap-2 text-sm font-medium text-ink/60">
            <Sun className="h-4 w-4" /> Day {state.nightNumber}
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink">{nameOf(voter)}, who do you vote out?</h1>
          <div className="mt-6 flex flex-col gap-2">
            {targets.map(({ p, i }) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  dispatch({ type: 'DAY_VOTE', targetSeat: i }, voter);
                }}
                className={`border-[2px] border-ink px-4 py-2 text-left text-sm font-medium ${state.dayVotes[voter] === i ? 'bg-lime text-ink' : 'bg-paper text-ink'}`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={advance}
            disabled={state.dayVotes[voter] === undefined}
            className="mt-6 w-full border-[3px] border-ink bg-coral py-3 font-display text-lg font-semibold text-ink shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirm vote
          </button>
        </div>
      </div>
    );
  }

  // --- day: resolve ---
  if (phase === 'day-resolve') {
    return (
      <div key="day-resolve" className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md text-center">
          <p className="text-ink/70">All votes are in.</p>
          <button
            type="button"
            onClick={() => {
              const next = dispatch({ type: 'RESOLVE_DAY' }, -1);
              if (next.phase === 'finished') setPhase('finished');
              else startNight(next);
            }}
            className="mt-6 w-full border-[3px] border-ink bg-coral py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
          >
            Reveal the vote
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function PassAndReveal({
  keyId,
  name,
  prompt,
  icon,
  title,
  body,
  onContinue,
}: {
  keyId: string;
  name: string;
  prompt: string;
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  onContinue: () => void;
}) {
  const [shown, setShown] = useState(false);
  if (!shown) {
    return (
      <div key={`${keyId}-pass`} className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 animate-enter">
        <div className="w-full max-w-md text-center">
          <p className="text-sm font-medium text-ink/60">Pass to</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink">{name}</h1>
          <p className="mt-3 text-ink/70">{prompt}</p>
          <button
            type="button"
            onClick={() => setShown(true)}
            className="mt-8 w-full border-[3px] border-ink bg-lime py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
          >
            I'm {name}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div key={`${keyId}-show`} className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 animate-enter">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center border-[3px] border-ink bg-lime shadow-[6px_6px_0_0_var(--color-ink)] animate-pop">
          {icon}
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-ink">{title}</h1>
        <div className="mt-3">{body}</div>
        <button
          type="button"
          onClick={onContinue}
          className="mt-8 w-full border-[3px] border-ink bg-paper py-3 font-medium text-ink shadow-[4px_4px_0_0_var(--color-ink)]"
        >
          Got it, hide and pass along
        </button>
      </div>
    </div>
  );
}

function NightTargetScreen({
  keyId,
  icon,
  title,
  subtitle,
  targets,
  selected,
  onPick,
  onContinue,
  resultText,
}: {
  keyId: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  targets: { name: string; seat: number }[];
  selected?: number;
  onPick: (seat: number) => void;
  onContinue: () => void;
  resultText?: string;
}) {
  return (
    <div key={keyId} className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 animate-enter">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center border-[3px] border-ink bg-lime shadow-[4px_4px_0_0_var(--color-ink)]">
          {icon}
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-ink/70">{subtitle}</p>
        <div className="mt-6 flex flex-col gap-2 text-left">
          {targets.map(({ name, seat }) => (
            <button
              key={seat}
              type="button"
              onClick={() => onPick(seat)}
              className={`border-[2px] border-ink px-4 py-2 text-sm font-medium ${selected === seat ? 'bg-lime text-ink' : 'bg-paper text-ink'}`}
            >
              {name}
            </button>
          ))}
        </div>
        {resultText && (
          <p className="mt-4 border-[2px] border-ink bg-paper px-4 py-2 text-sm font-medium text-ink animate-pop">
            {resultText}
          </p>
        )}
        <button
          type="button"
          onClick={onContinue}
          disabled={selected === undefined}
          className="mt-6 w-full border-[3px] border-ink bg-coral py-3 font-display text-lg font-semibold text-ink shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Done, hide and pass along
        </button>
      </div>
    </div>
  );
}
