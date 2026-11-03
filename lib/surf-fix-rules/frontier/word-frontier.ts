import type { Direction, Pos, SurfFixWord } from '@/lib/surf-fix-rules/game/types';
import { isStraightSideSequence } from '@/lib/predicates/reads/straight-side-run';
export type TileRole = 'start' | 'end' | 'straight-interior' | 'bend';
export type PortAffordance = 'pre' | 'post' | 'start-border' | 'end-border' | 'bend-entry' | 'bend-exit' | 'outer-edge' | 'blocked' | 'seed-open';
export type PortEffect = 'extend-start' | 'extend-end' | 'enter-interior' | 'exit-interior' | 'preserve-word' | 'invalidate' | 'start-word';
export type WordPort = {
    wordId: string;
    wordText: string;
    tileIndex: number;
    tileRole: TileRole;
    anchorCell: Pos;
    direction: Direction;
    neighborCell: Pos;
    affordance: PortAffordance;
    effect: PortEffect;
    reason?: string;
};
export type WordFrontier = {
    wordId: string;
    wordText: string;
    selfValid: true | {
        reason: string;
    };
    ports: WordPort[];
    portsByCell: Map<string, WordPort[]>;
};
export type PortJoin = {
    kind: 'empty';
} | {
    kind: 'blocked';
    ports: WordPort[];
    reasons: string[];
} | {
    kind: 'modifies-word';
    ports: WordPort[];
    effects: PortEffect[];
    ignoredPorts: WordPort[];
} | {
    kind: 'outer-edge-only';
    ports: WordPort[];
    ignoredPorts: WordPort[];
};
const DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left'];
export function deriveWordFrontier(word: SurfFixWord): WordFrontier {
    const selfValid = validateWordShape(word);
    const ports: WordPort[] = [];
    const occupied = new Set(word.shape.cells.map(cellKey));
    if ((word.ledgerKind ?? 'word') === 'sbs') {
        ports.push(...deriveSbsWordPorts(word, occupied));
        const portsByCell = portsByCellMap(ports);
        return {
            wordId: word.id,
            wordText: word.text,
            selfValid,
            ports,
            portsByCell,
        };
    }
    if (word.shape.cells.length === 1) {
        const anchorCell = word.shape.cells[0];
        for (const direction of DIRECTIONS) {
            ports.push({
                wordId: word.id,
                wordText: word.text,
                tileIndex: 0,
                tileRole: 'start',
                anchorCell: { ...anchorCell },
                direction,
                neighborCell: stepCell(anchorCell, direction),
                affordance: 'seed-open',
                effect: 'start-word',
            });
        }
    }
    if (word.shape.cells.length > 1) {
        for (let index = 0; index < word.shape.cells.length; index += 1) {
            const current = word.shape.cells[index];
            const prev = word.shape.cells[index - 1];
            const next = word.shape.cells[index + 1];
            const prevDir = prev ? stepDir(prev, current) : null;
            const nextDir = next ? stepDir(current, next) : null;
            const role = getTileRole(index, word.shape.cells);
            for (const direction of DIRECTIONS) {
                const neighborCell = stepCell(current, direction);
                if (occupied.has(cellKey(neighborCell)))
                    continue;
                ports.push(...derivePortsForFace({ word, tileIndex: index, tileRole: role, anchorCell: current, direction, neighborCell, prevDir, nextDir }));
            }
        }
    }
    const portsByCell = portsByCellMap(ports);
    return {
        wordId: word.id,
        wordText: word.text,
        selfValid,
        ports,
        portsByCell,
    };
}
function deriveSbsWordPorts(word: SurfFixWord, occupied: ReadonlySet<string>): WordPort[] {
    const first = word.shape.cells[0];
    const second = word.shape.cells[1];
    if (!first || !second)
        return [];
    const pathDirection = stepDir(first, second);
    if (!pathDirection)
        return [];
    const ports: WordPort[] = [];
    for (let index = 0; index < word.shape.cells.length; index += 1) {
        const anchorCell = word.shape.cells[index];
        const tileRole: TileRole = index === 0 ? 'start' : index === word.shape.cells.length - 1 ? 'end' : 'straight-interior';
        for (const direction of DIRECTIONS) {
            const neighborCell = stepCell(anchorCell, direction);
            if (occupied.has(cellKey(neighborCell)))
                continue;
            if (index === 0 && direction === oppositeDir(pathDirection)) {
                ports.push(wordPort({ word, tileIndex: index, tileRole, anchorCell, direction, neighborCell, affordance: 'pre', effect: 'extend-start' }));
            }
            else if (index === word.shape.cells.length - 1 && direction === pathDirection) {
                ports.push(wordPort({ word, tileIndex: index, tileRole, anchorCell, direction, neighborCell, affordance: 'post', effect: 'extend-end' }));
            }
            else {
                ports.push(wordPort({ word, tileIndex: index, tileRole, anchorCell, direction, neighborCell, affordance: 'blocked', effect: 'invalidate', reason: 'sbs-side' }));
            }
        }
    }
    return ports;
}
function portsByCellMap(ports: readonly WordPort[]): Map<string, WordPort[]> {
    const portsByCell = new Map<string, WordPort[]>();
    for (const port of ports) {
        const key = cellKey(port.neighborCell);
        portsByCell.set(key, [...(portsByCell.get(key) ?? []), port]);
    }
    return portsByCell;
}
function wordPort(input: {
    word: SurfFixWord;
    tileIndex: number;
    tileRole: TileRole;
    anchorCell: Pos;
    direction: Direction;
    neighborCell: Pos;
    affordance: PortAffordance;
    effect: PortEffect;
    reason?: string;
}): WordPort {
    return {
        wordId: input.word.id,
        wordText: input.word.text,
        tileIndex: input.tileIndex,
        tileRole: input.tileRole,
        anchorCell: { ...input.anchorCell },
        direction: input.direction,
        neighborCell: { ...input.neighborCell },
        affordance: input.affordance,
        effect: input.effect,
        reason: input.reason,
    };
}
export function joinWordPorts(ports: readonly WordPort[]): PortJoin {
    if (ports.length === 0)
        return { kind: 'empty' };
    const activePorts = ports.filter((port) => port.affordance !== 'blocked');
    const blockedPorts = ports.filter((port) => port.affordance === 'blocked' || port.effect === 'invalidate');
    const modifying = activePorts.filter((port) => port.effect !== 'preserve-word');
    if (modifying.length > 0) {
        return {
            kind: 'modifies-word',
            ports: modifying,
            effects: unique(modifying.map((port) => port.effect)),
            ignoredPorts: blockedPorts,
        };
    }
    const outerEdge = activePorts.filter((port) => port.effect === 'preserve-word');
    if (outerEdge.length > 0) {
        return {
            kind: 'outer-edge-only',
            ports: outerEdge,
            ignoredPorts: blockedPorts,
        };
    }
    return {
        kind: 'blocked',
        ports: [...ports],
        reasons: blockedPorts.map((port) => port.reason ?? port.affordance),
    };
}
export function cellKey(pos: Pos): string {
    return `${pos.row},${pos.col}`;
}
export function stepCell(pos: Pos, direction: Direction): Pos {
    switch (direction) {
        case 'up':
            return { row: pos.row - 1, col: pos.col };
        case 'right':
            return { row: pos.row, col: pos.col + 1 };
        case 'down':
            return { row: pos.row + 1, col: pos.col };
        case 'left':
            return { row: pos.row, col: pos.col - 1 };
    }
}
function derivePortsForFace(input: {
    word: SurfFixWord;
    tileIndex: number;
    tileRole: TileRole;
    anchorCell: Pos;
    direction: Direction;
    neighborCell: Pos;
    prevDir: Direction | null;
    nextDir: Direction | null;
}): WordPort[] {
    const ports: WordPort[] = [];
    const add = (affordance: PortAffordance, effect: PortEffect, reason?: string) => {
        ports.push({
            wordId: input.word.id,
            wordText: input.word.text,
            tileIndex: input.tileIndex,
            tileRole: input.tileRole,
            anchorCell: { ...input.anchorCell },
            direction: input.direction,
            neighborCell: { ...input.neighborCell },
            affordance,
            effect,
            reason,
        });
    };
    if (input.tileIndex === 0) {
        if (input.nextDir && input.direction === oppositeDir(input.nextDir))
            add('pre', 'extend-start');
        if (isStartBorder(input.direction))
            add('start-border', 'extend-start');
        if (ports.length === 0)
            add('outer-edge', 'preserve-word');
        return ports;
    }
    if (input.tileIndex === input.word.shape.cells.length - 1) {
        if (input.prevDir && input.direction === input.prevDir)
            add('post', 'extend-end');
        if (isEndBorder(input.direction))
            add('end-border', 'extend-end');
        if (ports.length === 0)
            add('outer-edge', 'preserve-word');
        return ports;
    }
    if (input.tileRole === 'bend' && input.prevDir && input.nextDir) {
        if (input.direction === oppositeDir(input.nextDir))
            add('bend-entry', 'enter-interior');
        if (input.direction === input.prevDir)
            add('bend-exit', 'exit-interior');
        if (ports.length === 0)
            add('blocked', 'invalidate', 'inside-bend-corner');
        return ports;
    }
    add('blocked', 'invalidate', 'straight-interior-side');
    return ports;
}
function validateWordShape(word: SurfFixWord): true | {
    reason: string;
} {
    if (word.orderedTileIds.length !== word.shape.cells.length)
        return { reason: 'tile-shape-length-mismatch' };
    if (word.tileTexts.length !== word.shape.cells.length)
        return { reason: 'tile-text-shape-length-mismatch' };
    if (word.text !== word.tileTexts.join(''))
        return { reason: 'text-tile-texts-mismatch' };
    if (word.shape.cells.length < 1)
        return { reason: 'word-needs-at-least-one-cell' };
    if ((word.ledgerKind ?? 'word') === 'sbs' && word.shape.cells.length < 2)
        return { reason: 'sbs-word-needs-two-cells' };
    if ((word.ledgerKind ?? 'word') === 'sbs' && !isStraightSideSequence(word.shape.cells))
        return { reason: 'sbs-word-needs-straight-run' };
    const seen = new Set<string>();
    for (let index = 0; index < word.shape.cells.length; index += 1) {
        const current = word.shape.cells[index];
        const key = cellKey(current);
        if (seen.has(key))
            return { reason: 'shape-self-overlap' };
        seen.add(key);
        const next = word.shape.cells[index + 1];
        if (next && !stepDir(current, next))
            return { reason: 'non-cardinal-step' };
    }
    return true;
}
function getTileRole(index: number, cells: readonly Pos[]): TileRole {
    if (index === 0)
        return 'start';
    if (index === cells.length - 1)
        return 'end';
    const prev = cells[index - 1];
    const current = cells[index];
    const next = cells[index + 1];
    const prevDir = stepDir(prev, current);
    const nextDir = stepDir(current, next);
    return prevDir && nextDir && prevDir !== nextDir ? 'bend' : 'straight-interior';
}
function stepDir(from: Pos, to: Pos): Direction | null {
    const rowDelta = to.row - from.row;
    const colDelta = to.col - from.col;
    if (rowDelta === -1 && colDelta === 0)
        return 'up';
    if (rowDelta === 0 && colDelta === 1)
        return 'right';
    if (rowDelta === 1 && colDelta === 0)
        return 'down';
    if (rowDelta === 0 && colDelta === -1)
        return 'left';
    return null;
}
function oppositeDir(direction: Direction): Direction {
    switch (direction) {
        case 'up':
            return 'down';
        case 'right':
            return 'left';
        case 'down':
            return 'up';
        case 'left':
            return 'right';
    }
}
function isStartBorder(direction: Direction): boolean {
    return direction === 'left' || direction === 'up';
}
function isEndBorder(direction: Direction): boolean {
    return direction === 'right' || direction === 'down';
}
function unique<T>(items: readonly T[]): T[] {
    return [...new Set(items)];
}
