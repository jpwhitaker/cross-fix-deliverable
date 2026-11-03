import type { BoardCell } from '@/lib/game-store';
import type { BatchMoveValidationContext, EvaluationResult } from '@/lib/modes/move-policy';
import type { BatchMoveApplyResult } from '@/lib/modes/types';
import type { Pos, SubmittedWord } from '@/lib/surf-fix-rules/game/types';
import { commitTileBatchMutation, type TileBatchMove, type TileBatchMutationCommitResult } from '@/lib/surf-fix-rules/game/state';
import type { SurfFixWord, SurfFixWordSnapshot } from '@/lib/modes/shared/word-ledger-types';
import type { SurfFixMoveValidationTrace } from '@/lib/surf-fix-rules/trace/read-trace';
import { adaptSurfFixBoardToEngine, surfFixTileIdForCell, validateFixedOriginTilesNotMoved, } from './adapter';
type SurfFixBatchMoveRun = {
    ok: true;
    result: Extract<TileBatchMutationCommitResult, {
        kind: 'applied' | 'no-op';
    }>;
} | {
    ok: false;
    reason: string;
    trace?: SurfFixMoveValidationTrace;
};
export function validateSurfFixBatchMove(ctx: BatchMoveValidationContext): EvaluationResult {
    const run = runSurfFixBatchMove(ctx);
    if (run.ok)
        return { ok: true };
    if (run.trace?.kind !== 'submitted-sbs-contact')
        return { ok: false };
    const text = run.trace.contact.text.toUpperCase();
    switch (run.trace.reason) {
        case 'sbs-pre-space-occupied':
            return { ok: false, message: `Invalid SBS: ${text} needs an open space before it` };
        case 'sbs-post-space-occupied':
            return { ok: false, message: `Invalid SBS: ${text} needs an open space after it` };
        default:
            return { ok: false, message: `Invalid SBS: ${text}` };
    }
}
export function applySurfFixBatchMoveToChainWords(ctx: BatchMoveValidationContext, chainWords: readonly SurfFixWord[]): SurfFixWord[] | null {
    const applied = applySurfFixBatchMove(ctx, [...chainWords]);
    return applied.ok ? applied.chainWords : null;
}
export function applySurfFixBatchMove(ctx: BatchMoveValidationContext, chainWords: SurfFixWord[]): BatchMoveApplyResult {
    const run = runSurfFixBatchMove(ctx);
    if (!run.ok)
        return { ok: false };
    const engineWordsById = new Map(run.result.words.map((word) => [word.id, word]));
    let changed = false;
    const nextWords = chainWords.map((word) => {
        const engineWord = engineWordsById.get(word.id);
        if (!engineWord)
            return word;
        if (sameShape(word.shape, engineWord.shape))
            return word;
        changed = true;
        return hostWordFromEngineWord(engineWord, [snapshotHostWord(word), ...word.history]);
    });
    return { ok: true, chainWords: changed ? nextWords : [...chainWords] };
}
function runSurfFixBatchMove(ctx: BatchMoveValidationContext): SurfFixBatchMoveRun {
    try {
        return runSurfFixBatchMoveUnsafe(ctx);
    }
    catch {
        return { ok: false, reason: 'invalid-surf-fix-state' };
    }
}
function runSurfFixBatchMoveUnsafe(ctx: BatchMoveValidationContext): SurfFixBatchMoveRun {
    if (ctx.hasDuplicateEndpoints)
        return { ok: false, reason: 'duplicate-endpoints' };
    const fixedOriginValidation = validateFixedOriginTilesNotMoved({
        board: ctx.board,
        moves: ctx.moves,
    });
    if (!fixedOriginValidation.ok)
        return { ok: false, reason: fixedOriginValidation.reason };
    const engineMoves = engineMovesFromContext(ctx.board, ctx.moves);
    if (!engineMoves)
        return { ok: false, reason: 'missing-source-tile' };
    const adapted = adaptSurfFixBoardToEngine({
        board: ctx.board,
        submittedPositions: ctx.submittedPositions,
        chainWords: ctx.submittedChainWords ?? [],
    });
    const result = commitTileBatchMutation({
        words: adapted.submittedWords,
        transientPlacements: adapted.transientPlacements,
        moves: engineMoves,
        round: 0,
    });
    if (result.kind === 'rejected')
        return { ok: false, reason: result.reason, trace: result.trace };
    return { ok: true, result };
}
function engineMovesFromContext(board: BoardCell[][], moves: readonly BatchMoveValidationContext['moves'][number][]): TileBatchMove[] | null {
    const engineMoves: TileBatchMove[] = [];
    for (const move of moves) {
        const from = { row: move.fromRow, col: move.fromCol };
        const cell = board[move.fromRow]?.[move.fromCol];
        if (!cell || cell.kind === 'empty')
            return null;
        engineMoves.push({
            tileId: surfFixTileIdForCell(cell, from),
            toCell: { row: move.toRow, col: move.toCol },
        });
    }
    return engineMoves;
}
function hostWordFromEngineWord(word: SubmittedWord, history: SurfFixWordSnapshot[]): SurfFixWord {
    return {
        id: word.id,
        ledgerKind: word.ledgerKind ?? 'word',
        text: word.text,
        orderedTileIds: [...word.orderedTileIds],
        shape: { cells: word.shape.cells.map((cell) => ({ ...cell })) },
        ancestors: [...word.ancestors],
        roundCreated: word.roundCreated,
        history,
    };
}
function snapshotHostWord(word: SurfFixWord): SurfFixWordSnapshot {
    return {
        id: word.id,
        ledgerKind: word.ledgerKind ?? 'word',
        text: word.text,
        orderedTileIds: [...word.orderedTileIds],
        shape: { cells: word.shape.cells.map((cell) => ({ ...cell })) },
        ancestors: [...word.ancestors],
        roundCreated: word.roundCreated,
    };
}
function sameShape(a: {
    cells: readonly Pos[];
}, b: {
    cells: readonly Pos[];
}): boolean {
    return a.cells.length === b.cells.length
        && a.cells.every((cell, index) => {
            const other = b.cells[index];
            return !!other && other.row === cell.row && other.col === cell.col;
        });
}
