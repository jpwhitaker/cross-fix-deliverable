type Cell = {
    row: number;
    col: number;
};
const same = (a: Cell, b: Cell) => a.row === b.row && a.col === b.col;
export function usesWordBoundaryEdge(read: readonly Cell[], word: readonly Cell[]): boolean {
    if (word.length < 2)
        return false;
    const ends = [[word[0], word[1]], [word[word.length - 1], word[word.length - 2]]];
    return ends.some(([end, inner]) => {
        const outside = { row: 2 * end.row - inner.row, col: 2 * end.col - inner.col };
        return read.some((cell, i) => i > 0 && ((same(read[i - 1], end) && same(cell, outside))
            || (same(read[i - 1], outside) && same(cell, end))));
    });
}
