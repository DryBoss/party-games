import { useEffect, useState } from 'react';
import { Plus, LogIn, Copy, Check, Users, ScanLine } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import BackButton from '../components/BackButton';
import QRScanner from '../components/QRScanner';
import type { useHotspotHost, useHotspotGuest } from '../lib/hotspotTransport';
import { getStoredName, setStoredName } from '../lib/session';
import type { Player } from '../types/player';

interface HotspotLobbyScreenProps {
  host: ReturnType<typeof useHotspotHost>;
  guest: ReturnType<typeof useHotspotGuest>;
  onBack: () => void;
  onReady: (players: Player[]) => void;
}

type View = 'choose' | 'host' | 'join';

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex flex-col gap-2">
      <textarea
        readOnly
        value={value}
        rows={4}
        className="w-full resize-none border-[3px] border-ink bg-paper p-3 font-mono text-xs text-ink shadow-[4px_4px_0_0_var(--color-ink)]"
        onFocus={(e) => e.target.select()}
      />
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center justify-center gap-2 border-[3px] border-ink bg-lime py-2 font-medium text-ink shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy code'}
      </button>
    </div>
  );
}

/** Shows a code as a scannable QR by default, with a text/copy fallback. */
function ShareCode({ value }: { value: string }) {
  const [showText, setShowText] = useState(false);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="border-[3px] border-ink bg-paper p-3 shadow-[4px_4px_0_0_var(--color-ink)]">
        <QRCodeSVG value={value} size={240} level="L" />
      </div>
      <button
        type="button"
        onClick={() => setShowText((s) => !s)}
        className="text-sm font-medium text-ink/60 underline underline-offset-2 hover:text-ink"
      >
        {showText ? 'Hide code' : "Can't scan? Copy the code instead"}
      </button>
      {showText && <div className="w-full"><CopyField value={value} /></div>}
    </div>
  );
}

