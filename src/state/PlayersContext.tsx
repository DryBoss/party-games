import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Player } from '../types/player';

interface PlayersContextValue {
  players: Player[];
  addPlayer: (name: string) => void;
  removePlayer: (id: string) => void;
}

const PlayersContext = createContext<PlayersContextValue | null>(null);

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function PlayersProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);

  const addPlayer = useCallback((name: string) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    setPlayers((prev) => [...prev, { id: makeId(), name: trimmed }]);
  }, []);

  const removePlayer = useCallback((id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const value = useMemo(
    () => ({ players, addPlayer, removePlayer }),
    [players, addPlayer, removePlayer],
  );

  return (
    <PlayersContext.Provider value={value}>{children}</PlayersContext.Provider>
  );
}

export function usePlayers() {
  const ctx = useContext(PlayersContext);
  if (!ctx) throw new Error('usePlayers must be used within a PlayersProvider');
  return ctx;
}
