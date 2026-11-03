import type { Pos, SubmittedWord } from '@/lib/surf-fix-rules/game/types';
export type StructuralWordShape = Pick<SubmittedWord, 'orderedTileIds' | 'shape'>;
export type StructuralReadShape = {
    tileIds: readonly string[];
    cells: readonly Pos[];
};
export function wordIsStructurallyConsumedBy(word: StructuralWordShape, newWord: StructuralWordShape): boolean {
    return readIsStructurallyConsumedBy(toStructuralRead(word), toStructuralRead(newWord));
}
export function readIsStructurallyConsumedBy(read: StructuralReadShape, container: StructuralReadShape): boolean {
    if (read.tileIds.length > container.tileIds.length)
        return false;
    for (let start = 0; start <= container.tileIds.length - read.tileIds.length; start += 1) {
        let matches = true;
        for (let offset = 0; offset < read.tileIds.length; offset += 1) {
            if (container.tileIds[start + offset] !== read.tileIds[offset]) {
                matches = false;
                break;
            }
            if (!sameCell(container.cells[start + offset], read.cells[offset])) {
                matches = false;
                break;
            }
        }
        if (matches)
            return true;
    }
    return false;
}
export function dropStructurallyContainedReads<T extends StructuralReadShape>(reads: readonly T[]): T[] {
    return reads.filter((read) => !reads.some((other) => (other !== read
        && other.tileIds.length > read.tileIds.length
        && readIsStructurallyConsumedBy(read, other))));
}
export function dropStructurallyContainedWords<T extends StructuralWordShape>(words: readonly T[]): T[] {
    return words.filter((word) => !words.some((other) => (other !== word
        && other.orderedTileIds.length > word.orderedTileIds.length
        && wordIsStructurallyConsumedBy(word, other))));
}
function toStructuralRead(word: StructuralWordShape): StructuralReadShape {
    return {
        tileIds: word.orderedTileIds,
        cells: word.shape.cells,
    };
}
function sameCell(a: Pos, b: Pos): boolean {
    return a.row === b.row && a.col === b.col;
}
