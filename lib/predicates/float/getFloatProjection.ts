import type { BoardCell } from '@/lib/game-store';
import { positionKey, type BatchMove, type CellKey, type FloatGroupMember, type FloatGroupState, type EvaluationResult, } from '@/lib/modes/move-policy';
export type { CellKey };
export type FloatProjectionMember = FloatGroupMember;
export type FloatProjectionState = FloatGroupState;
export type ProjectedFloatMember = FloatGroupMember;
export type BuiltProjectedFloatMoves = {
    moves: BatchMove[];
    sourceKeys: Set<CellKey>;
    foundAllSources: boolean;
};
export type FloatProjectionResult = {
    projected: ProjectedFloatMember[];
    moves: BatchMove[];
    sourceKeys: Set<CellKey>;
    valid: boolean;
    invalidMemberIds: Set<string>;
};
export function getTopLeftProjectedAnchor(projectedMembers: Array<{
    row: number;
    col: number;
}>): {
    row: number;
    col: number;
} | null {
    if (projectedMembers.length === 0)
        return null;
    let best = projectedMembers[0];
    for (let i = 1; i < projectedMembers.length; i++) {
        const member = projectedMembers[i];
        if (member.row < best.row || (member.row === best.row && member.col < best.col))
            best = member;
    }
    return { row: best.row, col: best.col };
}
export function getProjectedFloatMembers(floatState: FloatProjectionState): ProjectedFloatMember[] {
    let minR = Infinity;
    let maxR = -Infinity;
    let minC = Infinity;
    let maxC = -Infinity;
    floatState.baseMembers.forEach((m) => {
        if (m.row < minR)
            minR = m.row;
        if (m.row > maxR)
            maxR = m.row;
        if (m.col < minC)
            minC = m.col;
        if (m.col > maxC)
            maxC = m.col;
    });
    const isVertical = (maxR - minR) > (maxC - minC);
    return floatState.baseMembers.map((m) => {
        const dr = m.row - floatState.anchorRow;
        const dc = m.col - floatState.anchorCol;
        let rotatedDr = dr;
        let rotatedDc = dc;
        if (floatState.orientation === 'alternate') {
            if (isVertical) {
                rotatedDr = -dc;
                rotatedDc = dr;
            }
            else {
                rotatedDr = dc;
                rotatedDc = -dr;
            }
        }
        return {
            ...m,
            row: floatState.floatRow + rotatedDr,
            col: floatState.floatCol + rotatedDc,
        };
    });
}
export function getProjectedFloatKeys(projectedMembers: ProjectedFloatMember[]): Set<CellKey> {
    return new Set(projectedMembers.map((member) => positionKey(member.row, member.col)));
}
export function buildProjectedFloatMoves(board: BoardCell[][], floatState: FloatProjectionState, projectedMembers: ProjectedFloatMember[]): BuiltProjectedFloatMoves {
    const sourceIds = new Set(floatState.baseMembers.map((m) => m.tileId));
    const fallbackMoves = projectedMembers.map((m, i) => {
        const base = floatState.baseMembers[i];
        return {
            fromRow: base?.row ?? m.row,
            fromCol: base?.col ?? m.col,
            toRow: m.row,
            toCol: m.col,
        };
    });
    const sourceKeys = new Set<CellKey>();
    const fromById = new Map<string, {
        row: number;
        col: number;
    }>();
    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < (board[row]?.length ?? 0); col++) {
            const cell = board[row][col];
            if (cell.kind === 'empty' || !cell.handTileId || !sourceIds.has(cell.handTileId))
                continue;
            sourceKeys.add(positionKey(row, col));
            fromById.set(cell.handTileId, { row, col });
        }
    }
    if (sourceKeys.size !== sourceIds.size) {
        return { moves: fallbackMoves, sourceKeys, foundAllSources: false };
    }
    const moves = projectedMembers.map((m) => {
        const from = fromById.get(m.tileId);
        if (!from) {
            return {
                fromRow: m.row,
                fromCol: m.col,
                toRow: m.row,
                toCol: m.col,
            };
        }
        return {
            fromRow: from.row,
            fromCol: from.col,
            toRow: m.row,
            toCol: m.col,
        };
    });
    return { moves, sourceKeys, foundAllSources: true };
}
export function getOutOfBoundsProjectedFloatKeys(moves: BatchMove[], rows: number, cols: number): Set<CellKey> {
    const keys = new Set<CellKey>();
    for (const move of moves) {
        if (move.toRow < 0 || move.toRow >= rows || move.toCol < 0 || move.toCol >= cols) {
            keys.add(positionKey(move.toRow, move.toCol));
        }
    }
    return keys;
}
export function getCollidingProjectedFloatKeys(board: BoardCell[][], moves: BatchMove[], sourceKeys: Set<CellKey>): Set<CellKey> {
    const keys = new Set<CellKey>();
    for (const move of moves) {
        const toCell = board[move.toRow]?.[move.toCol];
        const toKey = positionKey(move.toRow, move.toCol);
        if (!toCell)
            continue;
        if (toCell.kind !== 'empty' && !sourceKeys.has(toKey))
            keys.add(toKey);
    }
    return keys;
}
export function isFloatProjectionValid({ board, moves, sourceKeys, rows, cols, validateProjectedBatchMove, }: {
    board: BoardCell[][];
    moves: BatchMove[];
    sourceKeys: Set<CellKey>;
    rows: number;
    cols: number;
    validateProjectedBatchMove: (moves: BatchMove[]) => EvaluationResult;
}): boolean {
    if (moves.length === 0)
        return false;
    if (getOutOfBoundsProjectedFloatKeys(moves, rows, cols).size > 0)
        return false;
    if (getCollidingProjectedFloatKeys(board, moves, sourceKeys).size > 0)
        return false;
    return validateProjectedBatchMove(moves).ok;
}
export function getInvalidFloatMemberIds(baseMembers: FloatProjectionMember[], projectionValid: boolean): Set<string> {
    if (projectionValid)
        return new Set<string>();
    return new Set(baseMembers.map((m) => m.tileId));
}
export function getFloatProjection({ floatState, board, rows, cols, validateProjectedBatchMove, }: {
    floatState: FloatProjectionState;
    board: BoardCell[][];
    rows: number;
    cols: number;
    validateProjectedBatchMove: (moves: BatchMove[]) => EvaluationResult;
}): FloatProjectionResult {
    const projected = getProjectedFloatMembers(floatState);
    const { moves, sourceKeys, foundAllSources } = buildProjectedFloatMoves(board, floatState, projected);
    const valid = foundAllSources && isFloatProjectionValid({
        board,
        moves,
        sourceKeys,
        rows,
        cols,
        validateProjectedBatchMove,
    });
    const invalidMemberIds = getInvalidFloatMemberIds(floatState.baseMembers, valid);
    return { projected, moves, sourceKeys, valid, invalidMemberIds };
}
