import { Smartphone, Wifi, Globe } from 'lucide-react';
import ModeCard from '../components/ModeCard';
import type { RoomMode } from '../types/room';

interface RoomModeConfig {
  mode: RoomMode;
  icon: typeof Smartphone;
  title: string;
  description: string;
  rotate: 'left' | 'right' | 'none';
}

const ROOM_MODES: RoomModeConfig[] = [
  {
    mode: 'single_device',
    icon: Smartphone,
    title: 'This device',
    description: 'Pass the phone around and play together on one screen.',
    rotate: 'left',
  },
  {
    mode: 'hotspot',
    icon: Wifi,
    title: 'Local hotspot',
    description: 'Connect nearby devices over WiFi, no internet needed.',
    rotate: 'none',
  },
  {
    mode: 'online',
    icon: Globe,
    title: 'Online',
    description: 'Play with friends anywhere, hosted online.',
    rotate: 'right',
  },
];

interface ModeSelectScreenProps {
  onSelect: (mode: RoomMode) => void;
}

export default function ModeSelectScreen({ onSelect }: ModeSelectScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-cream px-6 py-16">
      <div className="w-full max-w-3xl">
        <p className="font-display text-lg font-semibold text-coral">party-hub</p>

        <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] text-ink sm:text-5xl">
          Where's everyone
          <br />
          playing?
        </h1>
        <p className="mt-4 max-w-md text-lg text-ink/70">
          Pick a room type to get started. You can switch games later without
          leaving the room.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {ROOM_MODES.map((room) => (
            <ModeCard
              key={room.mode}
              icon={room.icon}
              title={room.title}
              description={room.description}
              rotate={room.rotate}
              onSelect={() => onSelect(room.mode)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
