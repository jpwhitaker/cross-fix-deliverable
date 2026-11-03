import type { ExtractedWord } from '@/lib/dictionary';
import type { BoardCell } from '@/lib/game-store';
import { countRoundPickTilesInCandidate } from './has-round-pick-tile-in-candidate';
export type PickTileRequirement = {
    satisfied: true;
    requiredPickTiles: number;
    candidatePickTiles: number;
} | {
    satisfied: false;
    requiredPickTiles: number;
    candidatePickTiles: number;
    message: string;
};
export function evaluatePickTileRequirement(input: {
    board: BoardCell[][];
    submittedPositions: Set<string> | null;
    candidateWords: readonly ExtractedWord[];
    requiredPickTiles: number;
}): PickTileRequirement {
    const candidatePickTiles = countRoundPickTilesInCandidate(input.board, input.submittedPositions, input.candidateWords);
    if (candidatePickTiles >= input.requiredPickTiles) {
        return {
            satisfied: true,
            requiredPickTiles: input.requiredPickTiles,
            candidatePickTiles,
        };
    }
    return {
        satisfied: false,
        requiredPickTiles: input.requiredPickTiles,
        candidatePickTiles,
        message: pickTileRequirementMessage(input.requiredPickTiles),
    };
}
function pickTileRequirementMessage(requiredPickTiles: number): string {
    return requiredPickTiles <= 1
        ? 'Must include a pick tile!'
        : 'Rounds 13-16 require 3 pick tiles.';
}
