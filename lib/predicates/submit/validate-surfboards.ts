import type { BoardCell } from '@/lib/game-store';
function inBounds(board: BoardCell[][], r: number, c: number): boolean {
    return r >= 0 && r < board.length && c >= 0 && c < (board[0]?.length ?? 0);
}
function hasArm(board: BoardCell[][], r: number, c: number, dr: number, dc: number): boolean {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(board, nr, nc))
        return false;
    const cell = board[nr][nc];
    return cell.kind !== 'empty' && cell.kind !== 'surfboard';
}
export function validateSurfboards(board: BoardCell[][]): 'surfboard-orphan' | 'surfboard-x-junction' | null {
    const rows = board.length;
    const cols = board[0]?.length ?? 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c].kind !== 'surfboard')
                continue;
            const hasLeft = hasArm(board, r, c, 0, -1);
            const hasRight = hasArm(board, r, c, 0, +1);
            const hasUp = hasArm(board, r, c, -1, 0);
            const hasDown = hasArm(board, r, c, +1, 0);
            const total = [hasLeft, hasRight, hasUp, hasDown].filter(Boolean).length;
            if (total > 2)
                return 'surfboard-x-junction';
            if (total < 2)
                return 'surfboard-orphan';
        }
    }
    return null;
}
