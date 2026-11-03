import type { Pos } from '@/lib/surf-fix-rules/game/types';
export function isForwardReadingStep(from: Pos, to: Pos): boolean {
    return (to.row === from.row && to.col > from.col)
        || (to.col === from.col && to.row > from.row);
}
