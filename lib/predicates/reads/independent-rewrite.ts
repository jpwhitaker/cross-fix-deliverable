type Cell = {
    row: number;
    col: number;
};
type Read = {
    cells: readonly Cell[];
    tileIds: readonly string[];
};
const key = (cell: Cell) => `${cell.row},${cell.col}`;
export function shareIndependentRewriteEndpoint(ride: Read, rewrite: Read, occupied: ReadonlySet<string>): boolean {
    if (ride.cells.length < 2 || rewrite.cells.length < 2)
        return false;
    const shared = rewrite.tileIds.filter((id) => ride.tileIds.includes(id));
    if (shared.length !== 1)
        return false;
    const rewriteIndex = rewrite.tileIds.indexOf(shared[0]);
    if (rewriteIndex !== 0 && rewriteIndex !== rewrite.tileIds.length - 1)
        return false;
    const rideIndex = ride.tileIds.indexOf(shared[0]);
    const joint = rewrite.cells[rewriteIndex];
    if (key(joint) !== key(ride.cells[rideIndex]))
        return false;
    const neighbor = rewrite.cells[rewriteIndex === 0 ? 1 : rewriteIndex - 1];
    const axis = neighbor.row === joint.row ? 'row' : 'col';
    if ([ride.cells[rideIndex - 1], ride.cells[rideIndex + 1]]
        .some((cell) => cell && cell[axis] === joint[axis]))
        return false;
    return hasOpenReadEnds(ride, occupied) && hasOpenReadEnds(rewrite, occupied);
}
export function hasOpenReadEnds(read: Read, occupied: ReadonlySet<string>): boolean {
    if (read.cells.length < 2)
        return false;
    const first = read.cells[0];
    const second = read.cells[1];
    const last = read.cells[read.cells.length - 1];
    const previous = read.cells[read.cells.length - 2];
    return !occupied.has(key({ row: 2 * first.row - second.row, col: 2 * first.col - second.col }))
        && !occupied.has(key({ row: 2 * last.row - previous.row, col: 2 * last.col - previous.col }));
}
export function isSpliceOfIndependentReads(candidate: Read, ride: Read, rewrite: Read): boolean {
    const shared = rewrite.tileIds.filter(id => ride.tileIds.includes(id));
    if (shared.length !== 1)
        return false;
    const joint = ride.tileIds.indexOf(shared[0]);
    const combinations: Read[] = [];
    if (rewrite.tileIds.at(-1) === shared[0] && joint < ride.tileIds.length - 1)
        combinations.push({
            tileIds: [...rewrite.tileIds.slice(0, -1), ...ride.tileIds.slice(joint)],
            cells: [...rewrite.cells.slice(0, -1), ...ride.cells.slice(joint)],
        });
    if (rewrite.tileIds[0] === shared[0] && joint > 0)
        combinations.push({
            tileIds: [...ride.tileIds.slice(0, joint + 1), ...rewrite.tileIds.slice(1)],
            cells: [...ride.cells.slice(0, joint + 1), ...rewrite.cells.slice(1)],
        });
    return combinations.some(read => read.tileIds.length === candidate.tileIds.length
        && new Set(read.tileIds).size === read.tileIds.length
        && read.tileIds.every((id, index) => id === candidate.tileIds[index]
            && key(read.cells[index]) === key(candidate.cells[index])));
}
