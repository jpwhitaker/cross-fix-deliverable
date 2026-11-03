'use client';
import { SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline';
import { useSoundSettings } from '@/lib/sound-settings';
import { usePenFriendlyPress } from '@/hooks/usePenFriendlyPress';
export default function SoundToggle() {
    const muted = useSoundSettings((state) => state.muted);
    const setMuted = useSoundSettings((state) => state.setMuted);
    const press = usePenFriendlyPress<HTMLButtonElement>();
    const Icon = muted ? SpeakerXMarkIcon : SpeakerWaveIcon;
    return <button type="button" {...press(() => setMuted(!useSoundSettings.getState().muted))} aria-label="Mute game sounds" aria-pressed={muted} title={muted ? 'Turn game sounds on' : 'Mute game sounds'} className="inline-flex items-center gap-1.5 self-start px-2.5 py-1.5 rounded-lg border border-current/20 bg-white/90 text-[#1c2836] font-sans text-xs font-semibold cursor-pointer hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
    <Icon className="h-4 w-4" aria-hidden="true"/>
    {muted ? 'Sound off' : 'Sound on'}
  </button>;
}
