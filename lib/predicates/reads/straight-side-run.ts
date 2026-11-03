type Cell = {
    row: number;
    col: number;
};
export const readCellKey = (cell: Cell) => `${cell.row},${cell.col}`;
export function readEdgeKey(a: Cell, b: Cell): string {
    return [readCellKey(a), readCellKey(b)].sort().join('|');
}
export function isStraightSideSequence(cells: readonly Cell[]): boolean {
    if (cells.length < 2)
        return false;
    const dr = cells[1].row - cells[0].row;
    const dc = cells[1].col - cells[0].col;
    return Math.abs(dr) + Math.abs(dc) === 1 && cells.every((cell, index) => index === 0
        || (cell.row - cells[index - 1].row === dr && cell.col - cells[index - 1].col === dc));
}
export function straightSideRun<T extends {
    cell: Cell;
}>(a: T, b: T, occupants: ReadonlyMap<string, T>, wordEdges: ReadonlySet<string>): T[] {
    const rowStep = Math.sign(b.cell.row - a.cell.row);
    const colStep = Math.sign(b.cell.col - a.cell.col);
    if (Math.abs(b.cell.row - a.cell.row) + Math.abs(b.cell.col - a.cell.col) !== 1)
        return [];
    if (wordEdges.has(readEdgeKey(a.cell, b.cell)))
        return [];
    const run = [a, b];
    for (const sign of [-1, 1] as const) {
        let current = sign === -1 ? a : b;
        while (true) {
            const cell = { row: current.cell.row + sign * rowStep, col: current.cell.col + sign * colStep };
            const next = occupants.get(readCellKey(cell));
            if (!next || wordEdges.has(readEdgeKey(current.cell, cell)))
                break;
            if (sign === -1)
                run.unshift(next);
            else
                run.push(next);
            current = next;
        }
    }
    return rowStep < 0 || colStep < 0 ? run.reverse() : run;
}
