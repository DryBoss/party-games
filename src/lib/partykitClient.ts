import { useCallback, useRef, useState } from 'react';
import PartySocket from 'partysocket';
import type { Player } from '../types/player';

export type OnlineConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'error';

export type OnlineErrorReason = 'room-not-found' | 'connection-failed';

/**
 * In dev this points at your local `npx partykit dev` server. In production,
 * set VITE_PARTYKIT_HOST to your deployed project, e.g. party-hub.yourname.partykit.dev
 */
const PARTYKIT_HOST =
  (import.meta.env.VITE_PARTYKIT_HOST as string | undefined) ??
  '127.0.0.1:1999';

const CONNECT_TIMEOUT_MS = 8000;

interface ServerMessage {
  type: 'connected' | 'players' | 'error' | string;
  players?: Player[];
  hostId?: string | null;
  reason?: OnlineErrorReason;
  roomCode?: string;
  [key: string]: unknown;
}

export function useOnlineRoom() {
  const [state, setState] = useState<OnlineConnectionState>('idle');
  const [players, setPlayers] = useState<Player[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [error, setError] = useState<OnlineErrorReason | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const socketRef = useRef<PartySocket | null>(null);
  const eventListenersRef = useRef<Set<(data: unknown) => void>>(new Set());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearConnectTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const connect = useCallback(
    (code: string, name: string, intent: 'create' | 'join') => {
      socketRef.current?.close();
      clearConnectTimeout();
      setState('connecting');
      setError(null);

      const normalizedCode = code.trim().toLowerCase();
      const socket = new PartySocket({
        host: PARTYKIT_HOST,
        room: normalizedCode,
      });
      socketRef.current = socket;
      setRoomCode(normalizedCode);
      setMyId(socket.id);

      // If the server never responds (host unreachable, not running, wrong
      // VITE_PARTYKIT_HOST, etc.) the underlying socket retries silently —
      // without this, the UI would spin on "Connecting…" forever.
      timeoutRef.current = setTimeout(() => {
        if (socketRef.current === socket) {
          setError('connection-failed');
          setState('error');
          socket.close();
        }
      }, CONNECT_TIMEOUT_MS);

      socket.addEventListener('open', () => {
        setMyId(socket.id);
        socket.send(JSON.stringify({ type: 'join', name, intent }));
      });

      socket.addEventListener('message', (evt: MessageEvent) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(evt.data as string);
        } catch {
          return;
        }

        if (msg.type === 'players' && msg.players) {
          clearConnectTimeout();
          setPlayers(msg.players);
          setHostId(msg.hostId ?? null);
          setState('connected');
        } else if (msg.type === 'error') {
          clearConnectTimeout();
          setError(msg.reason ?? 'connection-failed');
          setState('error');
          socket.close();
        } else if (msg.type !== 'connected') {
          eventListenersRef.current.forEach((listener) => listener(msg));
        }
      });

      socket.addEventListener('error', () => {
        clearConnectTimeout();
        setError('connection-failed');
        setState('error');
      });
    },
    [],
  );

  const disconnect = useCallback(() => {
    clearConnectTimeout();
    if (socketRef.current) {
      try {
        socketRef.current.send(JSON.stringify({ type: 'leave' }));
      } catch {
        // socket may already be closed — fine, onClose handles cleanup server-side
      }
      socketRef.current.close();
    }
    socketRef.current = null;
    setState('idle');
    setPlayers([]);
    setHostId(null);
    setMyId(null);
    setRoomCode(null);
    setError(null);
  }, []);

  const sendEvent = useCallback((data: unknown) => {
    socketRef.current?.send(JSON.stringify(data));
  }, []);

  const onEvent = useCallback((listener: (data: unknown) => void) => {
    eventListenersRef.current.add(listener);
    return () => eventListenersRef.current.delete(listener);
  }, []);

  const isHost = myId !== null && myId === hostId;

  return { state, players, hostId, myId, isHost, error, roomCode, connect, disconnect, sendEvent, onEvent };
}
