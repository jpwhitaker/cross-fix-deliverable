import type { Pos, SurfFixWord } from '@/lib/modes/shared/word-ledger-types';
import { activeWordLedgerWords } from '@/lib/modes/shared/word-ledger';
import { positionKey } from '@/lib/modes/move-policy';
export function getSurfFixPrePostHintKeys({ words, rows, cols, }: {
    words: readonly SurfFixWord[];
    rows: number;
    cols: number;
}): Set<string> {
    const keys = new Set<string>();
    for (const word of activeWordLedgerWords(words)) {
        addPrePostKeys(keys, word.shape.cells, rows, cols);
    }
    return keys;
}
export function getSurfFixPathEndHintKeys(cells: readonly Pos[], rows: number, cols: number): Set<string> {
    const keys = new Set<string>();
    addPrePostKeys(keys, cells, rows, cols);
    return keys;
}
function addPrePostKeys(keys: Set<string>, cells: readonly Pos[], rows: number, cols: number): void {
    if (cells.length < 2)
        return;
    const first = cells[0];
    const second = cells[1];
    const before = {
        row: first.row - (second.row - first.row),
        col: first.col - (second.col - first.col),
    };
    if (isInBounds(before.row, before.col, rows, cols))
        keys.add(positionKey(before.row, before.col));
    const last = cells[cells.length - 1];
    const prev = cells[cells.length - 2];
    const after = {
        row: last.row + (last.row - prev.row),
        col: last.col + (last.col - prev.col),
    };
    if (isInBounds(after.row, after.col, rows, cols))
        keys.add(positionKey(after.row, after.col));
}
function isInBounds(row: number, col: number, rows: number, cols: number): boolean {
    return row >= 0 && row < rows && col >= 0 && col < cols;
}
