import { acceptedAs, isSbs } from '@/lib/surf-fix-rules/dictionary/acceptance';
import { straightSideRun } from '@/lib/predicates/reads/straight-side-run';
import { cellKey, stepCell } from '@/lib/surf-fix-rules/frontier/word-frontier';
import { forEachSubmittedWordCell } from '@/lib/surf-fix-rules/game/submitted-word-cells';
import type { Direction, Pos, SubmittedWord, TileRegistry } from '@/lib/surf-fix-rules/game/types';
export type SbsSideContactTile = {
    tileId: string;
    cell: Pos;
};
export type SbsSubmitPath = {
    tileIds: readonly string[];
    cells: readonly Pos[];
};
export type SbsSideContact = {
    text: string;
    cells: Pos[];
    tileIds: string[];
    direction: 'horizontal' | 'vertical';
    submittedWordIds: string[];
    preCell: Pos;
    postCell: Pos;
    prePostStatus: 'clear' | 'pre-occupied' | 'post-occupied';
};
export type SbsSideContactRejectionReason = 'not-in-sbs-list' | 'sbs-pre-space-occupied' | 'sbs-post-space-occupied';
const DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left'];
export function isAcceptedSbsSideContact(contact: SbsSideContact): boolean {
    return sbsSideContactRejectionReason(contact) === undefined;
}
export function sbsSideContactRejectionReason(contact: SbsSideContact): SbsSideContactRejectionReason | undefined {
    const letters = contact.text.replace(/-/g, '').length;
    if (letters === 2 ? !isSbs(contact.text) : acceptedAs(contact.text) === null)
        return 'not-in-sbs-list';
    if (contact.prePostStatus === 'pre-occupied')
        return 'sbs-pre-space-occupied';
    if (contact.prePostStatus === 'post-occupied')
        return 'sbs-post-space-occupied';
    return undefined;
}
export function discoverSbsSideContacts(input: {
    words: readonly SubmittedWord[];
    tiles: TileRegistry;
    placedTiles: readonly SbsSideContactTile[];
    submitPaths: readonly SbsSubmitPath[];
}): SbsSideContact[] {
    const submittedByCell = new Map<string, {
        word: SubmittedWord;
        tileId: string;
        cell: Pos;
    }>();
    const occupiedCells = new Set<string>();
    forEachSubmittedWordCell(input.words, ({ word, cell, tileId }) => {
        submittedByCell.set(cellKey(cell), { word, tileId, cell });
        occupiedCells.add(cellKey(cell));
    });
    for (const placed of input.placedTiles) {
        occupiedCells.add(cellKey(placed.cell));
    }
    const pathEdges = new Set(input.submitPaths.flatMap(pathEdgeKeys));
    const wordEdges = new Set([...pathEdges, ...input.words.flatMap((word) => pathEdgeKeys({ cells: word.shape.cells, tileIds: word.orderedTileIds }))]);
    const occupants = new Map<string, {
        cell: Pos;
        tileId: string;
        letter: string;
    }>();
    for (const entry of [...submittedByCell.values(), ...input.placedTiles]) {
        const tile = input.tiles[entry.tileId];
        if (tile)
            occupants.set(cellKey(entry.cell), { cell: entry.cell, tileId: entry.tileId, letter: tile.letter });
    }
    const contacts: SbsSideContact[] = [];
    const seen = new Set<string>();
    for (const placed of input.placedTiles) {
        const placedTile = input.tiles[placed.tileId];
        if (!placedTile)
            continue;
        for (const direction of DIRECTIONS) {
            const neighborCell = stepCell(placed.cell, direction);
            const submitted = submittedByCell.get(cellKey(neighborCell));
            if (!submitted)
                continue;
            if (submitted.tileId === placed.tileId && sameCell(submitted.cell, placed.cell))
                continue;
            if (pathEdges.has(edgeKey(placed.cell, neighborCell)))
                continue;
            const submittedTile = input.tiles[submitted.tileId];
            if (!submittedTile)
                continue;
            const run = straightSideRun({ tileId: placed.tileId, cell: placed.cell, letter: placedTile.letter }, {
                tileId: submitted.tileId,
                cell: submitted.cell,
                letter: submittedTile.letter,
            }, occupants, wordEdges);
            if (run.length < 2)
                continue;
            const ordered = { text: run.map((tile) => tile.letter).join(''), cells: run.map((tile) => ({ ...tile.cell })), tileIds: run.map((tile) => tile.tileId),
                direction: run[0].cell.row === run[1].cell.row ? 'horizontal' as const : 'vertical' as const };
            const key = ordered.tileIds.join('|');
            if (seen.has(key))
                continue;
            seen.add(key);
            contacts.push({
                text: ordered.text,
                cells: ordered.cells,
                tileIds: ordered.tileIds,
                direction: ordered.direction,
                submittedWordIds: unique(run.flatMap((tile) => input.words.filter((word) => word.orderedTileIds.includes(tile.tileId)).map((word) => word.id))),
                ...derivePrePostSpace(ordered.cells, ordered.direction, occupiedCells),
            });
        }
    }
    return contacts.sort((a, b) => cellKey(a.cells[0]).localeCompare(cellKey(b.cells[0])) || a.text.localeCompare(b.text));
}
export function discoverSubmittedSbsSideContacts(input: {
    words: readonly SubmittedWord[];
    tiles: TileRegistry;
}): SbsSideContact[] {
    const placedTiles: SbsSideContactTile[] = [];
    forEachSubmittedWordCell(input.words, ({ cell, tileId }) => placedTiles.push({ cell, tileId }));
    return discoverSbsSideContacts({
        ...input,
        placedTiles,
        submitPaths: input.words.map((word) => ({ cells: word.shape.cells, tileIds: word.orderedTileIds })),
    });
}
function pathEdgeKeys(path: SbsSubmitPath): string[] {
    const keys: string[] = [];
    for (let index = 0; index < path.cells.length - 1; index += 1) {
        const current = path.cells[index];
        const next = path.cells[index + 1];
        if (!current || !next)
            continue;
        keys.push(edgeKey(current, next));
    }
    return keys;
}
function edgeKey(a: Pos, b: Pos): string {
    const aKey = cellKey(a);
    const bKey = cellKey(b);
    return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
}
function derivePrePostSpace(cells: readonly Pos[], direction: 'horizontal' | 'vertical', occupiedCells: ReadonlySet<string>): {
    preCell: Pos;
    postCell: Pos;
    prePostStatus: SbsSideContact['prePostStatus'];
} {
    const first = cells[0];
    const second = cells[cells.length - 1];
    const preCell = direction === 'horizontal'
        ? { row: first.row, col: first.col - 1 }
        : { row: first.row - 1, col: first.col };
    const postCell = direction === 'horizontal'
        ? { row: second.row, col: second.col + 1 }
        : { row: second.row + 1, col: second.col };
    if (occupiedCells.has(cellKey(preCell))) {
        return { preCell, postCell, prePostStatus: 'pre-occupied' };
    }
    if (occupiedCells.has(cellKey(postCell))) {
        return { preCell, postCell, prePostStatus: 'post-occupied' };
    }
    return { preCell, postCell, prePostStatus: 'clear' };
}
function sameCell(a: Pos, b: Pos): boolean {
    return a.row === b.row && a.col === b.col;
}
function unique<T>(values: readonly T[]): T[] {
    return [...new Set(values)];
}
