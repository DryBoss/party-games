import { useState } from 'react';
import { Plus, X, Users } from 'lucide-react';
import BackButton from '../components/BackButton';
import { usePlayers } from '../state/PlayersContext';

interface PlayersScreenProps {
  onBack: () => void;
  onDone: () => void;
}

export default function PlayersScreen({ onBack, onDone }: PlayersScreenProps) {
  const { players, addPlayer, removePlayer } = usePlayers();
  const [name, setName] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length === 0) return;
    addPlayer(name);
    setName('');
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-cream px-6 py-16">
      <div className="w-full max-w-md">
        <BackButton label="Back" onClick={onBack} />

        <div className="mt-6 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center border-[3px] border-ink bg-lime">
            <Users className="h-5 w-5 text-ink" strokeWidth={2.25} />
          </span>
          <h1 className="font-display text-3xl font-bold text-ink">Players</h1>
        </div>
        <p className="mt-3 text-ink/70">
          Add everyone who's playing on this device.
        </p>

        <form onSubmit={handleAdd} className="mt-8 flex gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player name"
            maxLength={24}
            className="
              flex-1 border-[3px] border-ink bg-paper px-4 py-3 text-ink
              placeholder:text-ink/30 shadow-[4px_4px_0_0_var(--color-ink)]
              focus:outline-none focus-visible:outline focus-visible:outline-3
              focus-visible:outline-offset-2 focus-visible:outline-coral
            "
          />
          <button
            type="submit"
            disabled={name.trim().length === 0}
            className="
              inline-flex items-center justify-center border-[3px] border-ink
              bg-coral px-4 shadow-[4px_4px_0_0_var(--color-ink)]
              transition-transform duration-150 hover:-translate-y-0.5
              hover:shadow-[6px_6px_0_0_var(--color-ink)]
              active:translate-y-0 active:shadow-[2px_2px_0_0_var(--color-ink)]
              disabled:cursor-not-allowed disabled:opacity-40
            "
          >
            <Plus className="h-5 w-5 text-ink" strokeWidth={2.5} />
          </button>
        </form>

        <ul className="mt-8 flex flex-col gap-3">
          {players.length === 0 && (
            <li className="border-[3px] border-dashed border-ink/30 p-5 text-center text-sm text-ink/50">
              No players yet — add at least one to start.
            </li>
          )}
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between border-[3px] border-ink bg-paper px-4 py-3 shadow-[4px_4px_0_0_var(--color-ink)]"
            >
              <span className="font-medium text-ink">{player.name}</span>
              <button
                type="button"
                onClick={() => removePlayer(player.id)}
                aria-label={`Remove ${player.name}`}
                className="text-ink/40 transition-colors hover:text-coral"
              >
                <X className="h-5 w-5" strokeWidth={2.25} />
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onDone}
          disabled={players.length === 0}
          className="
            mt-10 w-full border-[3px] border-ink bg-lime py-4 text-center
            font-display text-xl font-semibold text-ink
            shadow-[6px_6px_0_0_var(--color-ink)] transition-transform duration-150
            hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]
            active:translate-y-0 active:shadow-[3px_3px_0_0_var(--color-ink)]
            disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0
            disabled:hover:shadow-[6px_6px_0_0_var(--color-ink)]
          "
        >
          Done
        </button>
      </div>
    </div>
  );
}
