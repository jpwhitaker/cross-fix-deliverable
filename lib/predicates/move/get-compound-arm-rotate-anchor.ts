import { positionKey, parsePositionKey } from '@/lib/modes/move-policy';
type Board = Array<Array<{
    kind: string;
} | undefined>>;
type PivotAnchor = {
    pivotRow: number;
    pivotCol: number;
};
function inBounds(board: Board, row: number, col: number): boolean {
    return row >= 0 && row < board.length && col >= 0 && col < (board[0]?.length ?? 0);
}
function traceSubmittedArm(board: Board, pivotRow: number, pivotCol: number, dr: number, dc: number, submittedCompoundPositions: Set<string>): Set<string> {
    const keys = new Set<string>();
    let row = pivotRow + dr;
    let col = pivotCol + dc;
    while (inBounds(board, row, col)) {
        const cell = board[row]?.[col];
        const key = positionKey(row, col);
        if (!cell || cell.kind === 'empty' || cell.kind === 'surfboard')
            break;
        if (!submittedCompoundPositions.has(key))
            break;
        keys.add(key);
        row += dr;
        col += dc;
    }
    return keys;
}
function setEquals(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size)
        return false;
    for (const value of a) {
        if (!b.has(value))
            return false;
    }
    return true;
}
export function getCompoundArmRotateAnchor({ board, selectedPositions, submittedCompoundPositions, }: {
    board: Board;
    selectedPositions: Set<string>;
    submittedCompoundPositions: Set<string> | null | undefined;
}): PivotAnchor | null {
    if (selectedPositions.size < 2)
        return null;
    if (!submittedCompoundPositions || submittedCompoundPositions.size === 0)
        return null;
    const adjacentSurfboards = new Set<string>();
    const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
    ] as const;
    for (const key of selectedPositions) {
        if (!submittedCompoundPositions.has(key))
            return null;
        const pos = parsePositionKey(key);
        if (!pos)
            return null;
        const cell = board[pos.row]?.[pos.col];
        if (!cell || cell.kind === 'empty' || cell.kind === 'surfboard')
            return null;
        for (const [dr, dc] of dirs) {
            const neighborRow = pos.row + dr;
            const neighborCol = pos.col + dc;
            const neighbor = board[neighborRow]?.[neighborCol];
            if (!neighbor || neighbor.kind !== 'surfboard')
                continue;
            const neighborKey = positionKey(neighborRow, neighborCol);
            if (!submittedCompoundPositions.has(neighborKey))
                continue;
            adjacentSurfboards.add(neighborKey);
        }
    }
    if (adjacentSurfboards.size !== 1)
        return null;
    const pivotKey = adjacentSurfboards.values().next().value as string;
    const pivot = parsePositionKey(pivotKey);
    if (!pivot)
        return null;
    const candidateArms = [
        traceSubmittedArm(board, pivot.row, pivot.col, -1, 0, submittedCompoundPositions),
        traceSubmittedArm(board, pivot.row, pivot.col, 1, 0, submittedCompoundPositions),
        traceSubmittedArm(board, pivot.row, pivot.col, 0, -1, submittedCompoundPositions),
        traceSubmittedArm(board, pivot.row, pivot.col, 0, 1, submittedCompoundPositions),
    ].filter((arm) => arm.size > 0);
    if (candidateArms.length !== 2)
        return null;
    const matchingArmCount = candidateArms.filter((arm) => setEquals(arm, selectedPositions)).length;
    if (matchingArmCount !== 1)
        return null;
    return { pivotRow: pivot.row, pivotCol: pivot.col };
}
