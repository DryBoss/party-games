// Ported from github.com/DryBoss/hangman-friends' supabase/functions/_shared/engine.js.
// Same rules, same constants, same phase machine — this is the "exact
// mechanism" of the original game, just retyped for TS and adapted to
// party-hub's host-authoritative transport instead of Supabase.

export const CORRECT_GUESS_POINTS = 1;
export const FINISHER_BONUS_POINTS = 2;
export const TIME_UP_PENALTY = 1;

export const SELECT_DEADLINE_MS = 60_000;
export const PASS_DEADLINE_MS = 8_000;
export const JUDGE_DEADLINE_MS = 45_000;

export const FALLBACK_WORDS = [
  'PANCAKE', 'GALAXY', 'UMBRELLA', 'PUZZLE', 'HARBOR', 'WHISPER',
  'LANTERN', 'CACTUS', 'MERMAID', 'THUNDER', 'PRETZEL', 'COMPASS',
];

const isSeparator = (ch: string | null) => ch === ' ' || ch === '-';

export type Phase = 'select' | 'pass' | 'guess' | 'judge' | 'roundSummary' | 'finished';

export interface HangmanSettings {
  turnDuration: number | null; // null = no time limit
  gameMode: 'points' | 'rounds';
  pointsToWin: number;
  roundsToPlay: number;
}

export interface HangmanState extends HangmanSettings {
  score: number[];
  selectorIndex: number;
  guesserIndex: number;
  word: (string | null)[] | null;
  guessedLetters: string[];
  wrongGuessCount: number;
  roundDelta: number[];
  roundVoided: boolean;
  judgeVotes: Record<number, boolean>;
  turnSeq: number;
  wordsPlayed: number;
  phase: Phase;
  winnerIndex: number | null;
  turnDeadline: number | null;
}

export type HangmanAction =
  | { type: 'SELECT_WORD'; word: string }
  | { type: 'READY_TO_GUESS' }
  | { type: 'GUESS_LETTER'; letter: string }
  | { type: 'TIME_UP' }
  | { type: 'AUTO_ADVANCE_SELECT' }
  | { type: 'AUTO_ADVANCE_PASS' }
  | { type: 'JUDGE_VOTE'; approve: boolean; voterSeat?: number }
  | { type: 'JUDGE_DECIDE'; approve: boolean }
  | { type: 'AUTO_ADVANCE_JUDGE' }
  | { type: 'NEXT_ROUND' };

export interface ReduceMeta {
  seatIndex: number | null;
  playerCount: number;
  /** Only ever true for local same-device play — one shared screen legitimately
   * acts on behalf of whichever seat is relevant; there's no one to cheat against. */
  bypassAuth?: boolean;
}

function nextGuesser(guesserIndex: number, selectorIndex: number, playerCount: number) {
  let next = (guesserIndex + 1) % playerCount;
  if (next === selectorIndex) next = (next + 1) % playerCount;
  return next;
}

function deadlineFor(phase: Phase, turnDurationSec: number | null): number | null {
  const now = Date.now();
  if (phase === 'select') return now + SELECT_DEADLINE_MS;
  if (phase === 'pass') return now + PASS_DEADLINE_MS;
  if (phase === 'guess') return turnDurationSec ? now + turnDurationSec * 1000 : null;
  if (phase === 'judge') return now + JUDGE_DEADLINE_MS;
  return null;
}

export function initState(playerCount: number, settings: HangmanSettings): HangmanState {
  const { turnDuration, gameMode, pointsToWin, roundsToPlay } = settings;
  const firstGuesser = nextGuesser(0, 0, playerCount);
  return {
    turnDuration, gameMode, pointsToWin, roundsToPlay,
    score: Array(playerCount).fill(0),
    selectorIndex: 0,
    guesserIndex: firstGuesser,
    word: null,
    guessedLetters: [],
    wrongGuessCount: 0,
    roundDelta: Array(playerCount).fill(0),
    roundVoided: false,
    judgeVotes: {},
    turnSeq: 0,
    wordsPlayed: 0,
    phase: 'select',
    winnerIndex: null,
    turnDeadline: deadlineFor('select', turnDuration),
  };
}

