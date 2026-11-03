import type { GameAuthoring } from '@/lib/game-settings'
import type { BoardCell } from '@/lib/game-store';
import type { SurfFixWord } from '@/lib/modes/shared/word-ledger-types';
import { appendRideClaim, createRideClaim, promoteRideClaim, rideBoardKey, type RideClaim } from '@/lib/predicates/reads/ride-claim';
import type { ReadingTile } from '@/lib/predicates/reads/board-traversal';
import { deriveTransientProjection } from '@/lib/surf-fix-rules/game/transient-projection';
import { adaptSurfFixBoardToEngine } from './adapter';
import { rejectedProjectionResult } from './submit-validator';
import { surfFixReadingPolicy } from './reading-policy';
type Input = {
    board: BoardCell[][];
    submittedPositions: Set<string> | null;
    chainWords: readonly SurfFixWord[];
    authoring?: GameAuthoring | null;
    rideClaim?: RideClaim | null;
};
export function surfFixRideBoard(input: Input) {
    const adapted = adaptSurfFixBoardToEngine(input);
    const newIds = new Set(adapted.transientPlacements.map(tile => tile.tileId));
    const tiles: ReadingTile[] = Object.entries(adapted.tilePositions).map(([id, cell]) => ({
        ...cell, id, text: adapted.tileRegistry[id].letter, isNew: newIds.has(id),
    }));
    const words = adapted.submittedWords.map(word => ({ id: word.id, text: word.text, tileIds: word.orderedTileIds }));
    return { tiles, words, boardKey: rideBoardKey(tiles, words), hasNewTiles: newIds.size > 0 };
}
export function selectSurfFixRide(input: Input, selectedIds: readonly string[]) {
    const { tiles, words } = surfFixRideBoard(input);
    return createRideClaim(selectedIds, tiles, words);
}
export function validateSurfFixRideSelection(input: Input, selectedIds: readonly string[]) {
    const selection = selectSurfFixRide(input, selectedIds);
    if (!selection.ok)
        return selection;
    const claim = surfFixReadingPolicy(input.authoring) ? appendRideClaim(input.rideClaim, selection.claim) : selection.claim;
    const adapted = adaptSurfFixBoardToEngine(input);
    const projection = deriveTransientProjection({
        words: adapted.submittedWords,
        tiles: adapted.tileRegistry,
        transientPlacements: adapted.transientPlacements,
        rideClaim: claim,
        readingPolicy: surfFixReadingPolicy(input.authoring),
    });
    if (projection.kind !== 'stable') {
        return { ok: false as const, message: projection.kind === 'ambiguous' && projection.reason === 'invalid-ride-claim'
                ? `Cannot apply ${selection.claim.text}: select a complete legal path with open ends.`
                : rejectedProjectionResult(projection).message ?? 'Cannot apply this Ride. Check your selection.' };
    }
    return { ok: true as const, claim };
}
export function chooseSurfFixRide(input: Input, tileIds: readonly string[], expectedBoardKey: string) {
    if (!surfFixReadingPolicy(input.authoring)) {
        return { ok: false as const, message: 'Choose Ride is not enabled for this game.' };
    }
    const topology = surfFixRideBoard(input);
    if (topology.boardKey !== expectedBoardKey) {
        return { ok: false as const, message: 'The board changed. Choose your Ride again.' };
    }
    const adapted = adaptSurfFixBoardToEngine(input);
    const projection = deriveTransientProjection({
        words: adapted.submittedWords, tiles: adapted.tileRegistry,
        transientPlacements: adapted.transientPlacements, rideClaim: input.rideClaim,
        readingPolicy: surfFixReadingPolicy(input.authoring), captureRideOptions: true,
    });
    const option = projection.rideOptions?.find(read => read.key === tileIds.join('|'));
    if (!option)
        return { ok: false as const, message: 'That Ride is not a valid complete reading. Check the applied words and board.' };
    return { ok: true as const, claim: promoteRideClaim(input.rideClaim, option) };
}
