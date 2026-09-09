import type * as Party from 'partykit/server';

interface Player {
  id: string;
  name: string;
}

interface JoinMessage {
  type: 'join';
  name: string;
  /** 'create' fails if the room doesn't exist yet; 'join' fails if it doesn't. */
  intent: 'create' | 'join';
}

interface LeaveMessage {
  type: 'leave';
}

type ClientMessage = JoinMessage | LeaveMessage | { type: string; [key: string]: unknown };

/**
 * One PartyKit room = one game room. Room code is the PartyKit room id.
 * The first player to 'create' the room becomes host; if the host
 * disconnects, the next-longest-connected player is promoted automatically.
 * Only the host is expected to drive game selection — that's enforced
 * client-side using the hostId this room broadcasts, not by the server.
 */
export default class GameRoom implements Party.Server {
  players = new Map<string, Player>();
  everCreated = false;
  hostId: string | null = null;

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    // Players aren't added until they send a 'join' message with their name.
    conn.send(JSON.stringify({ type: 'connected', roomCode: this.room.id }));
  }

  onMessage(message: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }

    if (msg.type === 'join') {
      const { name, intent } = msg as JoinMessage;

      if (intent === 'join' && !this.everCreated) {
        sender.send(JSON.stringify({ type: 'error', reason: 'room-not-found' }));
        return;
      }
      if (intent === 'create') {
        this.everCreated = true;
        if (!this.hostId) this.hostId = sender.id;
      }

      this.players.set(sender.id, { id: sender.id, name });
      this.broadcastPlayers();
      return;
    }

    if (msg.type === 'leave') {
      this.players.delete(sender.id);
      this.promoteHostIfNeeded();
      this.broadcastPlayers();
      return;
    }

    // A host-originated 'whisper-to' is delivered to exactly one other
    // player — for secrets that shouldn't go to everyone (e.g. a Werewolf
    // player's own role, or a Seer's private inspection result).
    if (msg.type === 'whisper-to' && sender.id === this.hostId) {
      const { targetId, payload } = msg as { targetId?: string; payload?: unknown };
      if (typeof targetId === 'string' && payload !== undefined) {
        this.room.getConnection(targetId)?.send(JSON.stringify(payload));
      }
      return;
    }

    // Anything else is a game event. The host is authoritative and
    // broadcasts state to everyone; regular players can only whisper
    // privately to the host (e.g. a secret choice in a game) so it's never
    // visible to other players before the host reveals it.
    if (sender.id === this.hostId) {
      this.room.broadcast(message, [sender.id]);
    } else if (this.hostId) {
      this.room.getConnection(this.hostId)?.send(message);
    }
  }

  onClose(conn: Party.Connection) {
    this.players.delete(conn.id);
    this.promoteHostIfNeeded();
    this.broadcastPlayers();
  }

  /** If the host just left, hand the role to whoever joined next-earliest. */
  promoteHostIfNeeded() {
    if (this.hostId && !this.players.has(this.hostId)) {
      const next = this.players.keys().next();
      this.hostId = next.done ? null : next.value;
    }
  }

  broadcastPlayers() {
    this.room.broadcast(
      JSON.stringify({
        type: 'players',
        players: Array.from(this.players.values()),
        hostId: this.hostId,
      }),
    );
  }
}

GameRoom satisfies Party.Worker;