/** Strips the real word out of a state for as long as it needs to stay
 * secret. Safe to call on every state, every time. */
export function maskForBroadcast(state: HangmanState): HangmanState {
  if (!state.word) return state;
  const stillSecret = state.phase === 'select' || state.phase === 'pass' || state.phase === 'guess';
  if (!stillSecret) return state;
  const masked = state.word.map((ch) =>
    isSeparator(ch) || (ch !== null && state.guessedLetters.includes(ch)) ? ch : null,
  );
  return { ...state, word: masked };
}

function resolveJudge(state: HangmanState, approved: boolean): HangmanState {
  if (approved) return { ...state, phase: 'roundSummary', turnDeadline: null };
  const score = state.score.map((s, i) => s - state.roundDelta[i]);
  return { ...state, score, roundVoided: true, phase: 'roundSummary', turnDeadline: null };
}

export function reduce(
  state: HangmanState,
  action: HangmanAction,
  meta: ReduceMeta,
): { state: HangmanState; error: string | null } {
  const { seatIndex, playerCount, bypassAuth = false } = meta;
  const authorized = (requiredSeat: number) => bypassAuth || seatIndex === requiredSeat;

  switch (action.type) {
    case 'SELECT_WORD': {
      if (state.phase !== 'select') return { state, error: null };
      if (!authorized(state.selectorIndex)) return { state, error: "It's not your turn to pick a word" };
      const word = action.word.toUpperCase().split('');
      return {
        state: {
          ...state, word, guessedLetters: [], wrongGuessCount: 0,
          roundDelta: Array(playerCount).fill(0), roundVoided: false, judgeVotes: {},
          turnSeq: state.turnSeq + 1, phase: 'pass',
          turnDeadline: deadlineFor('pass', state.turnDuration),
        },
        error: null,
      };
    }

    case 'READY_TO_GUESS': {
      if (state.phase !== 'pass') return { state, error: null };
      if (!authorized(state.guesserIndex)) return { state, error: 'Only the incoming guesser can confirm ready' };
      return {
        state: {
          ...state, phase: 'guess', turnSeq: state.turnSeq + 1,
          turnDeadline: deadlineFor('guess', state.turnDuration),
        },
        error: null,
      };
    }

    case 'GUESS_LETTER': {
      if (state.phase !== 'guess') return { state, error: null };
      if (!authorized(state.guesserIndex)) return { state, error: "It's not your turn to guess" };
      const letter = action.letter.toUpperCase();
      if (state.guessedLetters.includes(letter)) return { state, error: null };

      const isCorrect = state.word!.includes(letter);
      const guessedLetters = [...state.guessedLetters, letter];

      if (!isCorrect) {
        const newGuesserIndex = nextGuesser(state.guesserIndex, state.selectorIndex, playerCount);
        const samePlayer = newGuesserIndex === state.guesserIndex;
        const phase: Phase = samePlayer ? 'guess' : 'pass';
        return {
          state: {
            ...state, guessedLetters, wrongGuessCount: state.wrongGuessCount + 1,
            guesserIndex: newGuesserIndex, turnSeq: state.turnSeq + 1, phase,
            turnDeadline: deadlineFor(phase, state.turnDuration),
          },
          error: null,
        };
      }

      const score = [...state.score];
      const roundDelta = [...state.roundDelta];
      score[state.guesserIndex] += CORRECT_GUESS_POINTS;
      roundDelta[state.guesserIndex] += CORRECT_GUESS_POINTS;
      const solved = state.word!.every((l) => l === null || isSeparator(l) || guessedLetters.includes(l));

      if (solved) {
        const bonus = state.wrongGuessCount;
        if (bonus > 0) {
          score[state.selectorIndex] += bonus;
          roundDelta[state.selectorIndex] += bonus;
        }
        score[state.guesserIndex] += FINISHER_BONUS_POINTS;
        roundDelta[state.guesserIndex] += FINISHER_BONUS_POINTS;
        return {
          state: {
            ...state, guessedLetters, score, roundDelta, phase: 'judge', judgeVotes: {},
            turnDeadline: deadlineFor('judge', state.turnDuration),
          },
          error: null,
        };
      }

      return {
        state: {
          ...state, guessedLetters, score, roundDelta, turnSeq: state.turnSeq + 1,
          turnDeadline: deadlineFor('guess', state.turnDuration),
        },
        error: null,
      };
    }

    case 'TIME_UP': {
      if (state.phase !== 'guess') return { state, error: null };
      if (!bypassAuth && state.turnDeadline && Date.now() < state.turnDeadline) {
        return { state, error: "Turn hasn't timed out yet" };
      }
      const score = [...state.score];
      const roundDelta = [...state.roundDelta];
      score[state.guesserIndex] -= TIME_UP_PENALTY;
      roundDelta[state.guesserIndex] -= TIME_UP_PENALTY;
      const newGuesserIndex = nextGuesser(state.guesserIndex, state.selectorIndex, playerCount);
      const samePlayer = newGuesserIndex === state.guesserIndex;
      const phase: Phase = samePlayer ? 'guess' : 'pass';
      return {
        state: {
          ...state, score, roundDelta, guesserIndex: newGuesserIndex,
          turnSeq: state.turnSeq + 1, phase, turnDeadline: deadlineFor(phase, state.turnDuration),
        },
        error: null,
      };
    }

    case 'AUTO_ADVANCE_SELECT': {
      if (state.phase !== 'select') return { state, error: null };
      if (!bypassAuth && state.turnDeadline && Date.now() < state.turnDeadline) {
        return { state, error: 'Not timed out yet' };
      }
      const word = FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)].split('');
      return {
        state: {
          ...state, word, guessedLetters: [], wrongGuessCount: 0,
          roundDelta: Array(playerCount).fill(0), roundVoided: false, judgeVotes: {},
          turnSeq: state.turnSeq + 1, phase: 'pass', turnDeadline: deadlineFor('pass', state.turnDuration),
        },
        error: null,
      };
    }

    case 'AUTO_ADVANCE_PASS': {
      if (state.phase !== 'pass') return { state, error: null };
      if (!bypassAuth && state.turnDeadline && Date.now() < state.turnDeadline) {
        return { state, error: 'Not timed out yet' };
      }
      return {
        state: {
          ...state, phase: 'guess', turnSeq: state.turnSeq + 1,
          turnDeadline: deadlineFor('guess', state.turnDuration),
        },
        error: null,
      };
    }

    case 'JUDGE_VOTE': {
      if (state.phase !== 'judge') return { state, error: null };
      if (seatIndex === state.guesserIndex && !bypassAuth) {
        return { state, error: "The guesser doesn't vote on their own solve" };
      }
      const voterSeat = bypassAuth ? action.voterSeat : (seatIndex ?? undefined);
      if (voterSeat == null) return { state, error: 'Unknown seat' };
      const judgeVotes = { ...state.judgeVotes, [voterSeat]: Boolean(action.approve) };
      const eligibleVoters = playerCount - 1;
      const votesIn = Object.keys(judgeVotes).length;

      if (votesIn >= eligibleVoters) {
        const approveCount = Object.values(judgeVotes).filter(Boolean).length;
        const approved = approveCount * 2 >= eligibleVoters;
        return { state: resolveJudge({ ...state, judgeVotes }, approved), error: null };
      }
      return { state: { ...state, judgeVotes }, error: null };
    }

    case 'JUDGE_DECIDE': {
      // Local pass-and-play only: one shared screen renders a single
      // Approve/Reject choice for the whole group.
      if (state.phase !== 'judge') return { state, error: null };
      if (!bypassAuth) return { state, error: 'JUDGE_DECIDE is local-only' };
      return { state: resolveJudge(state, Boolean(action.approve)), error: null };
    }

    case 'AUTO_ADVANCE_JUDGE': {
      if (state.phase !== 'judge') return { state, error: null };
      if (!bypassAuth && state.turnDeadline && Date.now() < state.turnDeadline) {
        return { state, error: 'Not timed out yet' };
      }
      const eligibleVoters = playerCount - 1;
      const approveCount = Object.values(state.judgeVotes).filter(Boolean).length;
      const missing = eligibleVoters - Object.keys(state.judgeVotes).length;
      const approved = (approveCount + missing) * 2 >= eligibleVoters;
      return { state: resolveJudge(state, approved), error: null };
    }

    case 'NEXT_ROUND': {
      if (state.phase !== 'roundSummary') return { state, error: null };
      const wordsPlayed = state.wordsPlayed + 1;
      const reachedTarget =
        state.gameMode === 'rounds'
          ? wordsPlayed >= state.roundsToPlay
          : Math.max(...state.score) >= state.pointsToWin;
      if (reachedTarget) {
        const winnerIndex = state.score.indexOf(Math.max(...state.score));
        return { state: { ...state, phase: 'finished', winnerIndex, wordsPlayed, turnDeadline: null }, error: null };
      }
      const selectorIndex = (state.selectorIndex + 1) % playerCount;
      return {
        state: {
          ...state, selectorIndex, guesserIndex: nextGuesser(selectorIndex, selectorIndex, playerCount),
          word: null, guessedLetters: [], wrongGuessCount: 0, roundDelta: Array(playerCount).fill(0),
          roundVoided: false, judgeVotes: {}, turnSeq: 0, phase: 'select', wordsPlayed,
          turnDeadline: deadlineFor('select', state.turnDuration),
        },
        error: null,
      };
    }

    default:
      return { state, error: 'Unknown action' };
  }
}

