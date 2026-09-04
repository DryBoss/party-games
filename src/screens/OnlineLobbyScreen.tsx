import { useEffect, useState } from 'react';
import { Plus, LogIn, Users } from 'lucide-react';
import BackButton from '../components/BackButton';
import type { useOnlineRoom } from '../lib/partykitClient';
import { getStoredName, setStoredName, setOnlineSession, clearOnlineSession } from '../lib/session';
import type { Player } from '../types/player';

interface OnlineLobbyScreenProps {
  room: ReturnType<typeof useOnlineRoom>;
  startInRoomView?: boolean;
  onBack: () => void;
  onReady: (players: Player[]) => void;
}

type View = 'choose' | 'create' | 'join' | 'room';

function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export default function OnlineLobbyScreen({
  room,
  startInRoomView,
  onBack,
  onReady,
}: OnlineLobbyScreenProps) {
  const [view, setView] = useState<View>(startInRoomView ? 'room' : 'choose');
  const [name, setName] = useState(getStoredName);
  const [codeInput, setCodeInput] = useState('');

  // Keep the session fresh for refresh-recovery, and drop it if the
  // reconnect attempt ends in an error (e.g. the room no longer exists).
  useEffect(() => {
    if (room.state === 'connected' && room.roomCode) {
      setOnlineSession({ roomCode: room.roomCode, name: name || getStoredName() });
    } else if (room.state === 'error') {
      clearOnlineSession();
    }
  }, [room.state, room.roomCode, name]);

  const handleCreate = () => {
    setStoredName(name);
    const code = makeRoomCode();
    room.connect(code, name || 'Host', 'create');
    setView('room');
  };

  const handleJoin = () => {
    setStoredName(name);
    room.connect(codeInput, name || 'Player', 'join');
    setView('room');
  };

  if (view === 'choose' || view === 'create' || view === 'join') {
    return (
      <div className="flex min-h-screen flex-col items-center bg-cream px-6 py-16">
        <div className="w-full max-w-md">
          <BackButton label="Change room type" onClick={onBack} />
          <p className="mt-6 font-display text-lg font-semibold text-coral">Online</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-[1.05] text-ink">
            Create or join?
          </h1>
          <p className="mt-4 text-lg text-ink/70">Play with friends anywhere — no shared WiFi needed.</p>

          <div className="mt-8">
            <label className="mb-2 block text-sm font-medium text-ink/70">Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={24}
              className="w-full border-[3px] border-ink bg-paper px-4 py-3 text-ink placeholder:text-ink/30 shadow-[4px_4px_0_0_var(--color-ink)] focus:outline-none"
            />
          </div>

          {view === 'join' ? (
            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-ink/70">Room code</label>
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                maxLength={6}
                className="w-full border-[3px] border-ink bg-paper px-5 py-4 text-center font-display text-2xl font-semibold tracking-[0.3em] text-ink placeholder:text-ink/30 shadow-[6px_6px_0_0_var(--color-ink)] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleJoin}
                disabled={name.trim().length === 0 || codeInput.trim().length === 0}
                className="mt-4 w-full border-[3px] border-ink bg-coral py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Join
              </button>
              <button
                type="button"
                onClick={() => setView('choose')}
                className="mt-3 text-sm font-medium text-ink/60 underline underline-offset-2"
              >
                Back
              </button>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-5">
              <button
                type="button"
                disabled={name.trim().length === 0}
                onClick={handleCreate}
                className="flex items-center gap-4 border-[3px] border-ink bg-lime p-5 text-left shadow-[6px_6px_0_0_var(--color-ink)] transition-transform duration-150 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center border-[3px] border-ink bg-paper">
                  <Plus className="h-5 w-5 text-ink" strokeWidth={2.5} />
                </span>
                <span>
                  <span className="block font-display text-xl font-semibold text-ink">Create room</span>
                  <span className="block text-sm text-ink/70">Get a code to share with friends.</span>
                </span>
              </button>
              <button
                type="button"
                disabled={name.trim().length === 0}
                onClick={() => setView('join')}
                className="flex items-center gap-4 border-[3px] border-ink bg-paper p-5 text-left shadow-[6px_6px_0_0_var(--color-ink)] transition-transform duration-150 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center border-[3px] border-ink bg-coral">
                  <LogIn className="h-5 w-5 text-ink" strokeWidth={2.5} />
                </span>
                <span>
                  <span className="block font-display text-xl font-semibold text-ink">Join room</span>
                  <span className="block text-sm text-ink/70">Enter a friend's room code.</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // view === 'room'
  return (
    <div className="flex min-h-screen flex-col items-center bg-cream px-6 py-16">
      <div className="w-full max-w-md">
        <BackButton label="Change room type" onClick={onBack} />

        {room.state === 'connecting' && (
          <p className="mt-10 text-lg text-ink/70">Connecting…</p>
        )}

        {room.state === 'error' && (
          <div className="mt-10">
            <p className="font-display text-2xl font-bold text-ink">
              {room.error === 'room-not-found' ? 'Room not found' : 'Connection failed'}
            </p>
            <p className="mt-2 text-ink/70">
              {room.error === 'room-not-found'
                ? "That room code doesn't exist. Double-check it with the host."
                : "Couldn't reach the game server. Check your connection and try again."}
            </p>
            <button
              type="button"
              onClick={() => setView('choose')}
              className="mt-6 border-[3px] border-ink bg-paper px-5 py-3 font-medium text-ink shadow-[4px_4px_0_0_var(--color-ink)]"
            >
              Try again
            </button>
          </div>
        )}

        {room.state === 'connected' && (
          <>
            <p className="mt-6 font-display text-lg font-semibold text-coral">Room code</p>
            <p className="font-display text-5xl font-bold tracking-[0.2em] text-ink">
              {room.roomCode?.toUpperCase()}
            </p>
            <p className="mt-2 text-sm text-ink/60">Share this code so others can join.</p>

            <div className="mt-8 flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm font-medium text-ink/60">
                <Users className="h-4 w-4" /> {room.players.length} player
                {room.players.length === 1 ? '' : 's'}
              </p>
              <ul className="flex flex-wrap gap-2">
                {room.players.map((p) => (
                  <li
                    key={p.id}
                    className="border-[2px] border-ink bg-paper px-3 py-1 text-sm font-medium text-ink"
                  >
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => onReady(room.players)}
              className="mt-10 w-full border-[3px] border-ink bg-lime py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
            >
              Continue to games
            </button>
          </>
        )}
      </div>
    </div>
  );
}
