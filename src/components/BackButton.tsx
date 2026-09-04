import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  label: string;
  onClick: () => void;
}

export default function BackButton({ label, onClick }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 text-sm font-medium text-ink/70 transition-colors hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4 shrink-0 mr-0.5" strokeWidth={2.25} />
      <span>{label}</span>
    </button>
  );
}
