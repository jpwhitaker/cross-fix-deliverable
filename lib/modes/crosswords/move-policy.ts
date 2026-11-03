import type { BatchMoveValidationContext, EvaluationResult } from '@/lib/modes/move-policy';
import { positionKey, deriveSubmittedNeighborsFromKey } from '@/lib/modes/move-policy';
import { areSubmittedPositionsCovered, collectFullySubmittedWordState, wordMultisetsEqual, } from '@/lib/predicates/move/submitted-word-integrity';
import { isBentWordReflowMove } from '@/lib/predicates/move/is-bent-word-reflow-move';
import { bentWordReflowIntegrityHolds } from '@/lib/predicates/move/bent-word-reflow-integrity';
const ORTHOGONAL_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
function submittedStraightWordIntegrityHolds(baselineBoard: BatchMoveValidationContext['board'], baselineSubmittedPositions: Set<string> | null, board: BatchMoveValidationContext['nextBoard'], submittedPositions: Set<string> | null, submittedBentWordPositions?: Set<string> | null): boolean {
    if (!baselineSubmittedPositions || baselineSubmittedPositions.size === 0)
        return true;
    if (!submittedPositions || submittedPositions.size === 0)
        return true;
    const baseline = collectFullySubmittedWordState(baselineBoard, baselineSubmittedPositions);
    const next = collectFullySubmittedWordState(board, submittedPositions, {
        submittedBentWordPositions,
    });
    if (!areSubmittedPositionsCovered(submittedPositions, next.coveredPositions))
        return false;
    return wordMultisetsEqual(baseline.wordCounts, next.wordCounts);
}
export function validateCrosswordsBatchMove(ctx: BatchMoveValidationContext): EvaluationResult {
    if (isBentWordReflowMove(ctx.movingSubmittedKeys, ctx.submittedBentWordPositions)) {
        return bentWordReflowIntegrityHolds(ctx) ? { ok: true } : { ok: false };
    }
    for (const move of ctx.moves) {
        const fromKey = positionKey(move.fromRow, move.fromCol);
        if (!ctx.movingSubmittedKeys.has(fromKey))
            continue;
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
    }
    if (ctx.movingSubmittedKeys.size > 0 &&
        !submittedStraightWordIntegrityHolds(ctx.board, ctx.submittedPositions, ctx.nextBoard, ctx.nextSubmittedPositions, ctx.submittedBentWordPositions)) {
        return { ok: false };
    }
    return { ok: true };
}
