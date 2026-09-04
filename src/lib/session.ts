const NAME_KEY = 'party-hub:name';
const ONLINE_SESSION_KEY = 'party-hub:online-session';

export function getStoredName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setStoredName(name: string) {
  try {
    if (name.trim()) localStorage.setItem(NAME_KEY, name.trim());
  } catch {
    // localStorage unavailable (private browsing etc.) — not critical
  }
}

export interface OnlineSession {
  roomCode: string;
  name: string;
}

/**
 * Online sessions can survive a page refresh because the room lives on the
 * PartyKit server — reconnecting just means opening a new socket to the same
 * room code. There's no equivalent for hotspot: that connection is a direct
 * WebRTC link between two browser tabs, so a refresh destroys it and it has
 * to be re-established with a fresh invite/answer code exchange.
 */
export function getOnlineSession(): OnlineSession | null {
  try {
    const raw = localStorage.getItem(ONLINE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.roomCode === 'string' && typeof parsed?.name === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setOnlineSession(session: OnlineSession) {
  try {
    localStorage.setItem(ONLINE_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearOnlineSession() {
  try {
    localStorage.removeItem(ONLINE_SESSION_KEY);
  } catch {
    // ignore
  }
}
