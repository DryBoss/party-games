import type { LucideIcon } from 'lucide-react';

interface ModeCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  rotate?: 'left' | 'right' | 'none';
  onSelect?: () => void;
}

const rotationClass: Record<NonNullable<ModeCardProps['rotate']>, string> = {
  left: '-rotate-2',
  right: 'rotate-2',
  none: 'rotate-0',
};

export default function ModeCard({
  icon: Icon,
  title,
  description,
  rotate = 'none',
  onSelect,
}: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        group relative flex w-full flex-col gap-4 border-[3px] border-ink
        bg-paper p-6 text-left transition-transform duration-150
        ${rotationClass[rotate]}
        shadow-[6px_6px_0_0_var(--color-ink)]
        hover:-translate-y-1 hover:shadow-[8px_8px_0_0_var(--color-ink)]
        focus-visible:-translate-y-1 focus-visible:shadow-[8px_8px_0_0_var(--color-ink)]
        focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coral
        active:translate-y-0 active:shadow-[3px_3px_0_0_var(--color-ink)]
      `}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center border-[3px] border-ink bg-lime">
        <Icon className="h-6 w-6 text-ink" strokeWidth={2.25} />
      </span>
      <span className="font-display text-2xl font-semibold leading-tight text-ink">
        {title}
      </span>
      <span className="text-base leading-snug text-ink/70">{description}</span>
    </button>
  );
}
