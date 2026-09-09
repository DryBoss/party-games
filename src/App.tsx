import { useCallback, useEffect, useRef, useState } from 'react';
import ModeSelectScreen from './screens/ModeSelectScreen';
import PlayersScreen from './screens/PlayersScreen';
import HotspotLobbyScreen from './screens/HotspotLobbyScreen';
import OnlineLobbyScreen from './screens/OnlineLobbyScreen';
import GameSelectScreen from './screens/GameSelectScreen';
import SplitOrStealSetupScreen from './screens/SplitOrStealSetupScreen';
import SplitOrStealLocalPlay from './screens/SplitOrStealLocalPlay';
import SplitOrStealMultiplayer from './screens/SplitOrStealMultiplayer';
import HangmanSetupScreen from './screens/HangmanSetupScreen';
import HangmanLocalPlay from './screens/HangmanLocalPlay';
import HangmanMultiplayer from './screens/HangmanMultiplayer';
import WerewolfSetupScreen from './screens/WerewolfSetupScreen';
import WerewolfLocalPlay from './screens/WerewolfLocalPlay';
import WerewolfMultiplayer from './screens/WerewolfMultiplayer';
import { PlayersProvider, usePlayers } from './state/PlayersContext';
import { useOnlineRoom } from './lib/partykitClient';
import { useHotspotHost, useHotspotGuest } from './lib/hotspotTransport';
import { getOnlineSession, clearOnlineSession } from './lib/session';
import { applyGameEvent, generateSchedule } from './games/splitOrSteal';
import type { SplitOrStealEvent, SplitOrStealState } from './games/splitOrSteal';
import {
  initState as initHangman,
  reduce as reduceHangman,
  maskForBroadcast,
  toEngineSettings,
  AUTO_ADVANCE_ACTION_FOR_PHASE,
  DEFAULT_SETTINGS as HANGMAN_DEFAULT_SETTINGS,
} from './games/hangman';
import type { HangmanAction, HangmanFullSettings, HangmanState } from './games/hangman';
import {
  initState as initWerewolf,
  reduce as reduceWerewolf,
  toPublicState as toPublicWerewolf,
} from './games/werewolf';
import type { Role, WerewolfAction, WerewolfConfig, WerewolfPublicState } from './games/werewolf';
import type { RoomMode } from './types/room';

