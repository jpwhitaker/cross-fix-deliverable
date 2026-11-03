'use client';
import { useEffect } from 'react';
import { restoreSoundPreference, SOUND_PREFERENCE_KEY } from '@/lib/sound-settings';
export default function SoundSettings() {
    useEffect(() => {
        restoreSoundPreference();
        const onStorage = (event: StorageEvent) => {
            if (event.key === SOUND_PREFERENCE_KEY || event.key === null)
                restoreSoundPreference();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
    return null;
}
