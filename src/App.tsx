import { useCallback, useEffect, useState } from 'react';
import ModeSelectScreen from './screens/ModeSelectScreen';
import PlayersScreen from './screens/PlayersScreen';
import HotspotLobbyScreen from './screens/HotspotLobbyScreen';
import OnlineLobbyScreen from './screens/OnlineLobbyScreen';
import GameSelectScreen from './screens/GameSelectScreen';
import SplitOrStealSetupScreen from './screens/SplitOrStealSetupScreen';
import SplitOrStealLocalPlay from './screens/SplitOrStealLocalPlay';
import SplitOrStealMultiplayer from './screens/SplitOrStealMultiplayer';
import { PlayersProvider, usePlayers } from './state/PlayersContext';
import { useOnlineRoom } from './lib/partykitClient';
import { useHotspotHost, useHotspotGuest } from './lib/hotspotTransport';
import { getOnlineSession, clearOnlineSession } from './lib/session';
import { applyGameEvent, generateSchedule } from './games/splitOrSteal';
import type { SplitOrStealEvent, SplitOrStealState } from './games/splitOrSteal';
import type { RoomMode } from './types/room';

type AppScreen =
  | 'mode-select'
  | 'players'
  | 'hotspot-lobby'
  | 'online-lobby'
  | 'game-select'
  | 'split-or-steal-setup'
  | 'split-or-steal-play';

