type Cell = {
    row: number;
    col: number;
};
const key = (cell: Cell) => `${cell.row},${cell.col}`;
export function canShareInteriorEndpoint(word: readonly Cell[], index: number, neighbor: Cell, occupied: ReadonlySet<string>): boolean {
    const before = word[index - 1];
    const shared = word[index];
    const after = word[index + 1];
    if (!before || !shared || !after)
        return false;
    const rowStep = neighbor.row - shared.row;
    const colStep = neighbor.col - shared.col;
    if (Math.abs(rowStep) + Math.abs(colStep) !== 1)
        return false;
    const straight = after.row - shared.row === shared.row - before.row
        && after.col - shared.col === shared.col - before.col;
    const perpendicular = (after.row - shared.row) * rowStep + (after.col - shared.col) * colStep === 0;
    return straight && perpendicular
        && !occupied.has(key({ row: shared.row - rowStep, col: shared.col - colStep }));
}
