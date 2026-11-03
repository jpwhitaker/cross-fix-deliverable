import type { GameModeId } from './types';
export function canDragSubmittedBoardTiles(modeId: GameModeId): boolean {
    return modeId === 'surf-fix';
}
export function shouldShowBlockedAdjacentOverlay(modeId: GameModeId): boolean {
    return modeId !== 'crosswords' && modeId !== 'surf-fix';
}
export function shouldValidateHandPlacementWithMovePolicy(modeId: GameModeId): boolean {
    return modeId !== 'surf-fix';
}
export function canChooseWildcardLetters(modeId: GameModeId): boolean {
    return modeId === 'crosswords' || modeId === 'surf-fix';
}
export function canExchangeEquivalentTiles(modeId: GameModeId): boolean {
    return modeId === 'crosswords' || modeId === 'surf-fix';
}
export function canUseSurfboardTiles(modeId: GameModeId): boolean {
    return modeId === 'crosswords' || modeId === 'surf-fix';
}
export function supportsRoundTimer(modeId: GameModeId): boolean {
    return modeId === 'crosswords' || modeId === 'surf-fix';
}