function AppShell() {
  const [screen, setScreen] = useState<AppScreen>('mode-select');
  const [mode, setMode] = useState<RoomMode | null>(null);
  const { players: devicePlayers } = usePlayers();

  // These live here (not inside the lobby screens) so the connection
  // survives navigating to game select — only a full page reload or an
  // explicit "leave room" tears it down.
  const onlineRoom = useOnlineRoom();
  const hotspotHost = useHotspotHost();
  const hotspotGuest = useHotspotGuest();

  const isHotspotHosting = hotspotHost.players.length > 0;

  // On load, try to resume an online room from before a refresh. Hotspot
  // can't do this — it's a direct WebRTC link between two tabs, so a reload
  // always requires a fresh invite/answer code exchange.
  const [reconnecting, setReconnecting] = useState(false);
  useEffect(() => {
    const session = getOnlineSession();
    if (session) {
      setMode('online');
      setScreen('online-lobby');
      setReconnecting(true);
      onlineRoom.connect(session.roomCode, session.name, 'join');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roomPlayers =
    mode === 'online'
      ? onlineRoom.players
      : isHotspotHosting
        ? hotspotHost.players
        : hotspotGuest.players;

  // Single device has no real "host" concept, so it's never restricted.
  // Hotspot: whoever created the room is host. Online: server-assigned,
  // with automatic migration if that player disconnects.
  const isHost =
    mode === 'single_device'
      ? true
      : mode === 'hotspot'
        ? isHotspotHosting
        : onlineRoom.isHost;

  const myId =
    mode === 'hotspot'
      ? isHotspotHosting
        ? hotspotHost.myId
        : hotspotGuest.myId
      : mode === 'online'
        ? onlineRoom.myId
        : null;

  // --- Generic game-message transport: one call site, regardless of mode. ---
  // Host messages always broadcast to everyone; a non-host's messages are
  // only ever delivered privately to the host (enforced by the hotspot star
  // topology, and by the PartyKit server for online) — that's what makes it
  // safe for a game to use this channel for secret info like a hidden choice.
  const { broadcast: hotspotBroadcast, onEvent: hotspotHostOnEvent } = hotspotHost;
  const { sendEvent: hotspotGuestSend, onEvent: hotspotGuestOnEvent } = hotspotGuest;
  const { sendEvent: onlineSend, onEvent: onlineOnEvent } = onlineRoom;

  const sendGameMessage = useCallback(
    (msg: unknown) => {
      if (mode === 'hotspot') {
        if (isHotspotHosting) hotspotBroadcast(msg);
        else hotspotGuestSend(msg);
      } else if (mode === 'online') {
        onlineSend(msg);
      }
    },
    [mode, isHotspotHosting, hotspotBroadcast, hotspotGuestSend, onlineSend],
  );

  const onGameMessage = useCallback(
    (listener: (data: unknown) => void) => {
      if (mode === 'hotspot') {
        return isHotspotHosting ? hotspotHostOnEvent(listener) : hotspotGuestOnEvent(listener);
      }
      if (mode === 'online') {
        return onlineOnEvent(listener);
      }
      return () => {};
    },
    [mode, isHotspotHosting, hotspotHostOnEvent, hotspotGuestOnEvent, onlineOnEvent],
  );

  // --- Split or Steal state (multiplayer only — single device manages its
  // own state locally, no networking involved). ---
  const [activeGame, setActiveGame] = useState<SplitOrStealState | null>(null);
  const [lastRounds, setLastRounds] = useState(1);

  const dispatchAsHost = useCallback(
    (event: SplitOrStealEvent) => {
      setActiveGame((prev) => applyGameEvent(prev, event));
      sendGameMessage(event);
    },
    [sendGameMessage],
  );

  // Guests (and host, harmlessly — it never receives its own broadcasts):
  // apply incoming game-state events so `activeGame` always reflects what
  // the host last broadcast, and jump to the game screen when one starts.
  useEffect(() => {
    if (mode !== 'hotspot' && mode !== 'online') return;
    return onGameMessage((data) => {
      const msg = data as { type?: string };
      if (
        msg.type === 'game-start' ||
        msg.type === 'match-advance' ||
        msg.type === 'reveal' ||
        msg.type === 'game-end'
      ) {
        setActiveGame((prev) => applyGameEvent(prev, data as SplitOrStealEvent));
        if (msg.type === 'game-start') setScreen('split-or-steal-play');
      }
    });
  }, [mode, onGameMessage]);

  const handleModeSelect = (selected: RoomMode) => {
    setMode(selected);
    if (selected === 'single_device') {
      setScreen('players');
    } else if (selected === 'hotspot') {
      setScreen('hotspot-lobby');
    } else {
      setScreen('online-lobby');
    }
  };

  const handleBackToModeSelect = () => {
    // Fully leave whatever room was active before heading back.
    onlineRoom.disconnect();
    clearOnlineSession();
    hotspotHost.reset();
    hotspotGuest.reset();
    setReconnecting(false);
    setActiveGame(null);
    setMode(null);
    setScreen('mode-select');
  };

  const handleExitGame = () => {
    setActiveGame(null);
    setScreen('game-select');
  };

  const handleSelectGame = (gameId: string) => {
    if (gameId === 'split-or-steal') {
      setScreen('split-or-steal-setup');
      return;
    }
    // Other games aren't built yet — this is the plumbing a real game
    // screen will hook into next.
    console.log('Selected game:', gameId, 'in mode:', mode);
    if (mode === 'hotspot' && isHotspotHosting) {
      hotspotHost.broadcast({ type: 'select-game', gameId });
    } else if (mode === 'online') {
      onlineRoom.sendEvent({ type: 'select-game', gameId });
    }
  };

  const handleStartSplitOrSteal = (rounds: number) => {
    setLastRounds(rounds);
    if (mode === 'single_device') {
      setScreen('split-or-steal-play');
      return;
    }
    const schedule = generateSchedule(roomPlayers, rounds);
    dispatchAsHost({ type: 'game-start', schedule });
    setScreen('split-or-steal-play');
  };

  const handlePlayAgainMultiplayer = () => {
    const schedule = generateSchedule(roomPlayers, lastRounds);
    dispatchAsHost({ type: 'game-start', schedule });
  };

  switch (screen) {
    case 'players':
      return (
        <PlayersScreen
          onBack={handleBackToModeSelect}
          onDone={() => setScreen('game-select')}
        />
      );
    case 'hotspot-lobby':
      return (
        <HotspotLobbyScreen
          host={hotspotHost}
          guest={hotspotGuest}
          onBack={handleBackToModeSelect}
          onReady={() => setScreen('game-select')}
        />
      );
    case 'online-lobby':
      return (
        <OnlineLobbyScreen
          room={onlineRoom}
          startInRoomView={
            reconnecting ||
            onlineRoom.state === 'connected' ||
            onlineRoom.state === 'connecting'
          }
          onBack={handleBackToModeSelect}
          onReady={() => setScreen('game-select')}
        />
      );
    case 'split-or-steal-setup':
      return (
        <SplitOrStealSetupScreen
          players={mode === 'single_device' ? devicePlayers : roomPlayers}
          onBack={() => setScreen('game-select')}
          onStart={handleStartSplitOrSteal}
        />
      );
    case 'split-or-steal-play':
      if (mode === 'single_device') {
        return (
          <SplitOrStealLocalPlay
            players={devicePlayers}
            rounds={lastRounds}
            onExit={handleExitGame}
          />
        );
      }
      if (!activeGame) {
        return (
          <div className="flex min-h-screen items-center justify-center bg-cream">
            <p className="text-ink/50">Loading game…</p>
          </div>
        );
      }
      return (
        <SplitOrStealMultiplayer
          players={roomPlayers}
          isHost={isHost}
          myId={myId}
          activeGame={activeGame}
          dispatchAsHost={dispatchAsHost}
          sendGameMessage={sendGameMessage}
          onGameMessage={onGameMessage}
          onPlayAgain={handlePlayAgainMultiplayer}
          onExit={handleExitGame}
        />
      );
    case 'game-select':
      return (
        <GameSelectScreen
          mode={mode ?? 'single_device'}
          players={mode === 'single_device' ? devicePlayers : roomPlayers}
          isHost={isHost}
          hostLeft={
            mode === 'hotspot' &&
            !isHotspotHosting &&
            hotspotGuest.state === 'disconnected'
          }
          onBack={handleBackToModeSelect}
          onSelectGame={handleSelectGame}
          onManagePlayers={
            mode === 'single_device' ? () => setScreen('players') : undefined
          }
          onInvite={
            mode === 'hotspot'
              ? () => setScreen('hotspot-lobby')
              : mode === 'online'
                ? () => setScreen('online-lobby')
                : undefined
          }
        />
      );
    case 'mode-select':
    default:
      return <ModeSelectScreen onSelect={handleModeSelect} />;
  }
}

export default function App() {
  return (
    <PlayersProvider>
      <AppShell />
    </PlayersProvider>
  );
}
