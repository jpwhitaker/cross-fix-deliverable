import type { BoardCell } from '@/lib/game-store';
import type { ExtractedWord } from '@/lib/dictionary';
import { cellLetters, isValidWord } from '@/lib/dictionary';
import { positionKey } from '@/lib/util/position-key';
type Pos = {
    row: number;
    col: number;
};
type ArmResult = {
    kind: 'present';
    cells: Pos[];
} | {
    kind: 'absent';
};
function inBounds(board: BoardCell[][], r: number, c: number): boolean {
    return r >= 0 && r < board.length && c >= 0 && c < (board[0]?.length ?? 0);
}
function traceArm(board: BoardCell[][], r: number, c: number, dr: number, dc: number): ArmResult {
    const cells: Pos[] = [];
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(board, nr, nc)) {
        const cell = board[nr][nc];
        if (cell.kind === 'empty' || cell.kind === 'surfboard')
            break;
        cells.push({ row: nr, col: nc });
        nr += dr;
        nc += dc;
    }
    return cells.length > 0 ? { kind: 'present', cells } : { kind: 'absent' };
}
function comparePathReadingOrder(a: Pos[], b: Pos[]): number {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        if (a[i].row !== b[i].row)
            return a[i].row - b[i].row;
        if (a[i].col !== b[i].col)
            return a[i].col - b[i].col;
    }
    return a.length - b.length;
}
export function extractBentWords(board: BoardCell[][]): ExtractedWord[] {
    const rows = board.length;
    const cols = board[0]?.length ?? 0;
    const claimedSurfboards = new Set<string>();
    const words: ExtractedWord[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = board[r][c];
            if (cell.kind !== 'surfboard')
                continue;
            const key = positionKey(r, c);
            if (claimedSurfboards.has(key))
                continue;
            const left = traceArm(board, r, c, 0, -1);
            const right = traceArm(board, r, c, 0, +1);
            const up = traceArm(board, r, c, -1, 0);
            const down = traceArm(board, r, c, +1, 0);
            const hArms = [left, right].filter((a): a is {
                kind: 'present';
                cells: Pos[];
            } => a.kind === 'present');
            const vArms = [up, down].filter((a): a is {
                kind: 'present';
                cells: Pos[];
            } => a.kind === 'present');
            if (hArms.length + vArms.length > 2)
                continue;
            if (hArms.length !== 1 || vArms.length !== 1)
                continue;
            const hArm = hArms[0].cells;
            const vArm = vArms[0].cells;
            const pivot = { row: r, col: c };
            const horizontalFirst = [...hArm].reverse();
            const verticalFirst = [...vArm].reverse();
            const pathA = [...horizontalFirst, pivot, ...vArm];
            const pathB = [...verticalFirst, pivot, ...hArm];
            const positions = comparePathReadingOrder(pathA, pathB) <= 0 ? pathA : pathB;
            let word = '';
            let letterCount = 0;
            for (const pos of positions) {
                const posCell = board[pos.row][pos.col];
                const letters = cellLetters(posCell, '-');
                word += letters;
                letterCount += posCell.kind === 'surfboard' ? 0 : letters.length;
            }
            if (letterCount >= 2) {
                words.push({ word, positions, valid: isValidWord(word), letterCount });
                claimedSurfboards.add(key);
            }
        }
    }
    return words;
}
