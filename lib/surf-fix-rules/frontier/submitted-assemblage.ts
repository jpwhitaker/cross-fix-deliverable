import { cellKey, deriveWordFrontier, type WordFrontier, type WordPort } from '@/lib/surf-fix-rules/frontier/word-frontier';
import type { Pos, SubmittedWord } from '@/lib/surf-fix-rules/game/types';
export type SubmittedTileMembership = {
    wordId: string;
    tileId: string;
    indexInWord: number;
    cell: Pos;
};
export type SubmittedCellOccupant = {
    wordId: string;
    tileId: string;
    indexInWord: number;
};
export type SubmittedAssemblage = {
    tileMemberships: Map<string, SubmittedTileMembership[]>;
    cellOccupancy: Map<string, SubmittedCellOccupant[]>;
    frontiersByWordId: Map<string, WordFrontier>;
};
export type AvailableWordFrontierOptions = {
    respectSharedOwnerBlockedFaces?: boolean;
};
export function deriveSubmittedAssemblage(words: readonly SubmittedWord[]): SubmittedAssemblage {
    const tileMemberships = new Map<string, SubmittedTileMembership[]>();
    const cellOccupancy = new Map<string, SubmittedCellOccupant[]>();
    const frontiersByWordId = new Map<string, WordFrontier>();
    for (const word of words) {
        frontiersByWordId.set(word.id, deriveWordFrontier(word));
        for (let index = 0; index < word.orderedTileIds.length; index += 1) {
            const tileId = word.orderedTileIds[index];
            const cell = word.shape.cells[index];
            if (!cell)
                continue;
            tileMemberships.set(tileId, [
                ...(tileMemberships.get(tileId) ?? []),
                {
                    wordId: word.id,
                    tileId,
                    indexInWord: index,
                    cell: { ...cell },
                },
            ]);
            cellOccupancy.set(cellKey(cell), [
                ...(cellOccupancy.get(cellKey(cell)) ?? []),
                {
                    wordId: word.id,
                    tileId,
                    indexInWord: index,
                },
            ]);
        }
    }
    return { tileMemberships, cellOccupancy, frontiersByWordId };
}
export function deriveAvailableWordFrontier(word: SubmittedWord, assemblage: SubmittedAssemblage, options: AvailableWordFrontierOptions = {}): WordFrontier {
    const rawFrontier = assemblage.frontiersByWordId.get(word.id) ?? deriveWordFrontier(word);
    const ports = rawFrontier.ports.filter((port) => isExternallyAvailablePort(word, port, assemblage, options));
    const portsByCell = new Map<string, WordPort[]>();
    for (const port of ports) {
        const key = cellKey(port.neighborCell);
        portsByCell.set(key, [...(portsByCell.get(key) ?? []), port]);
    }
    return {
        ...rawFrontier,
        ports,
        portsByCell,
    };
}
function isExternallyAvailablePort(word: SubmittedWord, port: WordPort, assemblage: SubmittedAssemblage, options: AvailableWordFrontierOptions): boolean {
    if ((assemblage.cellOccupancy.get(cellKey(port.neighborCell)) ?? []).length > 0)
        return false;
    if (port.effect === 'invalidate')
        return true;
    const anchorTileId = word.orderedTileIds[port.tileIndex];
    if (!anchorTileId)
        return false;
    if (port.affordance === 'pre' || port.affordance === 'post')
        return true;
    if (options.respectSharedOwnerBlockedFaces === false)
        return true;
    const ownerMemberships = assemblage.tileMemberships.get(anchorTileId) ?? [];
    return !ownerMemberships.some((membership) => ownerHasBlockedFace(membership.wordId, port, assemblage));
}
function ownerHasBlockedFace(wordId: string, port: WordPort, assemblage: SubmittedAssemblage): boolean {
    const ownerFrontier = assemblage.frontiersByWordId.get(wordId);
    return !!ownerFrontier?.ports.some((ownerPort) => (ownerPort.effect === 'invalidate'
        && sameCell(ownerPort.anchorCell, port.anchorCell)
        && ownerPort.direction === port.direction));
}
function sameCell(a: Pos, b: Pos): boolean {
    return a.row === b.row && a.col === b.col;
}
