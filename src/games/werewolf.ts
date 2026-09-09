export type Role = 'werewolf' | 'villager' | 'seer' | 'doctor';
export type Phase = 'night' | 'dawn' | 'day' | 'finished';
export type Winner = 'werewolves' | 'villagers' | null;

export interface WerewolfConfig {
  werewolfCount: number;
  hasSeer: boolean;
  hasDoctor: boolean;
}

export interface DeathRecord {
  seat: number;
  role: Role;
  cause: 'night' | 'day';
}

export interface WerewolfState {
  config: WerewolfConfig;
  roles: Role[]; // never broadcast wholesale — see toPublicState
  alive: boolean[];
  phase: Phase;
  nightNumber: number;
  wolfVotes: Record<number, number>; // private scratch — werewolf seat -> target seat
  doctorTarget: number | null; // private scratch
  seerTarget: number | null; // private scratch
  lastNightVictim: number | null; // public once resolved (null = nobody died, ambiguous whether saved)
  lastDayEliminated: number | null;
  dayVotes: Record<number, number>; // public — day voting is open, unlike night actions
  winner: Winner;
  deathLog: DeathRecord[]; // public — classic rule: your role is revealed once you die
}

/** What everyone (including the host) renders from — no secrets in here
 * except full `roles`, which only appears once the game is finished. */
export interface WerewolfPublicState {
  config: WerewolfConfig;
  playerCount: number;
  alive: boolean[];
  phase: Phase;
  nightNumber: number;
  dayVotes: Record<number, number>;
  lastNightVictim: number | null;
  lastDayEliminated: number | null;
  winner: Winner;
  deathLog: DeathRecord[];
  revealedRoles: Role[] | null;
}

export function toPublicState(state: WerewolfState): WerewolfPublicState {
  return {
    config: state.config,
    playerCount: state.roles.length,
    alive: state.alive,
    phase: state.phase,
    nightNumber: state.nightNumber,
    dayVotes: state.dayVotes,
    lastNightVictim: state.lastNightVictim,
    lastDayEliminated: state.lastDayEliminated,
    winner: state.winner,
    deathLog: state.deathLog,
    revealedRoles: state.phase === 'finished' ? state.roles : null,
  };
}

function shuffledIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function assignRoles(playerCount: number, config: WerewolfConfig): Role[] {
  const roles: Role[] = Array(playerCount).fill('villager');
  const order = shuffledIndices(playerCount);
  let i = 0;
  for (let w = 0; w < config.werewolfCount; w++) roles[order[i++]] = 'werewolf';
  if (config.hasSeer) roles[order[i++]] = 'seer';
  if (config.hasDoctor) roles[order[i++]] = 'doctor';
  return roles;
}

export function initState(playerCount: number, config: WerewolfConfig): WerewolfState {
  return {
    config,
    roles: assignRoles(playerCount, config),
    alive: Array(playerCount).fill(true),
    phase: 'night',
    nightNumber: 1,
    wolfVotes: {},
    doctorTarget: null,
    seerTarget: null,
    lastNightVictim: null,
    lastDayEliminated: null,
    dayVotes: {},
    winner: null,
    deathLog: [],
  };
}

function checkWinner(roles: Role[], alive: boolean[]): Winner {
  let aliveWolves = 0;
  let aliveOthers = 0;
  roles.forEach((r, i) => {
    if (!alive[i]) return;
    if (r === 'werewolf') aliveWolves++;
    else aliveOthers++;
  });
  if (aliveWolves === 0) return 'villagers';
  if (aliveWolves >= aliveOthers) return 'werewolves';
  return null;
}

/** Converts a {voterSeat: targetSeat} map into a {targetSeat: voteCount} tally. */
function tallyVotes(votes: Record<number, number>): Record<number, number> {
  const tally: Record<number, number> = {};
  Object.values(votes).forEach((target) => {
    tally[target] = (tally[target] ?? 0) + 1;
  });
  return tally;
}

/** Highest-voted key in a target->count tally. Returns null if there are no
 * votes, or (when `randomOnTie` is false) if the top spot is tied. */
function topVoted(tally: Record<number, number>, randomOnTie: boolean): number | null {
  const entries = Object.entries(tally);
  if (entries.length === 0) return null;
  const max = Math.max(...entries.map(([, c]) => c));
  const top = entries.filter(([, c]) => c === max).map(([seat]) => Number(seat));
  if (top.length === 1) return top[0];
  if (randomOnTie) return top[Math.floor(Math.random() * top.length)];
  return null; // classic rule: a tied day vote lynches nobody
}

export type WerewolfAction =
  | { type: 'WOLF_VOTE'; targetSeat: number }
  | { type: 'DOCTOR_PROTECT'; targetSeat: number }
  | { type: 'SEER_INSPECT'; targetSeat: number }
  | { type: 'RESOLVE_NIGHT' }
  | { type: 'CONTINUE_TO_DAY' }
  | { type: 'DAY_VOTE'; targetSeat: number }
  | { type: 'RESOLVE_DAY' };

/** An instruction to privately deliver `message` to whoever holds `seat` —
 * the caller (App-level host wrapper) is responsible for actually sending
 * it, since the pure engine has no notion of transport. */
export interface WerewolfNotify {
  seat: number;
  message: unknown;
}

