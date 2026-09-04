import { Globe } from 'lucide-react';
import BackButton from '../components/BackButton';

interface OnlineComingSoonScreenProps {
  onBack: () => void;
}

export default function OnlineComingSoonScreen({
  onBack,
}: OnlineComingSoonScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center border-[3px] border-ink bg-lime shadow-[6px_6px_0_0_var(--color-ink)]">
          <Globe className="h-7 w-7 text-ink" strokeWidth={2.25} />
        </span>
        <h1 className="mt-6 font-display text-3xl font-bold leading-tight text-ink">
          Online rooms are coming soon
        </h1>
        <p className="mt-3 text-lg text-ink/70">
          This will run on Cloudflare PartyKit once the online adapter is
          wired up.
        </p>
        <div className="mt-8">
          <BackButton label="Change room type" onClick={onBack} />
        </div>
      </div>
    </div>
  );
}
