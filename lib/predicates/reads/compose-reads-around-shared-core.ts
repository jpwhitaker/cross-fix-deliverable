export type OrderedReadCell = {
    row: number;
    col: number;
};
export type OrderedReadShape = {
    tileIds: readonly string[];
    cells: readonly OrderedReadCell[];
};
export type SharedCoreReadComposition = OrderedReadShape & {
    leadingReadIndex: number;
    trailingReadIndex: number;
};
export function composeReadsAroundSharedCore(reads: readonly OrderedReadShape[], core: OrderedReadShape): SharedCoreReadComposition[] {
    if (!isWellFormed(core) || core.tileIds.length === 0)
        return [];
    const leadingReads: Array<{
        index: number;
        read: OrderedReadShape;
        coreStart: number;
    }> = [];
    const trailingReads: Array<{
        index: number;
        read: OrderedReadShape;
        coreStart: number;
    }> = [];
    reads.forEach((read, index) => {
        if (!isWellFormed(read))
            return;
        const coreStart = contiguousReadStart(read, core);
        if (coreStart === null)
            return;
        const coreEnd = coreStart + core.tileIds.length;
        if (coreStart > 0 && coreEnd === read.tileIds.length) {
            leadingReads.push({ index, read, coreStart });
        }
        if (coreStart === 0 && coreEnd < read.tileIds.length) {
            trailingReads.push({ index, read, coreStart });
        }
    });
    const compositions: SharedCoreReadComposition[] = [];
    const seen = new Set<string>();
    for (const leading of leadingReads) {
        for (const trailing of trailingReads) {
            if (leading.index === trailing.index)
                continue;
            const trailingSuffixStart = trailing.coreStart + core.tileIds.length;
            const tileIds = [
                ...leading.read.tileIds.slice(0, leading.coreStart),
                ...core.tileIds,
                ...trailing.read.tileIds.slice(trailingSuffixStart),
            ];
            const cells = [
                ...leading.read.cells.slice(0, leading.coreStart),
                ...core.cells,
                ...trailing.read.cells.slice(trailingSuffixStart),
            ].map(cloneCell);
            if (hasDuplicateValues(tileIds) || hasDuplicateCells(cells))
                continue;
            const key = JSON.stringify({ tileIds, cells });
            if (seen.has(key))
                continue;
            seen.add(key);
            compositions.push({
                leadingReadIndex: leading.index,
                trailingReadIndex: trailing.index,
                tileIds,
                cells,
            });
        }
    }
    return compositions;
}
function contiguousReadStart(read: OrderedReadShape, core: OrderedReadShape): number | null {
    if (core.tileIds.length > read.tileIds.length)
        return null;
    for (let start = 0; start <= read.tileIds.length - core.tileIds.length; start += 1) {
        const matches = core.tileIds.every((tileId, offset) => (read.tileIds[start + offset] === tileId
            && sameCell(read.cells[start + offset], core.cells[offset])));
        if (matches)
            return start;
    }
    return null;
}
function isWellFormed(read: OrderedReadShape): boolean {
    return read.tileIds.length === read.cells.length;
}
function hasDuplicateValues(values: readonly string[]): boolean {
    return new Set(values).size !== values.length;
}
function hasDuplicateCells(cells: readonly OrderedReadCell[]): boolean {
    return new Set(cells.map((cell) => `${cell.row}:${cell.col}`)).size !== cells.length;
}
function sameCell(a: OrderedReadCell | undefined, b: OrderedReadCell | undefined): boolean {
    return !!a && !!b && a.row === b.row && a.col === b.col;
}
function cloneCell(cell: OrderedReadCell): OrderedReadCell {
    return { row: cell.row, col: cell.col };
}