export interface WerewolfReduceMeta {
  seatIndex: number | null;
  /** Local same-device play only — one shared screen legitimately acts on
   * behalf of whichever seat is relevant; there's no one to cheat against. */
  bypassAuth?: boolean;
}

export interface WerewolfReduceResult {
  state: WerewolfState;
  error: string | null;
  notify: WerewolfNotify[];
}

export function reduce(
  state: WerewolfState,
  action: WerewolfAction,
  meta: WerewolfReduceMeta,
): WerewolfReduceResult {
  const { seatIndex, bypassAuth = false } = meta;
  const noop = (error: string | null = null): WerewolfReduceResult => ({ state, error, notify: [] });

  switch (action.type) {
    case 'WOLF_VOTE': {
      if (state.phase !== 'night') return noop();
      if (seatIndex == null) return noop('Unknown seat');
      if (!bypassAuth && (state.roles[seatIndex] !== 'werewolf' || !state.alive[seatIndex])) {
        return noop('Only living werewolves can do this');
      }
      const wolfVotes = { ...state.wolfVotes, [seatIndex]: action.targetSeat };
      const notify: WerewolfNotify[] = state.roles
        .map((r, i) => ({ r, i }))
        .filter(({ r, i }) => r === 'werewolf' && state.alive[i])
        .map(({ i }) => ({ seat: i, message: { type: 'werewolf:wolf-tally', votes: wolfVotes } }));
      return { state: { ...state, wolfVotes }, error: null, notify };
    }

    case 'DOCTOR_PROTECT': {
      if (state.phase !== 'night') return noop();
      if (seatIndex == null) return noop('Unknown seat');
      if (!bypassAuth && (state.roles[seatIndex] !== 'doctor' || !state.alive[seatIndex])) {
        return noop('Only the living doctor can do this');
      }
      return { state: { ...state, doctorTarget: action.targetSeat }, error: null, notify: [] };
    }

    case 'SEER_INSPECT': {
      if (state.phase !== 'night') return noop();
      if (seatIndex == null) return noop('Unknown seat');
      if (!bypassAuth && (state.roles[seatIndex] !== 'seer' || !state.alive[seatIndex])) {
        return noop('Only the living seer can do this');
      }
      const isWerewolf = state.roles[action.targetSeat] === 'werewolf';
      return {
        state: { ...state, seerTarget: action.targetSeat },
        error: null,
        notify: [
          {
            seat: seatIndex,
            message: { type: 'werewolf:seer-result', targetSeat: action.targetSeat, isWerewolf },
          },
        ],
      };
    }

    case 'RESOLVE_NIGHT': {
      if (state.phase !== 'night') return noop();
      const victim = topVoted(tallyVotes(state.wolfVotes), true);
      const saved = victim !== null && state.doctorTarget === victim;

      let alive = state.alive;
      let deathLog = state.deathLog;
      if (victim !== null && !saved) {
        alive = alive.map((a, i) => (i === victim ? false : a));
        deathLog = [...deathLog, { seat: victim, role: state.roles[victim], cause: 'night' }];
      }

      const winner = checkWinner(state.roles, alive);
      return {
        state: {
          ...state,
          alive,
          deathLog,
          lastNightVictim: victim !== null && !saved ? victim : null,
          wolfVotes: {},
          doctorTarget: null,
          seerTarget: null,
          phase: winner ? 'finished' : 'dawn',
          winner,
        },
        error: null,
        notify: [],
      };
    }

    case 'CONTINUE_TO_DAY': {
      if (state.phase !== 'dawn') return noop();
      return { state: { ...state, phase: 'day', dayVotes: {} }, error: null, notify: [] };
    }

    case 'DAY_VOTE': {
      if (state.phase !== 'day') return noop();
      if (seatIndex == null) return noop('Unknown seat');
      if (!bypassAuth && !state.alive[seatIndex]) return noop('Only living players can vote');
      const dayVotes = { ...state.dayVotes, [seatIndex]: action.targetSeat };
      return { state: { ...state, dayVotes }, error: null, notify: [] };
    }

    case 'RESOLVE_DAY': {
      if (state.phase !== 'day') return noop();
      const eliminated = topVoted(tallyVotes(state.dayVotes), false);

      let alive = state.alive;
      let deathLog = state.deathLog;
      if (eliminated !== null) {
        alive = alive.map((a, i) => (i === eliminated ? false : a));
        deathLog = [...deathLog, { seat: eliminated, role: state.roles[eliminated], cause: 'day' }];
      }

      const winner = checkWinner(state.roles, alive);
      return {
        state: {
          ...state,
          alive,
          deathLog,
          lastDayEliminated: eliminated,
          dayVotes: {},
          wolfVotes: {},
          doctorTarget: null,
          seerTarget: null,
          nightNumber: winner ? state.nightNumber : state.nightNumber + 1,
          phase: winner ? 'finished' : 'night',
          winner,
        },
        error: null,
        notify: [],
      };
    }

    default:
      return noop('Unknown action');
  }
}

// --- Setup ---

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 16;

export function suggestedWerewolfCount(playerCount: number): number {
  return Math.max(1, Math.round(playerCount / 4));
}

export function maxWerewolfCount(playerCount: number, hasSeer: boolean, hasDoctor: boolean): number {
  const reserved = (hasSeer ? 1 : 0) + (hasDoctor ? 1 : 0);
  // Leave at least 2 non-werewolf seats so the game can't start already lost.
  return Math.max(1, playerCount - reserved - 2);
}
