import type { ArchivedWordRegistry, BoardCell, HandTile, Pos, ShapePath, SubmittedWord, Tile, TileRegistry, TransientPlacement, WordSnapshot } from '@/lib/surf-fix-rules/game/types';
import { discoverSubmittedSbsSideContacts, sbsSideContactRejectionReason, type SbsSideContact } from '@/lib/surf-fix-rules/frontier/sbs-side-contact';
import { cellKey as frontierCellKey, deriveWordFrontier } from '@/lib/surf-fix-rules/frontier/word-frontier';
import { deriveAvailableWordFrontier, deriveSubmittedAssemblage } from '@/lib/surf-fix-rules/frontier/submitted-assemblage';
import { isForwardReadingStep } from '@/lib/surf-fix-rules/game/reading-order';
import { forEachSubmittedWordCell } from '@/lib/surf-fix-rules/game/submitted-word-cells';
import { LETTER_VALUES, STARTING_HAND } from '@/lib/surf-fix-rules/game/tiles';
import { dropStructurallyContainedWords, wordIsStructurallyConsumedBy } from '@/lib/surf-fix-rules/game/word-consumption';
import type { SurfFixMoveValidationTrace, SurfFixSideContactTrace } from '@/lib/surf-fix-rules/trace/read-trace';
export const BOARD_ROWS = 21;
export const BOARD_COLS = 21;
const SEED_WORDS: SubmittedWord[] = [
    {
        id: 'word-sane',
        text: 'SANE',
        tileTexts: ['S', 'A', 'N', 'E'],
        orderedTileIds: ['seed-s', 'seed-a', 'seed-n', 'seed-e'],
        shape: {
            cells: [
                { row: 6, col: 4 },
                { row: 6, col: 5 },
                { row: 6, col: 6 },
                { row: 7, col: 6 },
            ],
        },
        ancestors: [],
        roundCreated: 0,
        history: [],
    },
];
export function createEmptyBoard(rows = BOARD_ROWS, cols = BOARD_COLS): BoardCell[][] {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ kind: 'empty' as const })));
}
export function placeHandTile(board: BoardCell[][], tileId: string, pos: Pos, transientPlacements: TransientPlacement[]): {
    board: BoardCell[][];
    transientPlacements: TransientPlacement[];
} | null {
    if (!canPlaceTile(board, pos))
        return null;
    const nextBoard = cloneBoard(board);
    nextBoard[pos.row][pos.col] = { kind: 'tile', tileId };
    return {
        board: nextBoard,
        transientPlacements: [...transientPlacements, { tileId, pos: { ...pos } }],
    };
}
export function moveBoardTile(board: BoardCell[][], transientPlacements: TransientPlacement[], from: Pos, to: Pos): {
    board: BoardCell[][];
    transientPlacements: TransientPlacement[];
} | null {
    if (!isInBounds(board, from) || !canPlaceTile(board, to))
        return null;
    const fromCell = board[from.row][from.col];
    if (fromCell.kind === 'empty')
        return null;
    if (!isTransientTile(transientPlacements, fromCell.tileId))
        return null;
    const nextBoard = cloneBoard(board);
    nextBoard[from.row][from.col] = { kind: 'empty' };
    nextBoard[to.row][to.col] = fromCell;
    return {
        board: nextBoard,
        transientPlacements: transientPlacements.map((placement) => (placement.tileId === fromCell.tileId ? { tileId: placement.tileId, pos: { ...to } } : placement)),
    };
}
export type SubmittedWordMutationResult = {
    kind: 'applied';
    words: SubmittedWord[];
} | {
    kind: 'no-op';
    words: SubmittedWord[];
} | {
    kind: 'rejected';
    reason: string;
    trace?: SurfFixMoveValidationTrace;
};
export type SubmittedWordMutationCommitResult = {
    kind: 'applied';
    words: SubmittedWord[];
    board: BoardCell[][];
    transientPlacements: TransientPlacement[];
} | {
    kind: 'no-op';
    words: SubmittedWord[];
    board: BoardCell[][];
    transientPlacements: TransientPlacement[];
} | {
    kind: 'rejected';
    reason: string;
    trace?: SurfFixMoveValidationTrace;
};
export type TileMutationResult = {
    kind: 'applied';
    words: SubmittedWord[];
} | {
    kind: 'no-op';
    words: SubmittedWord[];
} | {
    kind: 'rejected';
    reason: string;
    wordId?: string;
    trace?: SurfFixMoveValidationTrace;
};
export type TileMutationCommitResult = {
    kind: 'applied';
    words: SubmittedWord[];
    board: BoardCell[][];
    transientPlacements: TransientPlacement[];
} | {
    kind: 'no-op';
    words: SubmittedWord[];
    board: BoardCell[][];
    transientPlacements: TransientPlacement[];
} | {
    kind: 'rejected';
    reason: string;
    wordId?: string;
    trace?: SurfFixMoveValidationTrace;
};
export type TileBatchMove = {
    tileId: string;
    toCell: Pos;
};
export type TileBatchMutationCommitResult = {
    kind: 'applied';
    words: SubmittedWord[];
    board: BoardCell[][];
    transientPlacements: TransientPlacement[];
} | {
    kind: 'no-op';
    words: SubmittedWord[];
    board: BoardCell[][];
    transientPlacements: TransientPlacement[];
} | {
    kind: 'rejected';
    reason: string;
    wordId?: string;
    trace?: SurfFixMoveValidationTrace;
};
export type SubmitOutcome = {
    wordId: string;
    action: 'preserve';
} | {
    wordId: string;
    action: 'replace';
} | {
    wordId: string;
    action: 'contact-only';
};
export type SubmitOutcomeResult = {
    words: SubmittedWord[];
    archivedWords: ArchivedWordRegistry;
    outcomes: SubmitOutcome[];
};
export function applySubmitOutcome(input: {
    words: readonly SubmittedWord[];
    archivedWords: ArchivedWordRegistry;
    newWord: SubmittedWord;
    contactOnlyWordIds?: readonly string[];
}): SubmitOutcomeResult {
    return applySubmitBundle({
        words: input.words,
        archivedWords: input.archivedWords,
        newWords: [input.newWord],
        contactOnlyWordIds: input.contactOnlyWordIds,
    });
}
export function applySubmitBundle(input: {
    words: readonly SubmittedWord[];
    archivedWords: ArchivedWordRegistry;
    newWords: readonly SubmittedWord[];
    contactOnlyWordIds?: readonly string[];
}): SubmitOutcomeResult {
    const contactOnlyWordIds = new Set(input.contactOnlyWordIds ?? []);
    const newWords = dropStructurallyContainedWords(input.newWords);
    const outcomes: SubmitOutcome[] = input.words.map((word) => {
        const action: SubmitOutcome['action'] = contactOnlyWordIds.has(word.id)
            ? 'contact-only'
            : newWords.some((newWord) => wordIsStructurallyConsumedBy(word, newWord))
                ? 'replace'
                : 'preserve';
        return {
            wordId: word.id,
            action,
        };
    });
    const replacedIds = new Set(outcomes.filter((outcome) => outcome.action === 'replace').map((outcome) => outcome.wordId));
    const archivedWords: ArchivedWordRegistry = cloneArchivedWords(input.archivedWords);
    const preservedWords: SubmittedWord[] = [];
    for (const word of input.words) {
        if (replacedIds.has(word.id)) {
            archivedWords[word.id] = cloneSubmittedWord(word);
        }
        else {
            preservedWords.push(cloneSubmittedWord(word));
        }
    }
    return {
        words: [
            ...preservedWords,
            ...newWords.map((newWord) => {
                const consumedByThisWord = input.words
                    .filter((word) => replacedIds.has(word.id) && wordIsStructurallyConsumedBy(word, newWord))
                    .map((word) => word.id);
                return {
                    ...cloneSubmittedWord(newWord),
                    ancestors: uniqueStrings([...newWord.ancestors, ...consumedByThisWord]),
                };
            }),
        ],
        archivedWords,
        outcomes,
    };
}
export function applySubmittedWordMutation(input: {
    words: readonly SubmittedWord[];
    board: BoardCell[][];
    wordId: string;
    nextShape: ShapePath;
    round: number;
}): SubmittedWordMutationResult {
    const word = input.words.find((entry) => entry.id === input.wordId);
    if (!word)
        return { kind: 'rejected', reason: 'word-not-found' };
    const shapeError = validateOrderedShape(word, input.nextShape);
    if (shapeError)
        return { kind: 'rejected', reason: shapeError };
    const collisionError = validateShapeCollisions(word, input.nextShape, input.board);
    if (collisionError)
        return { kind: 'rejected', reason: collisionError };
    const blockedContactError = validateShapeBlockedContacts(word, word.shape, input.nextShape, input.words);
    if (blockedContactError)
        return { kind: 'rejected', reason: blockedContactError };
    if (sameShape(word.shape, input.nextShape))
        return { kind: 'no-op', words: input.words.map(cloneSubmittedWord) };
    const proposedWords = input.words.map((entry) => (entry.id === word.id
        ? { ...cloneSubmittedWord(entry), shape: cloneShape(input.nextShape) }
        : cloneSubmittedWord(entry)));
    const readPreservationError = validateSubmittedWordReadPreservation(proposedWords);
    if (readPreservationError)
        return { kind: 'rejected', reason: readPreservationError.reason, trace: readPreservationError.trace };
    const sbsContactError = validateSubmittedSbsContacts(proposedWords);
    if (sbsContactError)
        return { kind: 'rejected', reason: sbsContactError.reason, trace: sbsContactError.trace };
    const snapshot = snapshotWord(word, input.round);
    const nextWords = input.words.map((entry) => (entry.id === word.id
        ? {
            ...entry,
            shape: cloneShape(input.nextShape),
            history: [...entry.history, snapshot],
        }
        : cloneSubmittedWord(entry)));
    return {
        kind: 'applied',
        words: nextWords,
    };
}
export function commitSubmittedWordMutation(input: {
    words: readonly SubmittedWord[];
    board: BoardCell[][];
    transientPlacements: readonly TransientPlacement[];
    wordId: string;
    nextShape: ShapePath;
    round: number;
}): SubmittedWordMutationCommitResult {
    const result = applySubmittedWordMutation(input);
    if (result.kind === 'rejected')
        return result;
    const transientPlacements = cloneTransientPlacements(input.transientPlacements);
    if (result.kind === 'no-op') {
        return {
            kind: 'no-op',
            words: result.words,
            transientPlacements,
            board: projectBoardState(result.words, transientPlacements),
        };
    }
    return {
        kind: 'applied',
        words: result.words,
        transientPlacements,
        board: projectBoardState(result.words, transientPlacements),
    };
}
export function applyTileMutation(input: {
    words: readonly SubmittedWord[];
    board: BoardCell[][];
    tileId: string;
    toCell: Pos;
    round: number;
}): TileMutationResult {
    const memberships = deriveTileMemberships(input.words).get(input.tileId) ?? [];
    if (memberships.length === 0)
        return { kind: 'rejected', reason: 'tile-not-in-submitted-word' };
    const proposedShapes = new Map<string, ShapePath>();
    for (const membership of memberships) {
        const word = input.words.find((entry) => entry.id === membership.wordId);
        if (!word)
            return { kind: 'rejected', reason: 'membership-word-not-found', wordId: membership.wordId };
        proposedShapes.set(word.id, {
            cells: word.shape.cells.map((cell, index) => (index === membership.indexInWord ? { ...input.toCell } : { ...cell })),
        });
    }
    const proposedWords = input.words.map((entry) => {
        const entryShape = proposedShapes.get(entry.id);
        return entryShape ? { ...cloneSubmittedWord(entry), shape: cloneShape(entryShape) } : cloneSubmittedWord(entry);
    });
    for (const membership of memberships) {
        const word = input.words.find((entry) => entry.id === membership.wordId);
        const proposedShape = proposedShapes.get(membership.wordId);
        if (!word || !proposedShape)
            return { kind: 'rejected', reason: 'membership-word-not-found', wordId: membership.wordId };
        const shapeError = validateOrderedShape(word, proposedShape);
        if (shapeError)
            return { kind: 'rejected', reason: shapeError, wordId: word.id };
        const collisionError = validateShapeCollisions(word, proposedShape, input.board);
        if (collisionError)
            return { kind: 'rejected', reason: collisionError, wordId: word.id };
        const blockedContactError = validateShapeBlockedContacts(word, word.shape, proposedShape, proposedWords);
        if (blockedContactError)
            return { kind: 'rejected', reason: blockedContactError, wordId: word.id };
    }
    const readPreservationError = validateSubmittedWordReadPreservation(proposedWords);
    if (readPreservationError)
        return { kind: 'rejected', reason: readPreservationError.reason, wordId: readPreservationError.wordId, trace: readPreservationError.trace };
    const sbsContactError = validateSubmittedSbsContacts(proposedWords);
    if (sbsContactError)
        return { kind: 'rejected', reason: sbsContactError.reason, wordId: sbsContactError.wordId, trace: sbsContactError.trace };
    const changedWordIds = new Set<string>();
    for (const word of input.words) {
        const proposedShape = proposedShapes.get(word.id);
        if (proposedShape && !sameShape(word.shape, proposedShape))
            changedWordIds.add(word.id);
    }
    if (changedWordIds.size === 0)
        return { kind: 'no-op', words: input.words.map(cloneSubmittedWord) };
    const nextWords = input.words.map((word) => {
        const proposedShape = proposedShapes.get(word.id);
        if (!proposedShape || !changedWordIds.has(word.id))
            return cloneSubmittedWord(word);
        return {
            ...cloneSubmittedWord(word),
            shape: cloneShape(proposedShape),
            history: [...word.history.map(cloneWordSnapshot), snapshotWord(word, input.round)],
        };
    });
    return { kind: 'applied', words: nextWords };
}
export function commitTileMutation(input: {
    words: readonly SubmittedWord[];
    board: BoardCell[][];
    transientPlacements: readonly TransientPlacement[];
    tileId: string;
    toCell: Pos;
    round: number;
}): TileMutationCommitResult {
    const result = applyTileMutation(input);
    if (result.kind === 'rejected')
        return result;
    const transientPlacements = cloneTransientPlacements(input.transientPlacements);
    return {
        kind: result.kind,
        words: result.words,
        transientPlacements,
        board: projectBoardState(result.words, transientPlacements),
    };
}
export function commitTileBatchMutation(input: {
    words: readonly SubmittedWord[];
    transientPlacements: readonly TransientPlacement[];
    moves: readonly TileBatchMove[];
    round: number;
}): TileBatchMutationCommitResult {
    const movesByTileId = new Map(input.moves.map((move) => [move.tileId, { ...move.toCell }]));
    if (movesByTileId.size === 0) {
        const words = input.words.map(cloneSubmittedWord);
        const transientPlacements = cloneTransientPlacements(input.transientPlacements);
        return { kind: 'no-op', words, transientPlacements, board: projectBoardState(words, transientPlacements) };
    }
    const membershipsByTileId = deriveTileMemberships(input.words);
    const transientTileIds = new Set(input.transientPlacements.map((placement) => placement.tileId));
    const affectedWordIds = new Set<string>();
    for (const tileId of movesByTileId.keys()) {
        const memberships = membershipsByTileId.get(tileId) ?? [];
        for (const membership of memberships)
            affectedWordIds.add(membership.wordId);
        if (memberships.length === 0 && !transientTileIds.has(tileId)) {
            return { kind: 'rejected', reason: 'tile-not-movable' };
        }
    }
    const proposedShapes = new Map<string, ShapePath>();
    for (const word of input.words) {
        if (!affectedWordIds.has(word.id))
            continue;
        proposedShapes.set(word.id, {
            cells: word.orderedTileIds.map((tileId, index) => {
                const movedCell = movesByTileId.get(tileId);
                return movedCell ? { ...movedCell } : { ...word.shape.cells[index] };
            }),
        });
    }
    const proposedWords = input.words.map((word) => {
        const proposedShape = proposedShapes.get(word.id);
        return proposedShape ? { ...cloneSubmittedWord(word), shape: cloneShape(proposedShape) } : cloneSubmittedWord(word);
    });
    const proposedTransientPlacements = input.transientPlacements.map((placement) => {
        const movedCell = movesByTileId.get(placement.tileId);
        return movedCell ? { tileId: placement.tileId, pos: { ...movedCell } } : { tileId: placement.tileId, pos: { ...placement.pos } };
    });
    for (const word of input.words) {
        const proposedShape = proposedShapes.get(word.id);
        if (!proposedShape)
            continue;
        const shapeError = validateOrderedShape(word, proposedShape);
        if (shapeError)
            return { kind: 'rejected', reason: shapeError, wordId: word.id };
        const proposedWord = proposedWords.find((entry) => entry.id === word.id);
        if (!proposedWord)
            return { kind: 'rejected', reason: 'membership-word-not-found', wordId: word.id };
        const blockedContactError = validateShapeBlockedContacts(word, word.shape, proposedWord.shape, proposedWords);
        if (blockedContactError)
            return { kind: 'rejected', reason: blockedContactError, wordId: word.id };
    }
    const collisionError = validateProjectedOccupancy(proposedWords, proposedTransientPlacements);
    if (collisionError)
        return { kind: 'rejected', reason: collisionError };
    const readPreservationError = validateSubmittedWordReadPreservation(proposedWords);
    if (readPreservationError)
        return { kind: 'rejected', reason: readPreservationError.reason, wordId: readPreservationError.wordId, trace: readPreservationError.trace };
    const sbsContactError = validateSubmittedSbsContacts(proposedWords);
    if (sbsContactError)
        return { kind: 'rejected', reason: sbsContactError.reason, wordId: sbsContactError.wordId, trace: sbsContactError.trace };
    const changedWordIds = new Set<string>();
    for (const word of input.words) {
        const proposedShape = proposedShapes.get(word.id);
        if (proposedShape && !sameShape(word.shape, proposedShape))
            changedWordIds.add(word.id);
    }
    const transientChanged = input.transientPlacements.some((placement) => {
        const movedCell = movesByTileId.get(placement.tileId);
        return !!movedCell && !sameCell(movedCell, placement.pos);
    });
    if (changedWordIds.size === 0 && !transientChanged) {
        const words = input.words.map(cloneSubmittedWord);
        const transientPlacements = cloneTransientPlacements(input.transientPlacements);
        return { kind: 'no-op', words, transientPlacements, board: projectBoardState(words, transientPlacements) };
    }
    const nextWords = input.words.map((word) => {
        const proposedShape = proposedShapes.get(word.id);
        if (!proposedShape || !changedWordIds.has(word.id))
            return cloneSubmittedWord(word);
        return {
            ...cloneSubmittedWord(word),
            shape: cloneShape(proposedShape),
            history: [...word.history.map(cloneWordSnapshot), snapshotWord(word, input.round)],
        };
    });
    return {
        kind: 'applied',
        words: nextWords,
        transientPlacements: proposedTransientPlacements,
        board: projectBoardState(nextWords, proposedTransientPlacements),
    };
}
export function returnTileToHand(board: BoardCell[][], transientPlacements: TransientPlacement[], from: Pos): {
    board: BoardCell[][];
    transientPlacements: TransientPlacement[];
} | null {
    if (!isInBounds(board, from))
        return null;
    const cell = board[from.row][from.col];
    if (cell.kind === 'empty')
        return null;
    if (!isTransientTile(transientPlacements, cell.tileId))
        return null;
    const nextBoard = cloneBoard(board);
    nextBoard[from.row][from.col] = { kind: 'empty' };
    return {
        board: nextBoard,
        transientPlacements: transientPlacements.filter((placement) => placement.tileId !== cell.tileId),
    };
}
function canPlaceTile(board: BoardCell[][], pos: Pos): boolean {
    return isInBounds(board, pos) && board[pos.row][pos.col].kind === 'empty';
}
export function seedWords(): SubmittedWord[] {
    return SEED_WORDS.map(cloneSubmittedWord);
}
export function seedBoard(words = seedWords()): BoardCell[][] {
    return projectBoardState(words, []);
}
export function projectBoardState(words: readonly SubmittedWord[], transientPlacements: readonly TransientPlacement[]): BoardCell[][] {
    const board = createEmptyBoard();
    for (const word of words) {
        for (let index = 0; index < word.shape.cells.length; index += 1) {
            const cell = word.shape.cells[index];
            board[cell.row][cell.col] = {
                kind: 'tile',
                tileId: word.orderedTileIds[index],
            };
        }
    }
    for (const placement of transientPlacements) {
        const cell = board[placement.pos.row]?.[placement.pos.col];
        if (cell?.kind === 'empty') {
            board[placement.pos.row][placement.pos.col] = { kind: 'tile', tileId: placement.tileId };
        }
    }
    return board;
}
export function pruneOrphanTiles(input: {
    tiles: TileRegistry;
    words: readonly SubmittedWord[];
    archivedWords: ArchivedWordRegistry;
    transientPlacements: readonly TransientPlacement[];
    handTileIds: readonly string[];
}): TileRegistry {
    const referencedTileIds = new Set(input.handTileIds);
    for (const word of input.words) {
        for (const tileId of word.orderedTileIds)
            referencedTileIds.add(tileId);
    }
    for (const word of Object.values(input.archivedWords)) {
        for (const tileId of word.orderedTileIds)
            referencedTileIds.add(tileId);
        for (const snapshot of word.history) {
            for (const tileId of snapshot.orderedTileIds)
                referencedTileIds.add(tileId);
        }
    }
    for (const placement of input.transientPlacements)
        referencedTileIds.add(placement.tileId);
    const nextTiles: TileRegistry = {};
    for (const [tileId, tile] of Object.entries(input.tiles)) {
        if (!isPlacedCopyTileId(tileId) || referencedTileIds.has(tileId)) {
            nextTiles[tileId] = { ...tile };
        }
    }
    return nextTiles;
}
export type TileMembership = {
    tileId: string;
    wordId: string;
    indexInWord: number;
    cell: Pos;
};
export function deriveTileMemberships(words: readonly SubmittedWord[]): Map<string, TileMembership[]> {
    const memberships = new Map<string, TileMembership[]>();
    for (const word of words) {
        for (let index = 0; index < word.orderedTileIds.length; index += 1) {
            const tileId = word.orderedTileIds[index];
            const cell = word.shape.cells[index];
            if (!cell)
                continue;
            memberships.set(tileId, [
                ...(memberships.get(tileId) ?? []),
                {
                    tileId,
                    wordId: word.id,
                    indexInWord: index,
                    cell: { ...cell },
                },
            ]);
        }
    }
    return memberships;
}
export function seedTileRegistry(words = seedWords()): TileRegistry {
    const registry: TileRegistry = {};
    for (const tile of STARTING_HAND) {
        registry[tile.id] = { ...tile };
    }
    for (const word of words) {
        for (let index = 0; index < word.orderedTileIds.length; index += 1) {
            const letter = word.tileTexts[index] ?? '?';
            registry[word.orderedTileIds[index]] = {
                id: word.orderedTileIds[index],
                letter,
                value: LETTER_VALUES[letter] ?? 1,
            };
        }
    }
    return registry;
}
export function initialHandTileIds(): string[] {
    return STARTING_HAND.map((tile) => tile.id);
}
export function deriveHandTiles(tileIds: readonly string[], tiles: TileRegistry): HandTile[] {
    return tileIds.map((tileId) => tiles[tileId]).filter((tile): tile is Tile => !!tile);
}
function isInBounds(board: BoardCell[][], pos: Pos): boolean {
    return pos.row >= 0 && pos.row < board.length && pos.col >= 0 && pos.col < (board[0]?.length ?? 0);
}
function cloneBoard(board: BoardCell[][]): BoardCell[][] {
    return board.map((row) => row.map((cell) => ({ ...cell })));
}
function isTransientTile(transientPlacements: readonly TransientPlacement[], tileId: string): boolean {
    return transientPlacements.some((placement) => placement.tileId === tileId);
}
function isPlacedCopyTileId(tileId: string): boolean {
    return /:placed-\d+$/.test(tileId);
}
function validateOrderedShape(word: SubmittedWord, shape: ShapePath): string | null {
    if (shape.cells.length !== word.orderedTileIds.length)
        return 'shape-length-mismatch';
    const seen = new Set<string>();
    for (let index = 0; index < shape.cells.length; index += 1) {
        const cell = shape.cells[index];
        const key = cellKey(cell);
        if (seen.has(key))
            return 'shape-self-overlap';
        seen.add(key);
        const next = shape.cells[index + 1];
        if (next && !areOrthogonalNeighbors(cell, next))
            return 'shape-not-ordered-cardinal-path';
        if (next && !isForwardReadingStep(cell, next))
            return 'shape-not-forward-reading-order';
    }
    return null;
}
function validateShapeCollisions(word: SubmittedWord, shape: ShapePath, board: BoardCell[][]): string | null {
    const ownTileIds = new Set(word.orderedTileIds);
    for (const cell of shape.cells) {
        if (!isInBounds(board, cell))
            return 'shape-out-of-bounds';
        const boardCell = board[cell.row][cell.col];
        if (boardCell.kind === 'tile' && !ownTileIds.has(boardCell.tileId))
            return 'shape-collides-with-other-tile';
    }
    return null;
}
function validateProjectedOccupancy(words: readonly SubmittedWord[], transientPlacements: readonly TransientPlacement[]): string | null {
    const occupiedByCell = new Map<string, string>();
    const visit = (tileId: string, cell: Pos): string | null => {
        if (cell.row < 0 || cell.row >= BOARD_ROWS || cell.col < 0 || cell.col >= BOARD_COLS)
            return 'shape-out-of-bounds';
        const key = cellKey(cell);
        const occupyingTileId = occupiedByCell.get(key);
        if (occupyingTileId && occupyingTileId !== tileId)
            return 'shape-collides-with-other-tile';
        occupiedByCell.set(key, tileId);
        return null;
    };
    for (const word of words) {
        for (let index = 0; index < word.shape.cells.length; index += 1) {
            const tileId = word.orderedTileIds[index];
            const cell = word.shape.cells[index];
            const error = visit(tileId, cell);
            if (error)
                return error;
        }
    }
    for (const placement of transientPlacements) {
        const error = visit(placement.tileId, placement.pos);
        if (error)
            return error;
    }
    return null;
}
function validateSubmittedWordReadPreservation(words: readonly SubmittedWord[]): {
    reason: string;
    wordId: string;
    trace: SurfFixMoveValidationTrace;
} | null {
    const occupancy = new Map<string, Array<{
        wordId: string;
    }>>();
    forEachSubmittedWordCell(words, ({ word, cell }) => {
        occupancy.set(cellKey(cell), [...(occupancy.get(cellKey(cell)) ?? []), { wordId: word.id }]);
    });
    for (const word of words) {
        const frontier = deriveWordFrontier(word);
        for (const port of frontier.ports) {
            if (port.affordance !== 'pre' && port.affordance !== 'post')
                continue;
            const occupants = occupancy.get(cellKey(port.neighborCell)) ?? [];
            const foreignOccupants = occupants.filter((occupant) => occupant.wordId !== word.id);
            if (foreignOccupants.length > 0) {
                const reason = port.affordance === 'pre'
                    ? 'submitted-word-pre-space-occupied'
                    : 'submitted-word-post-space-occupied';
                return {
                    reason,
                    wordId: word.id,
                    trace: {
                        kind: 'read-preservation',
                        reason,
                        wordId: word.id,
                        wordText: word.text,
                        portAffordance: port.affordance,
                        anchorCell: { ...port.anchorCell },
                        neighborCell: { ...port.neighborCell },
                        occupyingWordIds: uniqueStrings(foreignOccupants.map((occupant) => occupant.wordId)),
                    },
                };
            }
        }
    }
    return null;
}
function validateSubmittedSbsContacts(words: readonly SubmittedWord[]): {
    reason: string;
    wordId?: string;
    trace: SurfFixMoveValidationTrace;
} | null {
    const contacts = discoverSubmittedSbsSideContacts({
        words,
        tiles: tileRegistryFromSubmittedWords(words),
    });
    for (const contact of contacts) {
        const reason = sbsSideContactRejectionReason(contact);
        if (reason) {
            return {
                reason,
                wordId: contact.submittedWordIds[0],
                trace: {
                    kind: 'submitted-sbs-contact',
                    reason,
                    submittedWordIds: [...contact.submittedWordIds],
                    contact: sideContactTraceFromSubmittedContact(contact, reason),
                },
            };
        }
    }
    return null;
}
function sideContactTraceFromSubmittedContact(contact: SbsSideContact, reason: 'not-in-sbs-list' | 'sbs-pre-space-occupied' | 'sbs-post-space-occupied'): SurfFixSideContactTrace {
    return {
        text: contact.text,
        cells: contact.cells.map((cell) => ({ ...cell })),
        tileIds: [...contact.tileIds],
        accepted: false,
        reason,
    };
}
function tileRegistryFromSubmittedWords(words: readonly SubmittedWord[]): TileRegistry {
    const tiles: TileRegistry = {};
    for (const word of words) {
        for (let index = 0; index < word.orderedTileIds.length; index += 1) {
            const tileId = word.orderedTileIds[index];
            const letter = word.tileTexts[index];
            if (!tileId || !letter || tiles[tileId])
                continue;
            tiles[tileId] = {
                id: tileId,
                letter,
                value: LETTER_VALUES[letter] ?? 0,
            };
        }
    }
    return tiles;
}
function validateShapeBlockedContacts(word: SubmittedWord, previousShape: ShapePath, shape: ShapePath, words: readonly SubmittedWord[]): string | null {
    const otherWords = words.filter((entry) => entry.id !== word.id);
    const assemblage = deriveSubmittedAssemblage(otherWords);
    for (const otherWord of otherWords) {
        const otherTileIds = new Set(otherWord.orderedTileIds);
        const frontier = deriveAvailableWordFrontier(otherWord, assemblage);
        for (let index = 0; index < shape.cells.length; index += 1) {
            const previousCell = previousShape.cells[index];
            if (previousCell && sameCell(previousCell, shape.cells[index]))
                continue;
            const tileId = word.orderedTileIds[index];
            if (tileId && otherTileIds.has(tileId))
                continue;
            const cell = shape.cells[index];
            const blockedPort = (frontier.portsByCell.get(frontierCellKey(cell)) ?? [])
                .find((port) => port.effect === 'invalidate');
            if (blockedPort && shapePathUsesEdge(shape, index, blockedPort.anchorCell))
                continue;
            if (blockedPort)
                return blockedPort.reason ?? 'blocked-submitted-contact';
        }
    }
    return null;
}
function shapePathUsesEdge(shape: ShapePath, cellIndex: number, neighborCell: Pos): boolean {
    const previous = shape.cells[cellIndex - 1];
    const next = shape.cells[cellIndex + 1];
    return (previous ? sameCell(previous, neighborCell) : false)
        || (next ? sameCell(next, neighborCell) : false);
}
function areOrthogonalNeighbors(a: Pos, b: Pos): boolean {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}
function snapshotWord(word: SubmittedWord, replacedAtRound: number): WordSnapshot {
    return {
        text: word.text,
        ledgerKind: word.ledgerKind ?? 'word',
        tileTexts: [...word.tileTexts],
        orderedTileIds: [...word.orderedTileIds],
        shape: cloneShape(word.shape),
        ancestors: [...word.ancestors],
        roundCreated: word.roundCreated,
        replacedAtRound,
    };
}
function cloneSubmittedWord(word: SubmittedWord): SubmittedWord {
    return {
        ...word,
        tileTexts: [...word.tileTexts],
        orderedTileIds: [...word.orderedTileIds],
        shape: cloneShape(word.shape),
        ancestors: [...word.ancestors],
        history: word.history.map(cloneWordSnapshot),
    };
}
function cloneArchivedWords(archivedWords: ArchivedWordRegistry): ArchivedWordRegistry {
    const clone: ArchivedWordRegistry = {};
    for (const [wordId, word] of Object.entries(archivedWords))
        clone[wordId] = cloneSubmittedWord(word);
    return clone;
}
function cloneWordSnapshot(snapshot: WordSnapshot): WordSnapshot {
    return {
        ...snapshot,
        tileTexts: [...snapshot.tileTexts],
        orderedTileIds: [...snapshot.orderedTileIds],
        shape: cloneShape(snapshot.shape),
        ancestors: [...snapshot.ancestors],
        replacedAtRound: snapshot.replacedAtRound,
    };
}
function cloneTransientPlacements(transientPlacements: readonly TransientPlacement[]): TransientPlacement[] {
    return transientPlacements.map((placement) => ({
        tileId: placement.tileId,
        pos: { ...placement.pos },
    }));
}
function uniqueStrings(values: Iterable<string>): string[] {
    return [...new Set(values)];
}
function cloneShape(shape: ShapePath): ShapePath {
    return { cells: shape.cells.map((cell) => ({ ...cell })) };
}
function sameShape(a: ShapePath, b: ShapePath): boolean {
    if (a.cells.length !== b.cells.length)
        return false;
    return a.cells.every((cell, index) => {
        const other = b.cells[index];
        return !!other && sameCell(cell, other);
    });
}
function cellKey(pos: Pos): string {
    return `${pos.row},${pos.col}`;
}
function sameCell(a: Pos, b: Pos): boolean {
    return a.row === b.row && a.col === b.col;
}
