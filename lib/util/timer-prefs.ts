import type { GameModeId } from '@/lib/modes/types';
const KEY = 'cross-fix:timer-prefs';
export type TimerPrefs = {
    remember: boolean;
    timerEnabled: boolean;
    timerMinutes1_12: number;
    timerMinutes13_16: number;
};
type StoredTimerPrefsByMode = Partial<Record<GameModeId, TimerPrefs>>;
function isValidTimerPrefs(data: unknown): data is TimerPrefs {
    if (!data || typeof data !== 'object')
        return false;
    const candidate = data as Partial<TimerPrefs>;
    return (typeof candidate.remember === 'boolean' &&
        typeof candidate.timerEnabled === 'boolean' &&
        Number.isInteger(candidate.timerMinutes1_12) &&
        Number.isInteger(candidate.timerMinutes13_16));
}
function readStoredTimerPrefsByMode(): StoredTimerPrefsByMode {
    if (typeof window === 'undefined')
        return {};
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw)
            return {};
        const parsed = JSON.parse(raw) as unknown;
        if (isValidTimerPrefs(parsed))
            return { crosswords: parsed };
        if (!parsed || typeof parsed !== 'object')
            return {};
        const byMode = parsed as Record<string, unknown>;
        const result: StoredTimerPrefsByMode = {};
        for (const [modeId, prefs] of Object.entries(byMode)) {
            if (isValidTimerPrefs(prefs)) {
                result[modeId as GameModeId] = prefs;
            }
        }
        return result;
    }
    catch {
        return {};
    }
}
function writeStoredTimerPrefsByMode(byMode: StoredTimerPrefsByMode): void {
    if (typeof window === 'undefined')
        return;
    try {
        if (Object.keys(byMode).length === 0) {
            localStorage.removeItem(KEY);
            return;
        }
        localStorage.setItem(KEY, JSON.stringify(byMode));
    }
    catch { }
}
export function loadTimerPrefs(modeId: GameModeId): TimerPrefs | null {
    const byMode = readStoredTimerPrefsByMode();
    return byMode[modeId] ?? null;
}
export function saveTimerPrefs(modeId: GameModeId, prefs: TimerPrefs): void {
    const byMode = readStoredTimerPrefsByMode();
    byMode[modeId] = prefs;
    writeStoredTimerPrefsByMode(byMode);
}
export function clearTimerPrefs(modeId: GameModeId): void {
    const byMode = readStoredTimerPrefsByMode();
    delete byMode[modeId];
    writeStoredTimerPrefsByMode(byMode);
}