export type AutoAdvanceActionType = 'AUTO_ADVANCE_SELECT' | 'AUTO_ADVANCE_PASS' | 'TIME_UP' | 'AUTO_ADVANCE_JUDGE';

/** Maps a live phase to the action that fires once its deadline passes —
 * a host-side watchdog uses this so idle players can't stall the game. */
export const AUTO_ADVANCE_ACTION_FOR_PHASE: Partial<Record<Phase, AutoAdvanceActionType>> = {
  select: 'AUTO_ADVANCE_SELECT',
  pass: 'AUTO_ADVANCE_PASS',
  guess: 'TIME_UP',
  judge: 'AUTO_ADVANCE_JUDGE',
};

// --- Settings (ported from GameSettingsForm.jsx) ---

export const MIN_TURN_DURATION = 10;
export const MAX_TURN_DURATION = 120;
export const MIN_POINTS_TO_WIN = 5;
export const MAX_POINTS_TO_WIN = 500;
export const POINTS_STEP = 5;
export const DEFAULT_POINTS_TO_WIN = 100;
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 30;
export const WORD_LENGTH_FLOOR = 2;
export const WORD_LENGTH_CEILING = 18;

export interface HangmanFullSettings extends HangmanSettings {
  noTimeLimit: boolean;
  minWordLength: number;
  maxWordLength: number;
}

