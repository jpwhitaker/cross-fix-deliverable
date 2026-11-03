import type { Pos, SubmittedWord } from './types';
export type SubmittedWordCell = {
    word: SubmittedWord;
    index: number;
    cell: Pos;
    tileId: string;
    letter?: string;
};
export function forEachSubmittedWordCell(words: readonly SubmittedWord[], visit: (entry: SubmittedWordCell) => void): void {
    for (const word of words) {
        for (let index = 0; index < word.shape.cells.length; index += 1) {
            const cell = word.shape.cells[index];
            const tileId = word.orderedTileIds[index];
            if (!cell || !tileId)
                continue;
            visit({
                word,
                index,
                cell,
                tileId,
                letter: word.tileTexts[index],
            });
        }
    }
}
