import { Howler } from 'howler';
import { create } from 'zustand';
export const SOUND_PREFERENCE_KEY = 'cross-fix:sounds-muted';
type SoundSettings = {
    muted: boolean;
    setMuted: (muted: boolean) => void;
};
export const useSoundSettings = create<SoundSettings>((set) => ({
    muted: false,
    setMuted: (muted) => {
        Howler.mute(muted);
        set({ muted });
        try {
            localStorage.setItem(SOUND_PREFERENCE_KEY, String(muted));
        }
        catch { }
    },
}));
export function restoreSoundPreference(): void {
    let muted = false;
    try {
        muted = localStorage.getItem(SOUND_PREFERENCE_KEY) === 'true';
    }
    catch { }
    Howler.mute(muted);
    useSoundSettings.setState({ muted });
}