export const DEFAULT_SETTINGS: HangmanFullSettings = {
  turnDuration: 30,
  noTimeLimit: false,
  gameMode: 'points',
  pointsToWin: DEFAULT_POINTS_TO_WIN,
  roundsToPlay: 6,
  minWordLength: 3,
  maxWordLength: 10,
};

/** The word pattern accepted by SELECT_WORD's UI: letters, plus single
 * spaces/hyphens between letter groups — never at the start, end, or doubled. */
export const WORD_PATTERN = /^[a-zA-Z]+([ -][a-zA-Z]+)*$/;

export function validateWord(value: string, minLength: number, maxLength: number): string | null {
  if (value.length === 0) return null;
  if (!WORD_PATTERN.test(value)) {
    return 'Letters only — spaces or hyphens allowed, but not at the start, end, or doubled up.';
  }
  const letterCount = value.replace(/[ -]/g, '').length;
  if (letterCount < minLength) return `At least ${minLength} letters.`;
  if (letterCount > maxLength) return `${maxLength} letters max.`;
  return null;
}

/** Resolves noTimeLimit into the null-or-seconds shape initState expects. */
export function toEngineSettings(settings: HangmanFullSettings): HangmanSettings {
  return {
    turnDuration: settings.noTimeLimit ? null : settings.turnDuration,
    gameMode: settings.gameMode,
    pointsToWin: settings.pointsToWin,
    roundsToPlay: settings.roundsToPlay,
  };
}
