import type { GameMode, GameModeId } from './types';
import { KeikiPlayMode } from './keiki-play';
import { CrosswordsMode } from './crosswords';
import { SurfFixMode } from './surf-fix';
const MODES = {
    'keiki-play': KeikiPlayMode,
    'crosswords': CrosswordsMode,
    'surf-fix': SurfFixMode,
} as const satisfies Partial<Record<GameModeId, GameMode>>;
export function getMode(id: GameModeId): GameMode {
    const mode = MODES[id as keyof typeof MODES];
    if (!mode)
        throw new Error(`Mode "${id}" is not yet implemented`);
    return mode;
}