function PlayerList({ players }: { players: Player[] }) {
  return (
    <div className="mt-6 flex flex-col gap-2">
      <p className="flex items-center gap-2 text-sm font-medium text-ink/60">
        <Users className="h-4 w-4" /> {players.length} player
        {players.length === 1 ? '' : 's'}
      </p>
      <ul className="flex flex-wrap gap-2">
        {players.map((p) => (
          <li
            key={p.id}
            className="border-[2px] border-ink bg-paper px-3 py-1 text-sm font-medium text-ink"
          >
            {p.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HotspotLobbyScreen({ host, guest, onBack, onReady }: HotspotLobbyScreenProps) {
  const [view, setView] = useState<View>(() => {
    if (host.players.length > 0) return 'host';
    if (
      guest.state === 'connected' ||
      guest.state === 'connecting' ||
      guest.state === 'disconnected'
    )
      return 'join';
    return 'choose';
  });
  const [name, setName] = useState(getStoredName);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Host flow
  const [inviteCode, setInviteCode] = useState('');
  const [answerInput, setAnswerInput] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Guest flow
  const [hostCodeInput, setHostCodeInput] = useState('');
  const [answerCode, setAnswerCode] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);

  const startHosting = () => {
    setStoredName(name);
    host.start(name);
    setView('host');
    void refreshInvite();
  };

  const refreshInvite = async () => {
    setGenerating(true);
    setInviteError(null);
    try {
      const code = await host.generateInviteCode();
      setInviteCode(code);
    } catch {
      setInviteError('Could not create an invite code. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (view === 'host' && inviteCode === '' && !generating) {
      void refreshInvite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const handleCompleteInvite = async (codeOverride?: string) => {
    const code = codeOverride ?? answerInput;
    setInviteError(null);
    try {
      await host.completeInvite(code);
      setAnswerInput('');
    } catch {
      setInviteError("That code didn't match an active invite.");
    }
  };

  const handleJoin = async (codeOverride?: string) => {
    const code = codeOverride ?? hostCodeInput;
    setGuestError(null);
    setStoredName(name);
    try {
      const answer = await guest.joinWithCode(code, name || 'Player');
      setAnswerCode(answer);
    } catch {
      setGuestError("That code doesn't look right. Double-check and try again.");
    }
  };

  const handleScan = (data: string) => {
    setScannerOpen(false);
    if (view === 'host') {
      setAnswerInput(data);
      void handleCompleteInvite(data);
    } else if (view === 'join') {
      setHostCodeInput(data);
      void handleJoin(data);
    }
  };

  if (view === 'choose') {
    return (
      <div className="flex min-h-screen flex-col items-center bg-cream px-6 py-16">
        <div className="w-full max-w-md">
          <BackButton label="Change room type" onClick={onBack} />
          <p className="mt-6 font-display text-lg font-semibold text-coral">Local hotspot</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-[1.05] text-ink">
            Create or join?
          </h1>
          <p className="mt-4 text-lg text-ink/70">
            Everyone needs to be on the same WiFi or hotspot. No internet needed.
          </p>

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

          <div className="mt-6 flex flex-col gap-5">
            <button
              type="button"
              disabled={name.trim().length === 0}
              onClick={startHosting}
              className="flex items-center gap-4 border-[3px] border-ink bg-lime p-5 text-left shadow-[6px_6px_0_0_var(--color-ink)] transition-transform duration-150 hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center border-[3px] border-ink bg-paper">
                <Plus className="h-5 w-5 text-ink" strokeWidth={2.5} />
              </span>
              <span>
                <span className="block font-display text-xl font-semibold text-ink">Create room</span>
                <span className="block text-sm text-ink/70">Host a new room on this device.</span>
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
                <span className="block text-sm text-ink/70">Scan a code from the host's screen.</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'host') {
    return (
      <div className="flex min-h-screen flex-col items-center bg-cream px-6 py-16">
        <div className="w-full max-w-md">
          <BackButton label="Change room type" onClick={onBack} />
          <p className="mt-6 font-display text-lg font-semibold text-coral">Hosting</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink">Invite a device</h1>
          <p className="mt-3 text-ink/70">
            Have the next device scan this code from "Join room".
          </p>

          <div className="mt-6">
            {generating ? (
              <p className="text-sm text-ink/50">Generating code…</p>
            ) : (
              <ShareCode value={inviteCode} />
            )}
          </div>

          <p className="mt-8 text-sm font-medium text-ink/70">
            Then scan the code they send back:
          </p>
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 border-[3px] border-ink bg-coral py-3 font-display text-lg font-semibold text-ink shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
          >
            <ScanLine className="h-5 w-5" />
            Scan their code
          </button>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-ink/60 underline underline-offset-2">
              Or paste it instead
            </summary>
            <textarea
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              rows={3}
              placeholder="Paste their answer code here"
              className="mt-2 w-full resize-none border-[3px] border-ink bg-paper p-3 font-mono text-xs text-ink placeholder:text-ink/30 shadow-[4px_4px_0_0_var(--color-ink)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void handleCompleteInvite()}
              disabled={answerInput.trim().length === 0}
              className="mt-2 w-full border-[3px] border-ink bg-paper py-2 font-medium text-ink shadow-[3px_3px_0_0_var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Connect device
            </button>
          </details>
          {inviteError && <p className="mt-2 text-sm text-coral">{inviteError}</p>}

          <PlayerList players={host.players} />

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void refreshInvite()}
              className="text-sm font-medium text-ink/60 underline underline-offset-2 hover:text-ink"
            >
              Invite another device
            </button>
            <button
              type="button"
              onClick={() => onReady(host.players)}
              className="w-full border-[3px] border-ink bg-lime py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
            >
              Continue to games
            </button>
          </div>
        </div>

        {scannerOpen && (
          <QRScanner onScan={handleScan} onClose={() => setScannerOpen(false)} />
        )}
      </div>
    );
  }

  // view === 'join'
  return (
    <div className="flex min-h-screen flex-col items-center bg-cream px-6 py-16">
      <div className="w-full max-w-md">
        <BackButton label="Back" onClick={() => setView('choose')} />
        <p className="mt-6 font-display text-lg font-semibold text-coral">Joining</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Scan host's code</h1>

        {guest.state === 'disconnected' ? (
          <>
            <p className="mt-3 text-ink/70">
              The host's connection dropped, so this room is no longer
              reachable. Ask them to create a new room, or go back and start
              your own.
            </p>
            <button
              type="button"
              onClick={() => {
                guest.reset();
                setAnswerCode('');
                setHostCodeInput('');
                setView('choose');
              }}
              className="mt-6 w-full border-[3px] border-ink bg-paper py-3 font-display text-lg font-semibold text-ink shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
            >
              Back to room options
            </button>
          </>
        ) : guest.state !== 'connected' ? (
          <>
            <p className="mt-3 text-ink/70">
              Scan the code from the host's screen to join.
            </p>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              disabled={guest.state === 'connecting'}
              className="mt-4 flex w-full items-center justify-center gap-2 border-[3px] border-ink bg-coral py-3 font-display text-lg font-semibold text-ink shadow-[4px_4px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ScanLine className="h-5 w-5" />
              {guest.state === 'connecting' ? 'Connecting…' : 'Scan host code'}
            </button>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-ink/60 underline underline-offset-2">
                Or paste it instead
              </summary>
              <textarea
                value={hostCodeInput}
                onChange={(e) => setHostCodeInput(e.target.value)}
                rows={4}
                placeholder="Paste host's code here"
                className="mt-2 w-full resize-none border-[3px] border-ink bg-paper p-3 font-mono text-xs text-ink placeholder:text-ink/30 shadow-[4px_4px_0_0_var(--color-ink)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleJoin()}
                disabled={hostCodeInput.trim().length === 0 || guest.state === 'connecting'}
                className="mt-2 w-full border-[3px] border-ink bg-paper py-2 font-medium text-ink shadow-[3px_3px_0_0_var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Generate my code
              </button>
            </details>
            {guestError && <p className="mt-2 text-sm text-coral">{guestError}</p>}

            {answerCode && (
              <div className="mt-6">
                <p className="text-sm font-medium text-ink/70">
                  Show this to the host so they can scan it back:
                </p>
                <div className="mt-2">
                  <ShareCode value={answerCode} />
                </div>
                <p className="mt-3 text-center text-sm text-ink/50">
                  Waiting for the host to connect…
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mt-3 text-ink/70">Connected! Waiting for the host to continue.</p>
            <PlayerList players={guest.players} />
            <button
              type="button"
              onClick={() => onReady(guest.players)}
              className="mt-8 w-full border-[3px] border-ink bg-lime py-4 font-display text-xl font-semibold text-ink shadow-[6px_6px_0_0_var(--color-ink)] transition-transform hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]"
            >
              Continue to games
            </button>
          </>
        )}
      </div>

      {scannerOpen && (
        <QRScanner onScan={handleScan} onClose={() => setScannerOpen(false)} />
      )}
    </div>
  );
}
