import type { BoardCell } from '@/lib/game-store';
import { activeWordLedgerWords, surfFixWordLedgerKind } from '@/lib/modes/shared/word-ledger';
import type { SurfFixWord as HostSurfFixWord, SurfFixWordSnapshot as HostSurfFixWordSnapshot } from '@/lib/modes/shared/word-ledger-types';
import type { Pos, SubmittedWord, Tile, TileRegistry, TransientPlacement, WordSnapshot } from '@/lib/surf-fix-rules/game/types';
import { LETTER_VALUES } from '@/lib/tiles';
import { positionKey } from '@/lib/util/position-key';
import { fixedTileId } from '@/lib/modes/shared/tile-ids';
export type SurfFixAdapterErrorCode = 'duplicate-tile-id' | 'missing-word-tile' | 'word-text-tile-text-mismatch';
export class SurfFixAdapterError extends Error {
    constructor(readonly code: SurfFixAdapterErrorCode, message: string) {
        super(message);
        this.name = 'SurfFixAdapterError';
    }
}
export type SurfFixEngineAdapterInput = {
    board: BoardCell[][];
    submittedPositions?: Set<string> | null;
    chainWords?: readonly HostSurfFixWord[];
};
export type SurfFixEngineAdapterState = {
    tileRegistry: TileRegistry;
    tilePositions: Record<string, Pos>;
    submittedWords: SubmittedWord[];
    transientPlacements: TransientPlacement[];
};
export type FixedOriginMoveValidation = {
    ok: true;
} | {
    ok: false;
    reason: 'fixed-origin-tile';
    tileId: string;
    from: Pos;
};
type NonEmptyBoardCell = Exclude<BoardCell, {
    kind: 'empty';
}>;
type TileIndex = {
    tileRegistry: TileRegistry;
    tilePositions: Record<string, Pos>;
};
export function adaptSurfFixBoardToEngine(input: SurfFixEngineAdapterInput): SurfFixEngineAdapterState {
    const tileIndex = buildSurfFixTileIndex(input.board);
    const submittedWords = adaptHostSurfFixWords(activeWordLedgerWords(input.chainWords ?? []), tileIndex.tileRegistry);
    const submittedTileIds = new Set(submittedWords.flatMap((word) => word.orderedTileIds));
    const fixedSeedWords = buildFixedSeedWords(input.board, tileIndex.tileRegistry, submittedTileIds);
    const allSubmittedWords = [...submittedWords, ...fixedSeedWords];
    const allSubmittedTileIds = new Set(allSubmittedWords.flatMap((word) => word.orderedTileIds));
    return {
        tileRegistry: tileIndex.tileRegistry,
        tilePositions: tileIndex.tilePositions,
        submittedWords: allSubmittedWords,
        transientPlacements: buildTransientPlacements(input.board, allSubmittedTileIds, input.submittedPositions ?? null),
    };
}
function buildSurfFixTileIndex(board: BoardCell[][]): TileIndex {
    const tileRegistry: TileRegistry = {};
    const tilePositions: Record<string, Pos> = {};
    forEachNonEmptyCell(board, (cell, pos) => {
        const tile = engineTileFromBoardCell(cell, pos);
        if (tileRegistry[tile.id]) {
            throw new SurfFixAdapterError('duplicate-tile-id', `Duplicate Surf-Fix tile id: ${tile.id}`);
        }
        tileRegistry[tile.id] = tile;
        tilePositions[tile.id] = { ...pos };
    });
    return { tileRegistry, tilePositions };
}
function engineTileFromBoardCell(cell: NonEmptyBoardCell, pos: Pos): Tile {
    return {
        id: surfFixTileIdForCell(cell, pos),
        letter: surfFixTileTextForCell(cell),
        value: surfFixTileValueForCell(cell),
    };
}
export function surfFixTileIdForCell(cell: NonEmptyBoardCell, pos: Pos): string {
    return cell.handTileId ?? fixedTileId(pos);
}
export function fixedSeedWordId(tileId: string): string {
    return `seed:${tileId}`;
}
function surfFixTileTextForCell(cell: NonEmptyBoardCell): string {
    switch (cell.kind) {
        case 'regular':
            return cell.letter;
        case 'double':
            return cell.letters.join('');
        case 'switch': {
            const side = cell.activeSide === 'B' ? cell.sideB : cell.sideA;
            return side.letter;
        }
        case 'wildcard':
            return cell.representsLetter ?? 'X';
        case 'surfboard':
            return '-';
    }
}
function surfFixTileValueForCell(cell: NonEmptyBoardCell): number {
    switch (cell.kind) {
        case 'regular':
            return cell.value;
        case 'double':
            return cell.value;
        case 'switch': {
            const side = cell.activeSide === 'B' ? cell.sideB : cell.sideA;
            return side.value;
        }
        case 'wildcard':
            return LETTER_VALUES[cell.representsLetter ?? 'X'];
        case 'surfboard':
            return 0;
    }
}
export function surfFixLetterCount(text: string): number {
    return text.replace(/-/g, '').length;
}
function adaptHostSurfFixWords(words: readonly HostSurfFixWord[], tileRegistry: TileRegistry): SubmittedWord[] {
    return words.map((word) => adaptHostSurfFixWord(word, tileRegistry));
}
export function validateFixedOriginTilesNotMoved(input: {
    board: BoardCell[][];
    moves: readonly {
        fromRow: number;
        fromCol: number;
    }[];
}): FixedOriginMoveValidation {
    for (const move of input.moves) {
        if (move.fromRow < 0 || move.fromCol < 0)
            continue;
        const cell = input.board[move.fromRow]?.[move.fromCol];
        if (!cell || cell.kind === 'empty' || cell.origin !== 'fixed')
            continue;
        const from = { row: move.fromRow, col: move.fromCol };
        return {
            ok: false,
            reason: 'fixed-origin-tile',
            tileId: surfFixTileIdForCell(cell, from),
            from,
        };
    }
    return { ok: true };
}
function adaptHostSurfFixWord(word: HostSurfFixWord, tileRegistry: TileRegistry): SubmittedWord {
    const tileTexts = tileTextsForOrderedTileIds(word.id, word.orderedTileIds, tileRegistry);
    const text = assertWordTextMatchesTileTexts(word.id, word.text, tileTexts);
    return {
        id: word.id,
        text,
        ledgerKind: surfFixWordLedgerKind(word),
        tileTexts,
        orderedTileIds: [...word.orderedTileIds],
        shape: cloneShape(word.shape),
        ancestors: [...word.ancestors],
        roundCreated: word.roundCreated,
        history: word.history.map((snapshot) => adaptHostSurfFixSnapshot(snapshot, tileRegistry)),
    };
}
function adaptHostSurfFixSnapshot(snapshot: HostSurfFixWordSnapshot, tileRegistry: TileRegistry): WordSnapshot {
    const tileTexts = tileTextsForOrderedTileIds(snapshot.id, snapshot.orderedTileIds, tileRegistry);
    const text = assertWordTextMatchesTileTexts(snapshot.id, snapshot.text, tileTexts);
    return {
        text,
        ledgerKind: surfFixWordLedgerKind(snapshot),
        tileTexts,
        orderedTileIds: [...snapshot.orderedTileIds],
        shape: cloneShape(snapshot.shape),
        ancestors: [...snapshot.ancestors],
        roundCreated: snapshot.roundCreated,
        replacedAtRound: snapshot.roundCreated,
    };
}
function buildFixedSeedWords(board: BoardCell[][], tileRegistry: TileRegistry, submittedTileIds: ReadonlySet<string>): SubmittedWord[] {
    const words: SubmittedWord[] = [];
    forEachNonEmptyCell(board, (cell, pos) => {
        if (cell.origin !== 'fixed')
            return;
        const tileId = surfFixTileIdForCell(cell, pos);
        if (submittedTileIds.has(tileId))
            return;
        const tile = tileRegistry[tileId];
        if (!tile)
            return;
        words.push({
            id: fixedSeedWordId(tileId),
            text: tile.letter,
            tileTexts: [tile.letter],
            orderedTileIds: [tileId],
            shape: { cells: [{ ...pos }] },
            ancestors: [],
            roundCreated: 0,
            history: [],
        });
    });
    return words;
}
function buildTransientPlacements(board: BoardCell[][], submittedTileIds: ReadonlySet<string>, submittedPositions: Set<string> | null): TransientPlacement[] {
    const placements: TransientPlacement[] = [];
    forEachNonEmptyCell(board, (cell, pos) => {
        if (cell.origin === 'fixed')
            return;
        const tileId = surfFixTileIdForCell(cell, pos);
        if (submittedTileIds.has(tileId))
            return;
        if (submittedPositions?.has(positionKey(pos.row, pos.col)))
            return;
        placements.push({ tileId, pos: { ...pos } });
    });
    return placements;
}
function tileTextsForOrderedTileIds(wordId: string, orderedTileIds: readonly string[], tileRegistry: TileRegistry): string[] {
    return orderedTileIds.map((tileId) => {
        const tile = tileRegistry[tileId];
        if (!tile) {
            throw new SurfFixAdapterError('missing-word-tile', `Word ${wordId} references missing tile ${tileId}`);
        }
        return tile.letter;
    });
}
function assertWordTextMatchesTileTexts(wordId: string, expectedText: string, tileTexts: readonly string[]): string {
    const text = tileTexts.join('');
    if (expectedText !== text) {
        throw new SurfFixAdapterError('word-text-tile-text-mismatch', `Word ${wordId} text ${expectedText} does not match tile text ${text}`);
    }
    return text;
}
function forEachNonEmptyCell(board: BoardCell[][], visit: (cell: NonEmptyBoardCell, pos: Pos) => void): void {
    for (let row = 0; row < board.length; row += 1) {
        for (let col = 0; col < (board[row]?.length ?? 0); col += 1) {
            const cell = board[row]?.[col];
            if (!cell || cell.kind === 'empty')
                continue;
            visit(cell, { row, col });
        }
    }
}
function cloneShape<T extends {
    cells: readonly Pos[];
}>(shape: T): {
    cells: Pos[];
} {
    return {
        cells: shape.cells.map((cell) => ({ ...cell })),
    };
}
