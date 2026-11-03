import type { BoardCell } from '@/lib/game-store';
import { activeWordLedgerWords } from '@/lib/modes/shared/word-ledger';
import type { SurfFixWord, SurfFixWordSnapshot } from '@/lib/modes/shared/word-ledger-types';
import type { PlayedWordEntry } from '@/lib/presentation/round-word-pills';
import { positionKey } from '@/lib/util/position-key';
import { surfFixTileIdForCell } from './adapter';
export type SurfFixWordHighlightEntry = Pick<PlayedWordEntry, 'word' | 'round' | 'highlightTileIds' | 'highlightPositions'>;
export function getSurfFixWordHighlightCellKeys(input: {
    entry: SurfFixWordHighlightEntry;
    chainWords: readonly SurfFixWord[];
    board?: BoardCell[][];
}): Set<string> {
    const explicitKeys = explicitHighlightCellKeys(input.entry, input.board);
    if (explicitKeys)
        return explicitKeys;
    const activeWord = activeWordLedgerWords(input.chainWords).find((word) => matchesEntry(word, input.entry));
    if (activeWord)
        return highlightCellsForWord(activeWord, input.board);
    const ledgerWord = findLedgerWord(input.chainWords, input.entry);
    if (!ledgerWord)
        return new Set();
    return highlightCellsForWord(ledgerWord, input.board);
}
function explicitHighlightCellKeys(entry: SurfFixWordHighlightEntry, board: BoardCell[][] | undefined): Set<string> | null {
    if (entry.highlightTileIds && entry.highlightTileIds.length > 0 && board) {
        const tileKeys = currentBoardCellsForTileIds(board, entry.highlightTileIds);
        if (tileKeys.size === entry.highlightTileIds.length)
            return tileKeys;
    }
    if (entry.highlightPositions && entry.highlightPositions.length > 0) {
        return new Set(entry.highlightPositions.map((pos) => positionKey(pos.row, pos.col)));
    }
    return null;
}
function findLedgerWord(chainWords: readonly SurfFixWord[], entry: SurfFixWordHighlightEntry): SurfFixWordSnapshot | null {
    for (const word of chainWords) {
        if (matchesEntry(word, entry))
            return word;
        const historyMatch = word.history.find((snapshot) => matchesEntry(snapshot, entry));
        if (historyMatch)
            return historyMatch;
    }
    return null;
}
function matchesEntry(word: SurfFixWordSnapshot, entry: SurfFixWordHighlightEntry): boolean {
    return word.roundCreated === entry.round && word.text.toUpperCase() === entry.word.toUpperCase();
}
function highlightCellsForWord(word: SurfFixWordSnapshot, board: BoardCell[][] | undefined): Set<string> {
    if (board)
        return currentBoardCellsForTileIds(board, word.orderedTileIds);
    return new Set(word.shape.cells.map((cell) => positionKey(cell.row, cell.col)));
}
function currentBoardCellsForTileIds(board: BoardCell[][], tileIds: readonly string[]): Set<string> {
    const wanted = new Set(tileIds);
    const found = new Map<string, string>();
    for (let row = 0; row < board.length; row += 1) {
        for (let col = 0; col < (board[row]?.length ?? 0); col += 1) {
            const cell = board[row]?.[col];
            if (!cell || cell.kind === 'empty')
                continue;
            const tileId = surfFixTileIdForCell(cell, { row, col });
            if (wanted.has(tileId))
                found.set(tileId, positionKey(row, col));
        }
    }
    if (found.size !== wanted.size)
        return new Set();
    return new Set(tileIds.flatMap((tileId) => found.get(tileId) ?? []));
}
