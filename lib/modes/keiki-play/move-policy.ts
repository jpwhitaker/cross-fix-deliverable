import type { BatchMoveValidationContext, EvaluationResult } from '@/lib/modes/move-policy';
import { positionKey, deriveSubmittedNeighborsFromKey } from '@/lib/modes/move-policy';
import { isAdjacentToSubmitted } from '@/lib/predicates/board/getBlockedAdjacentEmptyKeys';
import { areSubmittedPositionsCovered, buildWordMultiset, collectFullySubmittedWordState, wordMultisetContains, } from '@/lib/predicates/move/submitted-word-integrity';
const ORTHOGONAL_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
function submittedStraightWordIntegrityHolds(board: BatchMoveValidationContext['nextBoard'], submittedPositions: Set<string> | null, submittedWords: readonly string[] | null): boolean {
    const state = collectFullySubmittedWordState(board, submittedPositions, {
        acceptWord: (word) => word.valid,
    });
    if (!areSubmittedPositionsCovered(submittedPositions, state.coveredPositions))
        return false;
    const expectedWords = buildWordMultiset(submittedWords ?? []);
    return wordMultisetContains(state.wordCounts, expectedWords);
}
export function validateKeikiPlayBatchMove(ctx: BatchMoveValidationContext): EvaluationResult {
    for (const move of ctx.moves) {
        const fromKey = positionKey(move.fromRow, move.fromCol);
        if (ctx.movingSubmittedKeys.has(fromKey)) {
            const allowedNeighbors = ctx.baselineNeighbors?.get(fromKey) ??
                deriveSubmittedNeighborsFromKey(fromKey, ctx.submittedPositions);
            for (const [dr, dc] of ORTHOGONAL_DIRS) {
                const neighborKey = positionKey(move.toRow + dr, move.toCol + dc);
                if (!ctx.nextSubmittedPositions?.has(neighborKey))
                    continue;
                if (ctx.movingSubmittedTargetKeys.has(neighborKey))
                    continue;
                if (!allowedNeighbors.has(neighborKey))
                    return { ok: false };
            }
            continue;
        }
        if (isAdjacentToSubmitted(move.toRow, move.toCol, ctx.nextSubmittedPositions, ctx.sourceKeys)) {
            return { ok: false };
        }
    }
    if (ctx.movingSubmittedKeys.size > 0 &&
        !submittedStraightWordIntegrityHolds(ctx.nextBoard, ctx.nextSubmittedPositions, ctx.submittedWords ?? null)) {
        return { ok: false };
    }
    return { ok: true };
}