type AppScreen =
  | 'mode-select'
  | 'players'
  | 'hotspot-lobby'
  | 'online-lobby'
  | 'game-select'
  | 'split-or-steal-setup'
  | 'split-or-steal-play'
  | 'hangman-setup'
  | 'hangman-play'
  | 'werewolf-setup'
  | 'werewolf-play';

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
  const { broadcast: hotspotBroadcast, sendTo: hotspotSendTo, onEvent: hotspotHostOnEvent } = hotspotHost;
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

  // Host-only: whisper to exactly one other player — needed for secrets
  // that shouldn't broadcast to everyone (a Werewolf player's own role, a
  // Seer's inspection result).
  const sendToPlayer = useCallback(
    (playerId: string, msg: unknown) => {
      if (mode === 'hotspot') {
        hotspotSendTo(playerId, msg);
      } else if (mode === 'online') {
        onlineSend({ type: 'whisper-to', targetId: playerId, payload: msg });
      }
    },
    [mode, hotspotSendTo, onlineSend],
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

  // --- Hangman Friends state (multiplayer only). The host keeps the one
  // true (unmasked) state in a ref; `activeHangman` is always the masked
  // view, rendered by host and guests alike — mirrors the original repo's
  // useLanHost/useOnlineAdapter pattern exactly. ---
  const hangmanTrueStateRef = useRef<HangmanState | null>(null);
  const [activeHangman, setActiveHangman] = useState<HangmanState | null>(null);
  const [hangmanSeatIds, setHangmanSeatIds] = useState<string[] | null>(null);
  const [hangmanSettings, setHangmanSettings] = useState<HangmanFullSettings | null>(null);

  const applyHangmanAction = useCallback(
    (action: HangmanAction, seatIndex: number | null) => {
      const trueState = hangmanTrueStateRef.current;
      const seatCount = hangmanSeatIds?.length ?? 0;
      if (!trueState || !seatCount) return;
      const { state: next, error } = reduceHangman(trueState, action, { seatIndex, playerCount: seatCount });
      if (error) return;
      hangmanTrueStateRef.current = next;
      const masked = maskForBroadcast(next);
      setActiveHangman(masked);
      sendGameMessage({
        type: 'hangman:state',
        maskedState: masked,
        seatIds: hangmanSeatIds,
        minWordLength: hangmanSettings?.minWordLength ?? HANGMAN_DEFAULT_SETTINGS.minWordLength,
        maxWordLength: hangmanSettings?.maxWordLength ?? HANGMAN_DEFAULT_SETTINGS.maxWordLength,
      });
    },
    [hangmanSeatIds, hangmanSettings, sendGameMessage],
  );

  const dispatchHangman = useCallback(
    (action: HangmanAction) => {
      if (isHost) {
        const mySeat = hangmanSeatIds && myId ? hangmanSeatIds.indexOf(myId) : -1;
        applyHangmanAction(action, mySeat);
      } else {
        sendGameMessage({ type: 'hangman:action', action, playerId: myId });
      }
    },
    [isHost, hangmanSeatIds, myId, applyHangmanAction, sendGameMessage],
  );

  // Host: collect private action submissions from guests.
  useEffect(() => {
    if (!isHost || (mode !== 'hotspot' && mode !== 'online')) return;
    return onGameMessage((data) => {
      const msg = data as { type?: string; action?: HangmanAction; playerId?: string };
      if (msg.type !== 'hangman:action' || !msg.action || !msg.playerId || !hangmanSeatIds) return;
      const seatIndex = hangmanSeatIds.indexOf(msg.playerId);
      if (seatIndex === -1) return;
      applyHangmanAction(msg.action, seatIndex);
    });
  }, [isHost, mode, onGameMessage, hangmanSeatIds, applyHangmanAction]);

  // Host: turn-deadline watchdog — same idea as the original repo's
  // useLanHost, just scheduled locally instead of against a native socket
  // server. Keeps the game moving if someone goes AFK.
  useEffect(() => {
    if (!isHost || (mode !== 'hotspot' && mode !== 'online')) return;
    if (!activeHangman?.turnDeadline) return;
    const actionType = AUTO_ADVANCE_ACTION_FOR_PHASE[activeHangman.phase];
    if (!actionType) return;
    const msRemaining = activeHangman.turnDeadline - Date.now();
    const timer = setTimeout(
      () => applyHangmanAction({ type: actionType }, null),
      Math.max(0, msRemaining),
    );
    return () => clearTimeout(timer);
  }, [isHost, mode, activeHangman?.turnDeadline, activeHangman?.phase, applyHangmanAction]);

  // --- Werewolf state (multiplayer only). Unlike Split or Steal / Hangman,
  // secrecy here is per-player (your own role, your pack, a Seer's private
  // result) rather than one shared secret, so alongside the public
  // broadcast, applyWerewolfAction also fires off any private `notify`
  // messages the engine indicates. ---
  const werewolfTrueStateRef = useRef<ReturnType<typeof initWerewolf> | null>(null);
  const [activeWerewolf, setActiveWerewolf] = useState<WerewolfPublicState | null>(null);
  const [werewolfSeatIds, setWerewolfSeatIds] = useState<string[] | null>(null);
  const [werewolfConfig, setWerewolfConfig] = useState<WerewolfConfig | null>(null);
  const [myWerewolfRole, setMyWerewolfRole] = useState<{ role: Role; packmates: string[] } | null>(null);
  const [wolfTally, setWolfTally] = useState<Record<number, number>>({});
  const [seerLog, setSeerLog] = useState<{ targetSeat: number; isWerewolf: boolean }[]>([]);

  const applyLocalWerewolfNotify = useCallback((message: unknown) => {
    const msg = message as {
      type?: string;
      votes?: Record<number, number>;
      targetSeat?: number;
      isWerewolf?: boolean;
    };
    if (msg.type === 'werewolf:wolf-tally' && msg.votes) {
      setWolfTally(msg.votes);
    } else if (msg.type === 'werewolf:seer-result' && msg.targetSeat !== undefined && msg.isWerewolf !== undefined) {
      setSeerLog((prev) => [...prev, { targetSeat: msg.targetSeat as number, isWerewolf: msg.isWerewolf as boolean }]);
    }
  }, []);

  const applyWerewolfAction = useCallback(
    (action: WerewolfAction, seatIndex: number | null) => {
      const trueState = werewolfTrueStateRef.current;
      const seatIds = werewolfSeatIds;
      if (!trueState || !seatIds) return;
      const { state: next, error, notify } = reduceWerewolf(trueState, action, { seatIndex });
      if (error) return;
      werewolfTrueStateRef.current = next;
      const pub = toPublicWerewolf(next);
      setActiveWerewolf(pub);
      sendGameMessage({ type: 'werewolf:state', publicState: pub, seatIds });
      notify.forEach((n) => {
        const targetPlayerId = seatIds[n.seat];
        if (!targetPlayerId) return;
        if (targetPlayerId === myId) applyLocalWerewolfNotify(n.message);
        else sendToPlayer(targetPlayerId, n.message);
      });
    },
    [werewolfSeatIds, myId, sendGameMessage, sendToPlayer, applyLocalWerewolfNotify],
  );

  const dispatchWerewolf = useCallback(
    (action: WerewolfAction) => {
      if (isHost) {
        const mySeat = werewolfSeatIds && myId ? werewolfSeatIds.indexOf(myId) : -1;
        applyWerewolfAction(action, mySeat);
      } else {
        sendGameMessage({ type: 'werewolf:action', action, playerId: myId });
      }
    },
    [isHost, werewolfSeatIds, myId, applyWerewolfAction, sendGameMessage],
  );

  // Host: collect private action submissions from guests.
  useEffect(() => {
    if (!isHost || (mode !== 'hotspot' && mode !== 'online')) return;
    return onGameMessage((data) => {
      const msg = data as { type?: string; action?: WerewolfAction; playerId?: string };
      if (msg.type !== 'werewolf:action' || !msg.action || !msg.playerId || !werewolfSeatIds) return;
      const seatIndex = werewolfSeatIds.indexOf(msg.playerId);
      if (seatIndex === -1) return;
      applyWerewolfAction(msg.action, seatIndex);
    });
  }, [isHost, mode, onGameMessage, werewolfSeatIds, applyWerewolfAction]);

  // Guests (and host, harmlessly — it never receives its own broadcasts):
  // apply incoming game-state events so local state always reflects what
  // the host last broadcast, and jump to the right game screen when one starts.
  useEffect(() => {
    if (mode !== 'hotspot' && mode !== 'online') return;
    return onGameMessage((data) => {
      const msg = data as {
        type?: string;
        maskedState?: HangmanState;
        seatIds?: string[];
        minWordLength?: number;
        maxWordLength?: number;
        publicState?: WerewolfPublicState;
        role?: Role;
        packmates?: string[];
      };
      if (
        msg.type === 'game-start' ||
        msg.type === 'match-advance' ||
        msg.type === 'reveal' ||
        msg.type === 'game-end'
      ) {
        setActiveGame((prev) => applyGameEvent(prev, data as SplitOrStealEvent));
        if (msg.type === 'game-start') setScreen('split-or-steal-play');
      } else if (msg.type === 'hangman:state' && msg.maskedState && msg.seatIds) {
        setHangmanSeatIds(msg.seatIds);
        setActiveHangman(msg.maskedState);
        setHangmanSettings((prev) => ({
          ...(prev ?? HANGMAN_DEFAULT_SETTINGS),
          minWordLength: msg.minWordLength ?? HANGMAN_DEFAULT_SETTINGS.minWordLength,
          maxWordLength: msg.maxWordLength ?? HANGMAN_DEFAULT_SETTINGS.maxWordLength,
        }));
        setScreen('hangman-play');
      } else if (msg.type === 'werewolf:state' && msg.publicState && msg.seatIds) {
        setWerewolfSeatIds(msg.seatIds);
        setActiveWerewolf(msg.publicState);
        setScreen('werewolf-play');
      } else if (msg.type === 'werewolf:role' && msg.role) {
        setMyWerewolfRole({ role: msg.role, packmates: msg.packmates ?? [] });
      } else if (msg.type === 'werewolf:wolf-tally' || msg.type === 'werewolf:seer-result') {
        applyLocalWerewolfNotify(data);
      }
    });
  }, [mode, onGameMessage, applyLocalWerewolfNotify]);

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
    hangmanTrueStateRef.current = null;
    setActiveHangman(null);
    setHangmanSeatIds(null);
    setHangmanSettings(null);
    werewolfTrueStateRef.current = null;
    setActiveWerewolf(null);
    setWerewolfSeatIds(null);
    setWerewolfConfig(null);
    setMyWerewolfRole(null);
    setWolfTally({});
    setSeerLog([]);
    setMode(null);
    setScreen('mode-select');
  };

  const handleExitGame = () => {
    setActiveGame(null);
    hangmanTrueStateRef.current = null;
    setActiveHangman(null);
    setHangmanSeatIds(null);
    werewolfTrueStateRef.current = null;
    setActiveWerewolf(null);
    setWerewolfSeatIds(null);
    setMyWerewolfRole(null);
    setWolfTally({});
    setSeerLog([]);
    setScreen('game-select');
  };

  const handleSelectGame = (gameId: string) => {
    if (gameId === 'split-or-steal') {
      setScreen('split-or-steal-setup');
      return;
    }
    if (gameId === 'hangman-friends') {
      setScreen('hangman-setup');
      return;
    }
    if (gameId === 'werewolf') {
      setScreen('werewolf-setup');
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

  const handleStartHangman = (settings: HangmanFullSettings) => {
    setHangmanSettings(settings);
    if (mode === 'single_device') {
      setScreen('hangman-play');
      return;
    }
    const seatIds = roomPlayers.map((p) => p.id);
    const initial = initHangman(seatIds.length, toEngineSettings(settings));
    hangmanTrueStateRef.current = initial;
    setHangmanSeatIds(seatIds);
    const masked = maskForBroadcast(initial);
    setActiveHangman(masked);
    sendGameMessage({
      type: 'hangman:state',
      maskedState: masked,
      seatIds,
      minWordLength: settings.minWordLength,
      maxWordLength: settings.maxWordLength,
    });
    setScreen('hangman-play');
  };

  const handlePlayAgainHangman = () => {
    if (!hangmanSeatIds || !hangmanSettings) return;
    const initial = initHangman(hangmanSeatIds.length, toEngineSettings(hangmanSettings));
    hangmanTrueStateRef.current = initial;
    const masked = maskForBroadcast(initial);
    setActiveHangman(masked);
    sendGameMessage({
      type: 'hangman:state',
      maskedState: masked,
      seatIds: hangmanSeatIds,
      minWordLength: hangmanSettings.minWordLength,
      maxWordLength: hangmanSettings.maxWordLength,
    });
  };

  const startWerewolfGame = (seatIds: string[], config: WerewolfConfig) => {
    const initial = initWerewolf(seatIds.length, config);
    werewolfTrueStateRef.current = initial;
    setWerewolfSeatIds(seatIds);
    const pub = toPublicWerewolf(initial);
    setActiveWerewolf(pub);
    sendGameMessage({ type: 'werewolf:state', publicState: pub, seatIds });

    const nameOf = (seat: number) => roomPlayers.find((p) => p.id === seatIds[seat])?.name ?? '???';
    seatIds.forEach((playerId, seat) => {
      const role = initial.roles[seat];
      const packmates =
        role === 'werewolf'
          ? initial.roles
              .map((r, i) => (r === 'werewolf' && i !== seat ? nameOf(i) : null))
              .filter((n): n is string => !!n)
          : [];
      if (playerId === myId) {
        setMyWerewolfRole({ role, packmates });
      } else {
        sendToPlayer(playerId, { type: 'werewolf:role', role, packmates });
      }
    });
  };

  const handleStartWerewolf = (config: WerewolfConfig) => {
    setWerewolfConfig(config);
    setWolfTally({});
    setSeerLog([]);
    if (mode === 'single_device') {
      setScreen('werewolf-play');
      return;
    }
    startWerewolfGame(
      roomPlayers.map((p) => p.id),
      config,
    );
    setScreen('werewolf-play');
  };

  const handlePlayAgainWerewolf = () => {
    if (!werewolfSeatIds || !werewolfConfig) return;
    setWolfTally({});
    setSeerLog([]);
    startWerewolfGame(werewolfSeatIds, werewolfConfig);
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
          <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream">
            <span className="inline-block h-5 w-5 animate-spin-slow rounded-full border-2 border-ink border-t-transparent" />
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
    case 'hangman-setup':
      return (
        <HangmanSetupScreen
          players={mode === 'single_device' ? devicePlayers : roomPlayers}
          onBack={() => setScreen('game-select')}
          onStart={handleStartHangman}
        />
      );
    case 'hangman-play':
      if (mode === 'single_device') {
        return (
          <HangmanLocalPlay
            players={devicePlayers}
            settings={hangmanSettings ?? HANGMAN_DEFAULT_SETTINGS}
            onExit={handleExitGame}
          />
        );
      }
      if (!activeHangman || !hangmanSeatIds) {
        return (
          <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream">
            <span className="inline-block h-5 w-5 animate-spin-slow rounded-full border-2 border-ink border-t-transparent" />
            <p className="text-ink/50">Loading game…</p>
          </div>
        );
      }
      return (
        <HangmanMultiplayer
          state={activeHangman}
          seatIds={hangmanSeatIds}
          myId={myId}
          isHost={isHost}
          players={roomPlayers}
          minWordLength={hangmanSettings?.minWordLength ?? HANGMAN_DEFAULT_SETTINGS.minWordLength}
          maxWordLength={hangmanSettings?.maxWordLength ?? HANGMAN_DEFAULT_SETTINGS.maxWordLength}
          dispatch={dispatchHangman}
          onExit={handleExitGame}
          onPlayAgain={handlePlayAgainHangman}
        />
      );
    case 'werewolf-setup':
      return (
        <WerewolfSetupScreen
          players={mode === 'single_device' ? devicePlayers : roomPlayers}
          onBack={() => setScreen('game-select')}
          onStart={handleStartWerewolf}
        />
      );
    case 'werewolf-play':
      if (mode === 'single_device') {
        if (!werewolfConfig) {
          return (
            <div className="flex min-h-screen items-center justify-center bg-cream">
              <p className="text-ink/50">Loading game…</p>
            </div>
          );
        }
        return (
          <WerewolfLocalPlay players={devicePlayers} config={werewolfConfig} onExit={handleExitGame} />
        );
      }
      if (!activeWerewolf || !werewolfSeatIds) {
        return (
          <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream">
            <span className="inline-block h-5 w-5 animate-spin-slow rounded-full border-2 border-ink border-t-transparent" />
            <p className="text-ink/50">Loading game…</p>
          </div>
        );
      }
      return (
        <WerewolfMultiplayer
          publicState={activeWerewolf}
          seatIds={werewolfSeatIds}
          myId={myId}
          isHost={isHost}
          players={roomPlayers}
          myRole={myWerewolfRole}
          wolfTally={wolfTally}
          seerLog={seerLog}
          dispatch={dispatchWerewolf}
          onExit={handleExitGame}
          onPlayAgain={handlePlayAgainWerewolf}
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
