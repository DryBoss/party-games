import { Users, UserPlus, Hourglass, WifiOff } from 'lucide-react';
import GameCard from '../components/GameCard';
import BackButton from '../components/BackButton';
import { GAMES } from '../data/games';
import type { RoomMode } from '../types/room';
import type { Player } from '../types/player';

interface GameSelectScreenProps {
  mode: RoomMode;
  players: Player[];
  /** Single-device has no real "host" — treat it as always allowed. */
  isHost: boolean;
  /** Hotspot only — the host's connection dropped and can't be recovered. */
  hostLeft?: boolean;
  onBack: () => void;
  onSelectGame: (gameId: string) => void;
  onManagePlayers?: () => void;
  /** Only meaningful for hotspot/online — lets the host invite more devices. */
  onInvite?: () => void;
}

const modeLabel: Record<RoomMode, string> = {
  single_device: 'This device',
  hotspot: 'Local hotspot',
  online: 'Online',
};

function PlayerBadges({ players }: { players: Player[] }) {
  if (players.length === 0) return null;
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {players.map((p) => (
        <li
          key={p.id}
          className="border-[2px] border-ink bg-paper px-3 py-1 text-sm font-medium text-ink"
        >
          {p.name}
        </li>
      ))}
    </ul>
  );
}

export default function GameSelectScreen({
  mode,
  players,
  isHost,
  hostLeft,
  onBack,
  onSelectGame,
  onManagePlayers,
  onInvite,
}: GameSelectScreenProps) {
  const showRoomControls = !onManagePlayers; // hotspot/online, not single-device

  if (!isHost) {
    return (
      <div
        key={hostLeft ? 'host-left' : 'waiting'}
        className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 animate-enter"
      >
        <div className="w-full max-w-md text-center">
          <BackButton label="Leave room" onClick={onBack} />
          <span
            className={`mx-auto mt-8 inline-flex h-14 w-14 items-center justify-center border-[3px] border-ink shadow-[6px_6px_0_0_var(--color-ink)] animate-pop ${hostLeft ? 'bg-coral' : 'bg-lime'}`}
          >
            {hostLeft ? (
              <WifiOff className="h-7 w-7 text-ink" strokeWidth={2.25} />
            ) : (
              <Hourglass className="h-7 w-7 text-ink animate-pulse-soft" strokeWidth={2.25} />
            )}
          </span>
          <h1 className="mt-6 font-display text-3xl font-bold leading-tight text-ink">
            {hostLeft ? 'Host disconnected' : 'Waiting for the host to pick a game'}
          </h1>
          <p className="mt-3 text-ink/70">
            {hostLeft
              ? "The host's connection dropped, so this room is no longer reachable. Ask them to create a new room, or go back and start your own."
              : "You're in — the host controls what's next. Hang tight."}
          </p>
          {!hostLeft && (
            <div className="mt-8">
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-ink/60">
                <Users className="h-4 w-4" /> {players.length} player
                {players.length === 1 ? '' : 's'}
              </p>
              <PlayerBadges players={players} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-cream px-6 py-16 animate-enter">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <BackButton label="Change room type" onClick={onBack} />
          <div className="flex items-center gap-2">
            {showRoomControls && onInvite && (
              <button
                type="button"
                onClick={onInvite}
                className="inline-flex items-center gap-2 border-[3px] border-ink bg-lime px-3 py-1.5 text-sm font-medium text-ink shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
              >
                <UserPlus className="h-4 w-4" />
                Invite
              </button>
            )}
            {onManagePlayers && (
              <button
                type="button"
                onClick={onManagePlayers}
                className="inline-flex items-center gap-2 border-[3px] border-ink bg-paper px-3 py-1.5 text-sm font-medium text-ink shadow-[3px_3px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
              >
                <Users className="h-4 w-4" />
                {players.length} player{players.length === 1 ? '' : 's'}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 font-display text-lg font-semibold text-coral">
          {modeLabel[mode]}
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-[1.05] text-ink sm:text-5xl">
          Pick a game
        </h1>
        <p className="mt-4 max-w-md text-lg text-ink/70">
          Every game works in this room. Jump in, and switch games later
          without leaving.
        </p>

        {showRoomControls && <PlayerBadges players={players} />}

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {GAMES.map((game, i) => (
            <div key={game.id} className="animate-stagger" style={{ '--stagger-index': i } as React.CSSProperties}>
              <GameCard game={game} onSelect={() => onSelectGame(game.id)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
