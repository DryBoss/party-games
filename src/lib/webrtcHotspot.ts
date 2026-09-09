import { useCallback, useRef, useState } from 'react';
import type { Player } from '../types/player';

/**
 * Local-hotspot rooms are plain WebRTC data channels between devices on the
 * same WiFi/hotspot — there's no server involved, so no internet connection
 * is required. Because there's no server, there's also no rendezvous point:
 * connecting two devices means manually exchanging a short "invite code"
 * (from the host) and an "answer code" (from the joining device). This is
 * the standard WebRTC manual-signaling pattern.
 *
 * Empty iceServers means no STUN/TURN is used — candidates gathered are
 * local-network addresses, which is exactly what we want for same-hotspot
 * play and keeps this fully offline.
 */
const RTC_CONFIG: RTCConfiguration = { iceServers: [] };

function encodeCode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function decodeCode<T>(code: string): T {
  const binary = atob(code.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
    // Safety net in case gathering stalls (e.g. no usable network interface).
    setTimeout(resolve, 4000);
  });
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

interface HostCode {
  peerId: string;
  sdp: RTCSessionDescriptionInit;
}

type DataMessage = { type: string; [key: string]: unknown };

function parseDataMessage(raw: string): DataMessage | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.type === 'string') return parsed as DataMessage;
    return null;
  } catch {
    return null;
  }
}

// ---------- Host ----------

export function useHotspotHost() {
  const [players, setPlayers] = useState<Player[]>([]);
  const playersRef = useRef<Player[]>([]);
  const connectionsRef = useRef(
    new Map<string, { pc: RTCPeerConnection; channel: RTCDataChannel }>(),
  );
  const pendingRef = useRef(new Map<string, RTCPeerConnection>());
  const hostIdRef = useRef(makeId());
  const eventListenersRef = useRef<Set<(data: unknown) => void>>(new Set());

  const commitPlayers = useCallback((next: Player[]) => {
    playersRef.current = next;
    setPlayers(next);
    const msg = JSON.stringify({ type: 'players', players: next });
    connectionsRef.current.forEach(({ channel }) => {
      if (channel.readyState === 'open') channel.send(msg);
    });
  }, []);

  const start = useCallback(
    (hostName: string) => {
      commitPlayers([{ id: hostIdRef.current, name: hostName || 'Host' }]);
    },
    [commitPlayers],
  );

  const generateInviteCode = useCallback(async (): Promise<string> => {
    const peerId = makeId();
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pendingRef.current.set(peerId, pc);

    const channel = pc.createDataChannel('party');
    channel.onopen = () => {
      connectionsRef.current.set(peerId, { pc, channel });
    };
    channel.onmessage = (evt) => {
      const msg = parseDataMessage(evt.data);
      if (!msg) return;
      if (msg.type === 'join' && typeof msg.name === 'string') {
        const next = [
          ...playersRef.current.filter((p) => p.id !== peerId),
          { id: peerId, name: msg.name },
        ];
        commitPlayers(next);
      } else {
        eventListenersRef.current.forEach((listener) => listener(msg));
      }
    };
    channel.onclose = () => {
      connectionsRef.current.delete(peerId);
      commitPlayers(playersRef.current.filter((p) => p.id !== peerId));
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGatheringComplete(pc);

    if (!pc.localDescription) throw new Error('Failed to create local description.');
    return encodeCode({ peerId, sdp: pc.localDescription } satisfies HostCode);
  }, [commitPlayers]);

  const completeInvite = useCallback(async (answerCode: string) => {
    const { peerId, sdp } = decodeCode<HostCode>(answerCode);
    const pc = pendingRef.current.get(peerId);
    if (!pc) throw new Error('No matching invite for this code.');
    await pc.setRemoteDescription(sdp);
    pendingRef.current.delete(peerId);
  }, []);

  const broadcast = useCallback((data: unknown) => {
    const msg = JSON.stringify(data);
    connectionsRef.current.forEach(({ channel }) => {
      if (channel.readyState === 'open') channel.send(msg);
    });
  }, []);

  /** Send to exactly one connected guest — for secrets that shouldn't go to
   * everyone (e.g. a Werewolf player's own role). Since this is already a
   * star topology, each guest's channel is inherently private to them. */
  const sendTo = useCallback((peerId: string, data: unknown) => {
    const conn = connectionsRef.current.get(peerId);
    if (conn?.channel.readyState === 'open') {
      conn.channel.send(JSON.stringify(data));
    }
  }, []);

  const reset = useCallback(() => {
    connectionsRef.current.forEach(({ pc }) => pc.close());
    connectionsRef.current.clear();
    pendingRef.current.forEach((pc) => pc.close());
    pendingRef.current.clear();
    playersRef.current = [];
    setPlayers([]);
  }, []);

  const onEvent = useCallback((listener: (data: unknown) => void) => {
    eventListenersRef.current.add(listener);
    return () => eventListenersRef.current.delete(listener);
  }, []);

  return {
    players,
    myId: hostIdRef.current,
    start,
    generateInviteCode,
    completeInvite,
    broadcast,
    sendTo,
    onEvent,
    reset,
  };
}

// ---------- Guest ----------

export type HotspotGuestState = 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected';

export function useHotspotGuest() {
  const [state, setState] = useState<HotspotGuestState>('idle');
  const [players, setPlayers] = useState<Player[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const eventListenersRef = useRef<Set<(data: unknown) => void>>(new Set());

  const joinWithCode = useCallback(
    async (hostCode: string, name: string): Promise<string> => {
      setState('connecting');
      const { peerId, sdp } = decodeCode<HostCode>(hostCode);
      setMyId(peerId);
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setState((prev) => (prev === 'connected' ? 'disconnected' : 'error'));
        }
      };

      pc.ondatachannel = (evt) => {
        const channel = evt.channel;
        channelRef.current = channel;
        channel.onopen = () => {
          channel.send(JSON.stringify({ type: 'join', name }));
        };
        channel.onmessage = (msgEvt) => {
          const msg = parseDataMessage(msgEvt.data);
          if (!msg) return;
          if (msg.type === 'players' && Array.isArray(msg.players)) {
            setPlayers(msg.players as Player[]);
            setState('connected');
          } else {
            eventListenersRef.current.forEach((listener) => listener(msg));
          }
        };
        channel.onclose = () => {
          setState((prev) => (prev === 'connected' ? 'disconnected' : 'error'));
        };
      };

      await pc.setRemoteDescription(sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGatheringComplete(pc);

      if (!pc.localDescription) throw new Error('Failed to create local description.');
      return encodeCode({ peerId, sdp: pc.localDescription } satisfies HostCode);
    },
    [],
  );

  const sendEvent = useCallback((data: unknown) => {
    channelRef.current?.send(JSON.stringify(data));
  }, []);

  const onEvent = useCallback((listener: (data: unknown) => void) => {
    eventListenersRef.current.add(listener);
    return () => eventListenersRef.current.delete(listener);
  }, []);

  const reset = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    channelRef.current = null;
    setState('idle');
    setPlayers([]);
    setMyId(null);
  }, []);

  return { state, players, myId, joinWithCode, sendEvent, onEvent, reset };
}
