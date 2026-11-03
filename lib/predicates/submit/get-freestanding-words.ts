import type { BoardCell } from '@/lib/game-store';
import { cellLetters } from '@/lib/dictionary';
import { positionKey } from '@/lib/util/position-key';
export type FreestandingWord = {
    word: string;
    positionKeys: Set<string>;
    componentId: number;
};
const ORTHOGONAL_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
function parseKey(key: string): [
    number,
    number
] | null {
    const [rowText, colText] = key.split('-');
    const row = Number(rowText);
    const col = Number(colText);
    if (!Number.isFinite(row) || !Number.isFinite(col))
        return null;
    return [row, col];
}
export function getSubmittedPositionComponents(submittedPositions: Set<string> | null): Set<string>[] {
    if (!submittedPositions || submittedPositions.size === 0)
        return [];
    const unvisited = new Set(submittedPositions);
    const components: Set<string>[] = [];
    while (unvisited.size > 0) {
        const start = unvisited.values().next().value as string;
        const component = new Set<string>();
        const queue = [start];
        unvisited.delete(start);
        component.add(start);
        while (queue.length > 0) {
            const key = queue.shift()!;
            const parsed = parseKey(key);
            if (!parsed)
                continue;
            const [row, col] = parsed;
            for (const [dr, dc] of ORTHOGONAL_DIRS) {
                const neighborKey = positionKey(row + dr, col + dc);
                if (!unvisited.has(neighborKey))
                    continue;
                unvisited.delete(neighborKey);
                component.add(neighborKey);
                queue.push(neighborKey);
            }
        }
        components.push(component);
    }
    return components;
}
export function getFreestandingWordsFromSubmittedComponents(board: BoardCell[][], submittedPositions: Set<string> | null, bentWordPositions?: Set<string> | null): FreestandingWord[] {
    const components = getSubmittedPositionComponents(submittedPositions);
    if (components.length === 0)
        return [];
    const results: FreestandingWord[] = [];
    const toOrderedWord = (component: Set<string>): string | null => {
        if (component.size < 2)
            return null;
        const coords: Array<{
            row: number;
            col: number;
        }> = [];
        for (const key of component) {
            const parsed = parseKey(key);
            if (!parsed)
                return null;
            coords.push({ row: parsed[0], col: parsed[1] });
        }
        const sameRow = coords.every((c) => c.row === coords[0].row);
        const sameCol = coords.every((c) => c.col === coords[0].col);
        if (!sameRow && !sameCol)
            return null;
        if (sameRow) {
            coords.sort((a, b) => a.col - b.col);
            for (let i = 1; i < coords.length; i++) {
                if (coords[i].col !== coords[i - 1].col + 1)
                    return null;
            }
        }
        else {
            coords.sort((a, b) => a.row - b.row);
            for (let i = 1; i < coords.length; i++) {
                if (coords[i].row !== coords[i - 1].row + 1)
                    return null;
            }
        }
        let word = '';
        for (const coord of coords) {
            const letters = cellLetters(board[coord.row]?.[coord.col] ?? { kind: 'empty' });
            if (!letters)
                return null;
            word += letters;
        }
        return word;
    };
    components.forEach((component, componentId) => {
        const word = toOrderedWord(component);
        if (word) {
            results.push({ word, positionKeys: new Set(component), componentId });
            return;
        }
        if (bentWordPositions && [...component].every((k) => bentWordPositions.has(k))) {
            results.push({ word: '<bent>', positionKeys: new Set(component), componentId });
        }
    });
    return results;
}
