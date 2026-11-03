import type { BoardCell } from '@/lib/game-store';
import { positionKey, parsePositionKey } from '@/lib/util/position-key';
export { positionKey, parsePositionKey } from '@/lib/util/position-key';
import type { SurfFixWord } from './shared/word-ledger-types';
export type CellKey = string;
export type BatchMove = {
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
};
export type EvaluationResult = {
    ok: boolean;
    message?: string;
};
export type BatchMoveValidationContext = {
    board: BoardCell[][];
    submittedPositions: Set<string> | null;
    submittedBentWordPositions?: Set<string> | null;
    submittedChainWords?: readonly SurfFixWord[] | null;
    submittedWords: readonly string[] | null;
    nextBoard: BoardCell[][];
    nextSubmittedPositions: Set<string> | null;
    moves: BatchMove[];
    sourceKeys: Set<string>;
    targetKeys: Set<string>;
    movingSubmittedKeys: Set<string>;
    movingSubmittedTargetKeys: Set<string>;
    baselineNeighbors: Map<CellKey, Set<CellKey>> | null;
    hasDuplicateEndpoints: boolean;
};
export type FloatGroupMember = {
    tileId: string;
    row: number;
    col: number;
    cell: Exclude<BoardCell, {
        kind: 'empty';
    }>;
};
export type FloatGroupState = {
    baseMembers: FloatGroupMember[];
    anchorRow: number;
    anchorCol: number;
    orientation: 'base' | 'alternate';
    floatRow: number;
    floatCol: number;
};
const ORTHOGONAL_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
export function deriveSubmittedNeighborsFromKey(fromKey: string, submittedPositions: Set<string> | null): Set<string> {
    const neighbors = new Set<string>();
    if (!submittedPositions)
        return neighbors;
    const pos = parsePositionKey(fromKey);
    if (!pos)
        return neighbors;
    for (const [dr, dc] of ORTHOGONAL_DIRS) {
        const neighborKey = positionKey(pos.row + dr, pos.col + dc);
        if (submittedPositions.has(neighborKey))
            neighbors.add(neighborKey);
    }
    return neighbors;
}
export function buildBatchMoveContext(board: BoardCell[][], submittedPositions: Set<CellKey> | null, submittedWords: readonly string[] | null, moves: BatchMove[], baselineNeighbors?: Map<CellKey, Set<CellKey>> | null, submittedBentWordPositions?: Set<string> | null, submittedChainWords?: readonly SurfFixWord[] | null): BatchMoveValidationContext {
    const sourceKeys = new Set<CellKey>();
    const targetKeys = new Set<CellKey>();
    let hasDuplicateEndpoints = false;
    const movingSubmittedKeys = new Set<CellKey>();
    const movingSubmittedTargetKeys = new Set<CellKey>();
    const movingCells: Array<BatchMove & {
        cell: Exclude<BoardCell, {
            kind: 'empty';
        }>;
    }> = [];
    for (const move of moves) {
        const fromKey = positionKey(move.fromRow, move.fromCol);
        const toKey = positionKey(move.toRow, move.toCol);
        if (move.fromRow >= 0) {
            if (sourceKeys.has(fromKey))
                hasDuplicateEndpoints = true;
            sourceKeys.add(fromKey);
        }
        if (targetKeys.has(toKey))
            hasDuplicateEndpoints = true;
        targetKeys.add(toKey);
        if (move.fromRow >= 0) {
            const cell = board[move.fromRow]?.[move.fromCol];
            if (cell && cell.kind !== 'empty') {
                movingCells.push({ ...move, cell });
                if (submittedPositions?.has(fromKey)) {
                    movingSubmittedKeys.add(fromKey);
                    movingSubmittedTargetKeys.add(toKey);
                }
            }
        }
    }
    const nextBoard = board.map((row) => row.slice());
    for (const m of movingCells)
        nextBoard[m.fromRow][m.fromCol] = { kind: 'empty' };
    for (const m of movingCells)
        nextBoard[m.toRow][m.toCol] = m.cell;
    let nextSubmittedPositions = submittedPositions;
    if (submittedPositions && movingSubmittedKeys.size > 0) {
        const updated = new Set(submittedPositions);
        for (const m of movingCells) {
            const fromKey = positionKey(m.fromRow, m.fromCol);
            if (!movingSubmittedKeys.has(fromKey))
                continue;
            updated.delete(fromKey);
        }
        for (const m of movingCells) {
            const fromKey = positionKey(m.fromRow, m.fromCol);
            if (!movingSubmittedKeys.has(fromKey))
                continue;
            updated.add(positionKey(m.toRow, m.toCol));
        }
        nextSubmittedPositions = updated;
    }
    return {
        board,
        submittedPositions,
        submittedBentWordPositions: submittedBentWordPositions ?? null,
        submittedChainWords: submittedChainWords ?? null,
        submittedWords: submittedWords ?? null,
        nextBoard,
        nextSubmittedPositions,
        moves,
        sourceKeys,
        targetKeys,
        movingSubmittedKeys,
        movingSubmittedTargetKeys,
        baselineNeighbors: baselineNeighbors ?? null,
        hasDuplicateEndpoints,
    };
}
export function snapshotBaselineNeighbors(submittedPositions: Set<CellKey> | null, movingFromKeys: Set<CellKey>): Map<CellKey, Set<CellKey>> {
    const result = new Map<CellKey, Set<CellKey>>();
    if (!submittedPositions || movingFromKeys.size === 0)
        return result;
    for (const fromKey of movingFromKeys) {
        if (!submittedPositions.has(fromKey))
            continue;
        const pos = parsePositionKey(fromKey);
        if (!pos)
            continue;
        const neighbors = new Set<CellKey>();
        for (const [dr, dc] of ORTHOGONAL_DIRS) {
            const nKey = positionKey(pos.row + dr, pos.col + dc);
            if (submittedPositions.has(nKey))
                neighbors.add(nKey);
        }
        result.set(fromKey, neighbors);
    }
    return result;
}
export function evaluateMove(validateFn: (ctx: BatchMoveValidationContext) => EvaluationResult, ctx: BatchMoveValidationContext): EvaluationResult {
    if (ctx.moves.length === 0)
        return { ok: true };
    if (ctx.hasDuplicateEndpoints)
        return { ok: false };
    return validateFn(ctx);
}
