import { create } from 'zustand';
import { temporal } from 'zundo';
import { withRideClaimLifetime } from './ride-claim-state';
import { chooseSurfFixRide, validateSurfFixRideSelection } from './modes/surf-fix/ride-selection';
import { removeRideClaim, type RideClaim } from './predicates/reads/ride-claim';
import type { CellDescriptor, Letter, SwitchSide, SwitchOption, LetterCategory } from '@/lib/tiles';
import { LETTER_VALUES, DOUBLE_TILES, getSwitchTileCategory, isVowelSwitchTile } from '@/lib/tiles';
import type { GameMode, GameModeId } from '@/lib/modes/types';
import { generateId } from '@/lib/util/unique-id';
import { getMode } from '@/lib/modes/registry';
import { checkReruns, type RerunResult } from './rerun-rules';
import { buildRoundWordPills, type PlayedWordEntry } from '@/lib/presentation/round-word-pills';
import { type BatchMove, type BatchMoveValidationContext, buildBatchMoveContext, evaluateMove, positionKey, } from '@/lib/modes/move-policy';
import { collectFullySubmittedCompoundWordState } from '@/lib/predicates/move/bent-word-reflow-integrity';
import { getActiveSwitchLetter } from '@/lib/predicates/tiles/switch-equivalence';
import { canRegularTileReclaimEquivalent } from '@/lib/predicates/tiles/equivalent-reclaim';
import { canSetHandWildcardLetter, getHandWildcardRepresentedLetter, normalizeWildcardLetterChoice, } from '@/lib/predicates/tiles/wildcard-choice';
import { loadTimerPrefs } from '@/lib/util/timer-prefs';
import type { SurfFixWord, SurfFixWordDraft, SurfFixWordSnapshot, } from '@/lib/modes/shared/word-ledger-types';
import { replaceWordLedgerTileId, surfFixWordLedgerKind } from '@/lib/modes/shared/word-ledger';
import { fixedTileId } from '@/lib/modes/shared/tile-ids';
import { canChooseWildcardLetters, canExchangeEquivalentTiles } from '@/lib/modes/ui-capabilities';
import type { GameAuthoring } from './game-settings';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'expired';
export type BoardCell = {
    kind: 'empty';
} | (CellDescriptor & {
    origin: 'fixed' | 'placed';
    activeSide?: SwitchSide;
    handTileId?: string;
});
function toChainWordSnapshot(word: SurfFixWord): SurfFixWordSnapshot {
    return {
        id: word.id,
        text: word.text,
        ledgerKind: surfFixWordLedgerKind(word),
        orderedTileIds: [...word.orderedTileIds],
        shape: { cells: word.shape.cells.map((cell) => ({ ...cell })) },
        ancestors: [...word.ancestors],
        roundCreated: word.roundCreated,
    };
}
function mergeAcceptedChainWords(existingWords: SurfFixWord[], drafts: SurfFixWordDraft[]): SurfFixWord[] {
    const nextWords = [...existingWords];
    for (const draft of drafts) {
        const { revisionOfWordId, ...wordDraft } = draft;
        if (revisionOfWordId) {
            const existingIndex = nextWords.findIndex((word) => word.id === revisionOfWordId);
            if (existingIndex >= 0) {
                const current = nextWords[existingIndex]!;
                nextWords[existingIndex] = {
                    ...current,
                    ledgerKind: wordDraft.ledgerKind ?? surfFixWordLedgerKind(current),
                    text: wordDraft.text,
                    orderedTileIds: [...wordDraft.orderedTileIds],
                    shape: { cells: wordDraft.shape.cells.map((cell) => ({ ...cell })) },
                    ancestors: [...wordDraft.ancestors],
                    roundCreated: wordDraft.roundCreated,
                    history: [toChainWordSnapshot(current), ...current.history],
                };
                continue;
            }
        }
        nextWords.unshift({
            id: generateId(),
            ledgerKind: wordDraft.ledgerKind ?? 'word',
            text: wordDraft.text,
            orderedTileIds: [...wordDraft.orderedTileIds],
            shape: { cells: wordDraft.shape.cells.map((cell) => ({ ...cell })) },
            ancestors: [...wordDraft.ancestors],
            roundCreated: wordDraft.roundCreated,
            history: [],
        });
    }
    return nextWords;
}
function applyBatchMoveForMode(input: {
    mode: GameMode;
    validationContext: BatchMoveValidationContext;
    chainWords: SurfFixWord[];
    movedTileIds: readonly string[];
}): SurfFixWord[] | null {
    if (input.mode.applyBatchMove) {
        const result = input.mode.applyBatchMove(input.validationContext, input.chainWords, input.movedTileIds);
        return result.ok ? result.chainWords : null;
    }
    const validation = evaluateMove(input.mode.validateBatchMove, input.validationContext);
    return validation.ok ? input.chainWords : null;
}
export type BagTile = {
    kind: 'regular';
    letter: Letter;
    value: number;
    category: LetterCategory;
} | {
    kind: 'switch';
    tileId: string;
    sideA: SwitchOption;
    sideB: SwitchOption;
    category: LetterCategory;
} | {
    kind: 'double';
    id: string;
    letters: [
        Letter,
        Letter
    ];
    value: number;
};
export type HandTile = {
    kind: 'regular';
    id: string;
    letter: Letter;
    value: number;
    category: LetterCategory;
    isPickTile: boolean;
    wildcardRepresentsLetter?: Letter;
    origin?: 'drawer' | 'board';
} | {
    kind: 'switch';
    id: string;
    tileId: string;
    sideA: SwitchOption;
    sideB: SwitchOption;
    activeSide: SwitchSide;
    origin?: 'drawer' | 'board';
} | {
    kind: 'double';
    id: string;
    tileId: string;
    letters: [
        Letter,
        Letter
    ];
    value: number;
    origin?: 'drawer' | 'board';
} | {
    kind: 'surfboard';
    id: string;
    tileId: string;
    origin?: 'drawer' | 'board';
};
type PlacedBoardCell = Exclude<BoardCell, {
    kind: 'empty';
}>;
type MoveSourceCell = BatchMove & {
    cell: PlacedBoardCell;
    letter: string;
    wasSubmitted: boolean;
};
function letterForBoardCell(cell: PlacedBoardCell): string {
    if (cell.kind === 'regular')
        return cell.letter;
    if (cell.kind === 'double')
        return cell.id;
    if (cell.kind === 'switch')
        return cell.id;
    if (cell.kind === 'surfboard')
        return '[SB]';
    return 'X';
}

function boardCellTileId(cell: PlacedBoardCell, row: number, col: number): string {
    return cell.handTileId ?? fixedTileId(row, col);
}
function handTileFromBoardCell(cell: PlacedBoardCell, tileId: string): HandTile {
    if (cell.kind === 'regular') {
        return {
            kind: 'regular',
            id: tileId,
            letter: cell.letter,
            value: cell.value,
            category: 'AEIOU'.includes(cell.letter) ? 'vowel' : 'consonant',
            isPickTile: !!cell.isPickTile,
            origin: 'board',
        };
    }
    if (cell.kind === 'double') {
        return {
            kind: 'double',
            id: tileId,
            tileId: cell.id ?? '',
            letters: cell.letters,
            value: cell.value,
            origin: 'board',
        };
    }
    if (cell.kind === 'switch') {
        return {
            kind: 'switch',
            id: tileId,
            tileId: cell.id ?? '',
            sideA: cell.sideA,
            sideB: cell.sideB,
            activeSide: cell.activeSide ?? 'A',
            origin: 'board',
        };
    }
    if (cell.kind === 'wildcard') {
        const representsLetter = normalizeWildcardLetterChoice(cell.representsLetter);
        return {
            kind: 'regular',
            id: tileId,
            letter: 'X',
            value: LETTER_VALUES['X'],
            category: 'consonant',
            isPickTile: false,
            ...(representsLetter ? { wildcardRepresentsLetter: representsLetter } : {}),
            origin: 'board',
        };
    }
    return {
        kind: 'surfboard',
        id: tileId,
        tileId: cell.tileId,
        origin: 'board',
    };
}
function moveSourceCell(board: BoardCell[][], submittedPositions: Set<string> | null, move: BatchMove): MoveSourceCell | null {
    const fromKey = positionKey(move.fromRow, move.fromCol);
    const fromCell = board[move.fromRow]?.[move.fromCol];
    if (!fromCell || fromCell.kind === 'empty')
        return null;
    if ('origin' in fromCell && fromCell.origin !== 'placed')
        return null;
    return {
        ...move,
        cell: fromCell,
        letter: letterForBoardCell(fromCell),
        wasSubmitted: !!submittedPositions?.has(fromKey),
    };
}
function collectMoveSourceCells(board: BoardCell[][], submittedPositions: Set<string> | null, moves: readonly BatchMove[]): MoveSourceCell[] | null {
    const sourceCells: MoveSourceCell[] = [];
    for (const move of moves) {
        const source = moveSourceCell(board, submittedPositions, move);
        if (!source)
            return null;
        sourceCells.push(source);
    }
    return sourceCells;
}
function batchTargetsAreOpen(board: BoardCell[][], sources: readonly MoveSourceCell[], sourceKeys: ReadonlySet<string>): boolean {
    for (const move of sources) {
        const toCell = board[move.toRow]?.[move.toCol];
        if (!toCell)
            return false;
        const toKey = positionKey(move.toRow, move.toCol);
        if (toCell.kind !== 'empty' && !sourceKeys.has(toKey))
            return false;
    }
    return true;
}
function movedTileIdsForSources(sources: readonly MoveSourceCell[]): string[] {
    return sources.map((move) => boardCellTileId(move.cell, move.fromRow, move.fromCol));
}
function submittedWordsFromPlayedWords(playedWords: readonly PlayedWordEntry[]): string[] {
    return playedWords.map((entry) => entry.word);
}
function buildStoreBatchMoveContext(input: {
    board: BoardCell[][];
    submittedPositions: Set<string> | null;
    playedWords: readonly PlayedWordEntry[];
    moves: BatchMove[];
    submittedBentWordPositions: Set<string> | null;
    chainWords: SurfFixWord[];
}): BatchMoveValidationContext {
    return buildBatchMoveContext(input.board, input.submittedPositions, submittedWordsFromPlayedWords(input.playedWords), input.moves, null, input.submittedBentWordPositions, input.chainWords);
}
function nextBentPositionsAfterBatchMove(validationContext: BatchMoveValidationContext, currentBentPositions: Set<string> | null): Set<string> | null {
    if (validationContext.movingSubmittedKeys.size === 0)
        return currentBentPositions;
    const state = collectFullySubmittedCompoundWordState(validationContext.nextBoard, validationContext.nextSubmittedPositions);
    return state.coveredPositions.size > 0 ? state.coveredPositions : null;
}
export interface GameState {
    modeId: GameModeId;
    authoring?: GameAuthoring | null;
    rideClaim?: RideClaim | null;
    board: BoardCell[][];
    round: number;
    score: number;
    vowelBag: BagTile[];
    consonantBag: BagTile[];
    backupVowelBag: BagTile[];
    backupConsonantBag: BagTile[];
    hand: HandTile[];
    handDrawnForRound: number | null;
    handVersion: number;
    validPositions: Set<string> | null;
    submittedPositions: Set<string> | null;
    submittedBentWordPositions: Set<string> | null;
    animatingPositions: Map<string, number> | null;
    playedWords: PlayedWordEntry[];
    chainWords: SurfFixWord[];
    gameOver: boolean;
    hintsEnabled: boolean;
    toastMessage: string | null;
    toastTheme: 'default' | 'success' | 'rerun' | 'error';
    pendingRerun: RerunResult | null;
    pickTilesUsedForRound: number;
    doubleTileUsedForRound: boolean;
    doubleTileIdForRound: string | null;
    remainingDoubleTiles: string[];
    timerEnabled: boolean;
    timerMinutes1_12: number;
    timerMinutes13_16: number;
    roundTimerEndsAt: number | null;
    timerStatus: TimerStatus;
    timerPausedRemainingMs: number | null;
    wildcardMustBeUsedAsXRound: number | null;
}
export interface GameActions {
    placeTile: (row: number, col: number, handTileId: string) => void;
    removeTile: (row: number, col: number) => void;
    moveTile: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
    moveTilesBatch: (moves: Array<{
        fromRow: number;
        fromCol: number;
        toRow: number;
        toCol: number;
    }>) => void;
    returnTileToHand: (row: number, col: number, insertAt?: number) => void;
    returnTileToSupply: (source: {
        row: number;
        col: number;
    } | {
        tileId: string;
    }) => boolean;
    rotateSwitchTile: (row: number, col: number) => void;
    reorderHand: (activeId: string, overId: string) => void;
    returnPickTile: (tileId: string) => void;
    returnDoubleTile: (tileId: string) => void;
    returnSurfboardTile: (tileId: string) => void;
    sortHand: () => void;
    shuffleHand: () => void;
    drawHand: () => void;
    triggerRerun: () => void;
    advanceRound: () => void;
    resetBoard: () => void;
    applyRideSelection: (tileIds: readonly string[]) => {
        ok: true;
    } | {
        ok: false;
        message: string;
    };
    choosePrimaryRide: (tileIds: readonly string[], boardKey: string) => {
        ok: true;
    } | {
        ok: false;
        message: string;
    };
    clearRideSelection: (pathKey?: string) => void;
    addScore: (points: number) => void;
    addSubmittedPositions: (positions: Set<string>) => void;
    addPlayedWords: (words: PlayedWordEntry[]) => void;
    toggleHints: () => void;
    rotateHandTile: (tileId: string) => void;
    addPickTile: (letter: Letter) => 'ok' | 'limit-reached';
    swapBoardTileWithPick: (row: number, col: number, letter: Letter) => 'ok' | 'blocked';
    swapPickTileWithRegular: (row: number, col: number, handTileId: string) => 'ok' | 'blocked';
    reclaimSwitchTile: (row: number, col: number, handTileId: string) => 'ok' | 'blocked';
    placeHandSwitchOverRegular: (row: number, col: number, handTileId: string) => 'ok' | 'blocked';
    setWildcardLetter: (row: number, col: number, letter: Letter | null) => void;
    setHandWildcardLetter: (tileId: string, letter: Letter | null) => void;
    reclaimWildcardTile: (row: number, col: number, handTileId: string) => 'ok' | 'blocked';
    addDoubleTile: (tileId: string) => 'ok' | 'limit-reached';
    addSurfboardTile: () => 'ok' | 'limit-reached';
    acceptSubmission: (params: {
        points: number;
        newPositions: Set<string>;
        scored: PlayedWordEntry[];
        isLastRound: boolean;
        bentWordPositions?: Set<string>;
        chainWordDrafts?: SurfFixWordDraft[];
    }) => void;
    setTimerEnabled: (enabled: boolean) => void;
    setTimerMinutes1_12: (minutes: number) => void;
    setTimerMinutes13_16: (minutes: number) => void;
    startRoundTimer: (round: number, now?: number) => void;
    clearRoundTimer: () => void;
    expireRoundTimer: () => void;
    pauseRoundTimer: () => void;
    resumeRoundTimer: () => void;
}
function buildEmptyBoard(rows: number, cols: number): BoardCell[][] {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, (): BoardCell => ({ kind: 'empty' })));
}
function buildBoardForMode(modeId: GameModeId): BoardCell[][] {
    const mode = getMode(modeId);
    const { rows, cols } = mode.boardSize;
    const board = buildEmptyBoard(rows, cols);
    return mode.seedBoard ? mode.seedBoard(board) : board;
}
function setCell(board: BoardCell[][], row: number, col: number, cell: BoardCell): BoardCell[][] {
    const next = board.slice();
    next[row] = board[row].slice();
    next[row][col] = cell;
    return next;
}
function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
function drawFromBag(bag: BagTile[], n: number): [
    HandTile[],
    BagTile[]
] {
    const remaining = [...bag];
    const drawn: HandTile[] = [];
    for (let i = 0; i < n && remaining.length > 0; i++) {
        const tile = remaining.pop()!;
        const id = generateId();
        switch (tile.kind) {
            case 'regular':
                drawn.push({ kind: 'regular', id, letter: tile.letter, value: tile.value, category: tile.category, isPickTile: false, origin: 'drawer' });
                break;
            case 'switch':
                drawn.push({ kind: 'switch', id, tileId: tile.tileId, sideA: tile.sideA, sideB: tile.sideB, activeSide: 'A', origin: 'drawer' });
                break;
            case 'double':
                drawn.push({ kind: 'double', id, tileId: tile.id, letters: tile.letters, value: tile.value, origin: 'drawer' });
                break;
        }
    }
    return [drawn, remaining];
}
function drawCategoryWithBackup(primaryBag: BagTile[], backupBag: BagTile[], needed: number): [
    HandTile[],
    BagTile[],
    BagTile[]
] {
    const [drawnPrimary, nextPrimary] = drawFromBag(primaryBag, needed);
    const shortage = Math.max(0, needed - drawnPrimary.length);
    if (shortage === 0)
        return [drawnPrimary, nextPrimary, backupBag];
    const [drawnBackup, nextBackup] = drawFromBag(backupBag, shortage);
    return [[...drawnPrimary, ...drawnBackup], nextPrimary, nextBackup];
}
const TIMER_DEFAULT_MINUTES_1_12 = 6;
const TIMER_DEFAULT_MINUTES_13_16 = 8;
function clampTimerMinutes(minutes: number): number {
    const n = Number.isFinite(minutes) ? Math.floor(minutes) : TIMER_DEFAULT_MINUTES_1_12;
    return Math.max(1, Math.min(10, n));
}
function resolveTimerPrefs(modeId: GameModeId) {
    const saved = loadTimerPrefs(modeId);
    if (saved?.remember) {
        return {
            timerEnabled: saved.timerEnabled,
            timerMinutes1_12: clampTimerMinutes(saved.timerMinutes1_12),
            timerMinutes13_16: clampTimerMinutes(saved.timerMinutes13_16),
        };
    }
    return {
        timerEnabled: false,
        timerMinutes1_12: TIMER_DEFAULT_MINUTES_1_12,
        timerMinutes13_16: TIMER_DEFAULT_MINUTES_13_16,
    };
}
function getRerunOptions(modeId: GameModeId, round: number) {
    if ((modeId === 'crosswords' || modeId === 'surf-fix') && round === 1) {
        return { ripplesBonusLetters: { S: 1 } as const };
    }
    return undefined;
}
const INITIAL_MODE_ID: GameModeId = 'keiki-play';
export const useGameStore = create<GameState & GameActions>()(temporal(withRideClaimLifetime<GameState & GameActions>((set, get) => ({
    modeId: INITIAL_MODE_ID,
    authoring: null,
    rideClaim: null,
    board: buildBoardForMode(INITIAL_MODE_ID),
    round: 1,
    score: 0,
    ...(() => {
        const { vowelBag, consonantBag, backupVowelBag = [], backupConsonantBag = [], } = getMode(INITIAL_MODE_ID).buildBags();
        return { vowelBag, consonantBag, backupVowelBag, backupConsonantBag };
    })(),
    hand: [],
    handDrawnForRound: null,
    handVersion: 0,
    validPositions: null,
    submittedPositions: null,
    submittedBentWordPositions: null,
    animatingPositions: null,
    playedWords: [],
    chainWords: [],
    gameOver: false,
    hintsEnabled: false,
    toastMessage: null,
    toastTheme: 'default',
    pendingRerun: null,
    pickTilesUsedForRound: 0,
    doubleTileUsedForRound: false,
    doubleTileIdForRound: null,
    remainingDoubleTiles: ['CH', 'PH', 'SH', 'TH', 'CK'],
    ...resolveTimerPrefs(INITIAL_MODE_ID),
    roundTimerEndsAt: null,
    timerStatus: 'idle',
    timerPausedRemainingMs: null,
    wildcardMustBeUsedAsXRound: null,
    drawHand: () => {
        const { round, handDrawnForRound, vowelBag, consonantBag, backupVowelBag, backupConsonantBag, hand, modeId, } = get();
        if (handDrawnForRound === round)
            return;
        const mode = getMode(get().modeId);
        const config = mode.getRoundConfig(round);
        let currentVowelBag = [...vowelBag];
        let currentConsonantBag = [...consonantBag];
        let currentBackupVowelBag = [...backupVowelBag];
        let currentBackupConsonantBag = [...backupConsonantBag];
        let currentHand = [...hand];
        const vNeeded = Math.max(0, config.vowels - currentHand.filter(t => (t.kind === 'regular' && !t.isPickTile && t.category === 'vowel') ||
            (t.kind === 'switch' && isVowelSwitchTile(t.tileId))).length);
        const cNeeded = Math.max(0, config.consonants - currentHand.filter(t => (t.kind === 'regular' && !t.isPickTile && t.category === 'consonant') ||
            (t.kind === 'switch' && !isVowelSwitchTile(t.tileId))).length);
        const [drawnV, nextVBag, nextBackupVBag] = drawCategoryWithBackup(currentVowelBag, currentBackupVowelBag, vNeeded);
        const [drawnC, nextCBag, nextBackupCBag] = drawCategoryWithBackup(currentConsonantBag, currentBackupConsonantBag, cNeeded);
        currentVowelBag = nextVBag;
        currentConsonantBag = nextCBag;
        currentBackupVowelBag = nextBackupVBag;
        currentBackupConsonantBag = nextBackupCBag;
        currentHand = [...currentHand, ...drawnV, ...drawnC];
        const rerunResult = checkReruns(currentHand.filter(t => !(t.kind === 'regular' && t.isPickTile)), getRerunOptions(modeId, round));
        set({
            vowelBag: currentVowelBag,
            consonantBag: currentConsonantBag,
            backupVowelBag: currentBackupVowelBag,
            backupConsonantBag: currentBackupConsonantBag,
            hand: currentHand,
            handDrawnForRound: round,
            handVersion: get().handVersion + 1,
            pendingRerun: rerunResult.shouldRerun ? rerunResult : null,
            toastMessage: rerunResult.shouldRerun ? (rerunResult.message ?? null) : null,
            toastTheme: rerunResult.shouldRerun ? 'rerun' : 'default',
        });
    },
    triggerRerun: () => {
        const { pendingRerun, vowelBag, consonantBag, backupVowelBag, backupConsonantBag, hand } = get();
        if (!pendingRerun)
            return;
        const round = get().round;
        const config = getMode(get().modeId).getRoundConfig(round);
        const toReplace = hand.filter(t => pendingRerun.replaceIds.includes(t.id));
        let currentHand = hand.filter(t => !pendingRerun.replaceIds.includes(t.id));
        let currentVowelBag = [...vowelBag];
        let currentConsonantBag = [...consonantBag];
        let currentBackupVowelBag = [...backupVowelBag];
        let currentBackupConsonantBag = [...backupConsonantBag];
        toReplace.forEach(t => {
            if (t.kind === 'regular') {
                const bagTile: BagTile = { kind: 'regular', letter: t.letter, value: t.value, category: t.category };
                if (t.category === 'vowel')
                    currentVowelBag.push(bagTile);
                else
                    currentConsonantBag.push(bagTile);
            }
            else if (t.kind === 'switch') {
                const category = getSwitchTileCategory(t.tileId);
                const bagTile: BagTile = { kind: 'switch', tileId: t.tileId, sideA: t.sideA, sideB: t.sideB, category };
                if (category === 'vowel')
                    currentVowelBag.push(bagTile);
                else
                    currentConsonantBag.push(bagTile);
            }
        });
        shuffle(currentVowelBag);
        shuffle(currentConsonantBag);
        const vNeeded = Math.max(0, config.vowels - currentHand.filter(t => (t.kind === 'regular' && !t.isPickTile && t.category === 'vowel') ||
            (t.kind === 'switch' && isVowelSwitchTile(t.tileId))).length);
        const cNeeded = Math.max(0, config.consonants - currentHand.filter(t => (t.kind === 'regular' && !t.isPickTile && t.category === 'consonant') ||
            (t.kind === 'switch' && !isVowelSwitchTile(t.tileId))).length);
        const [drawnV, nextVBag, nextBackupVBag] = drawCategoryWithBackup(currentVowelBag, currentBackupVowelBag, vNeeded);
        const [drawnC, nextCBag, nextBackupCBag] = drawCategoryWithBackup(currentConsonantBag, currentBackupConsonantBag, cNeeded);
        currentHand = [...currentHand, ...drawnV, ...drawnC];
        currentVowelBag = nextVBag;
        currentConsonantBag = nextCBag;
        currentBackupVowelBag = nextBackupVBag;
        currentBackupConsonantBag = nextBackupCBag;
        const checkableHand = currentHand.filter(t => !(t.kind === 'regular' && t.isPickTile));
        const newResult = checkReruns(checkableHand, getRerunOptions(get().modeId, round));
        set({
            vowelBag: currentVowelBag,
            consonantBag: currentConsonantBag,
            backupVowelBag: currentBackupVowelBag,
            backupConsonantBag: currentBackupConsonantBag,
            hand: currentHand,
            handVersion: get().handVersion + 1,
            pendingRerun: newResult.shouldRerun ? newResult : null,
            toastMessage: newResult.shouldRerun ? (newResult.message ?? null) : null,
            toastTheme: newResult.shouldRerun ? 'rerun' : 'default',
        });
    },
    placeTile: (row, col, handTileId) => {
        const { board, hand, modeId, wildcardMustBeUsedAsXRound, round } = get();
        const cell = board[row]?.[col];
        if (!cell || cell.kind !== 'empty')
            return;
        const tileIndex = hand.findIndex((t) => t.id === handTileId);
        if (tileIndex === -1)
            return;
        const tile = hand[tileIndex];
        let boardCell: BoardCell;
        if (tile.kind === 'regular') {
            const representsLetter = getHandWildcardRepresentedLetter({
                tile,
                modeAllowsWildcardLetters: canChooseWildcardLetters(modeId),
                forceUseXActive: wildcardMustBeUsedAsXRound === round,
            });
            if (representsLetter) {
                boardCell = { kind: 'wildcard', representsLetter, origin: 'placed', handTileId: tile.id };
            }
            else {
                boardCell = { kind: 'regular', letter: tile.letter, value: tile.value, isPickTile: tile.isPickTile || undefined, origin: 'placed', handTileId: tile.id };
            }
        }
        else if (tile.kind === 'double') {
            boardCell = { kind: 'double', id: tile.tileId, letters: tile.letters, value: tile.value, origin: 'placed', handTileId: tile.id };
        }
        else if (tile.kind === 'surfboard') {
            boardCell = { kind: 'surfboard', tileId: tile.tileId, origin: 'placed', handTileId: tile.id };
        }
        else {
            boardCell = {
                kind: 'switch', id: tile.tileId,
                sideA: tile.sideA, sideB: tile.sideB,
                origin: 'placed', activeSide: tile.activeSide,
                handTileId: tile.id,
            };
        }
        const next = setCell(board, row, col, boardCell);
        const nextHand = [...hand];
        nextHand.splice(tileIndex, 1);
        set({
            board: next,
            hand: nextHand,
            pendingRerun: null,
        });
    },
    removeTile: (row, col) => {
        const { board, modeId, submittedPositions } = get();
        const cell = board[row]?.[col];
        if (!cell || cell.kind === 'empty')
            return;
        if ('origin' in cell && cell.origin === 'fixed')
            return;
        if (modeId === 'surf-fix' && submittedPositions?.has(positionKey(row, col)))
            return;
        const next = setCell(board, row, col, { kind: 'empty' });
        set({
            board: next,
        });
    },
    moveTile: (fromRow, fromCol, toRow, toCol) => {
        const { board, modeId, chainWords, submittedPositions, playedWords, submittedBentWordPositions, } = get();
        const mode = getMode(modeId);
        const move = { fromRow, fromCol, toRow, toCol };
        const source = moveSourceCell(board, submittedPositions, move);
        const toCell = board[toRow]?.[toCol];
        if (!source)
            return;
        if (!toCell || toCell.kind !== 'empty')
            return;
        if (modeId !== 'surf-fix' && source.wasSubmitted)
            return;
        const validationContext = source.wasSubmitted && modeId === 'surf-fix'
            ? buildStoreBatchMoveContext({
                board,
                submittedPositions,
                playedWords,
                moves: [move],
                submittedBentWordPositions,
                chainWords,
            })
            : null;
        let nextBoard = validationContext?.nextBoard ?? setCell(board, fromRow, fromCol, { kind: 'empty' });
        if (!validationContext)
            nextBoard = setCell(nextBoard, toRow, toCol, source.cell);
        const nextSubmitted = validationContext?.nextSubmittedPositions ?? submittedPositions;
        const movedTileIds = movedTileIdsForSources([source]);
        const nextChainWords = validationContext
            ? applyBatchMoveForMode({
                mode,
                validationContext,
                chainWords,
                movedTileIds,
            })
            : chainWords;
        if (!nextChainWords)
            return;
        set({
            board: nextBoard,
            chainWords: nextChainWords,
            submittedPositions: nextSubmitted,
        });
    },
    moveTilesBatch: (moves) => {
        if (moves.length === 0)
            return;
        if (!moves.some((m) => m.fromRow !== m.toRow || m.fromCol !== m.toCol))
            return;
        if (process.env.NODE_ENV === 'development') {
            for (const m of moves) {
                if (m.fromRow < 0 || m.fromCol < 0) {
                    throw new Error('[moveTilesBatch] sentinel move leaked into store — fix the call site');
                }
            }
        }
        const { board, submittedPositions, submittedBentWordPositions, chainWords, modeId, playedWords, } = get();
        const mode = getMode(modeId);
        const sourceCells = collectMoveSourceCells(board, submittedPositions, moves);
        if (!sourceCells)
            return;
        const validationContext = buildStoreBatchMoveContext({
            board,
            submittedPositions,
            playedWords,
            moves,
            submittedBentWordPositions,
            chainWords,
        });
        if (!batchTargetsAreOpen(board, sourceCells, validationContext.sourceKeys))
            return;
        const movedTileIds = movedTileIdsForSources(sourceCells);
        const nextChainWords = applyBatchMoveForMode({
            mode,
            validationContext,
            chainWords,
            movedTileIds,
        });
        if (!nextChainWords)
            return;
        const nextSubmittedBentWordPositions = nextBentPositionsAfterBatchMove(validationContext, submittedBentWordPositions);
        set({
            board: validationContext.nextBoard,
            chainWords: nextChainWords,
            submittedPositions: validationContext.nextSubmittedPositions,
            submittedBentWordPositions: nextSubmittedBentWordPositions,
        });
    },
    returnTileToHand: (row, col, insertAt) => {
        const { board, hand } = get();
        const cell = board[row]?.[col];
        if (!cell || cell.kind === 'empty')
            return;
        if ('origin' in cell && cell.origin !== 'placed')
            return;
        const submitted = get().submittedPositions;
        if (submitted?.has(`${row}-${col}`))
            return;
        const tileId = cell.handTileId ?? generateId();
        const handTile = handTileFromBoardCell(cell, tileId);
        const next = setCell(board, row, col, { kind: 'empty' });
        set({
            board: next,
            hand: insertAt !== undefined && insertAt >= 0 && insertAt < hand.length
                ? [...hand.slice(0, insertAt), handTile, ...hand.slice(insertAt)]
                : [...hand, handTile],
        });
    },
    returnTileToSupply: (source) => {
        const state = get();
        let tile: HandTile;
        const changes: Partial<GameState> = {};
        if ('row' in source) {
            const { row, col } = source;
            const cell = state.board[row]?.[col];
            if (!cell || cell.kind === 'empty' || cell.origin !== 'placed')
                return false;
            if (state.submittedPositions?.has(`${row}-${col}`))
                return false;
            tile = handTileFromBoardCell(cell, cell.handTileId ?? generateId());
            changes.board = setCell(state.board, row, col, { kind: 'empty' });
        }
        else {
            const handTile = state.hand.find((item) => item.id === source.tileId);
            if (!handTile)
                return false;
            tile = handTile;
        }
        if (tile.kind === 'regular' && tile.isPickTile) {
            changes.pickTilesUsedForRound = Math.max(0, state.pickTilesUsedForRound - 1);
        }
        else if (tile.kind === 'double') {
            changes.doubleTileUsedForRound = false;
            changes.doubleTileIdForRound = null;
            changes.remainingDoubleTiles =
                [...state.remainingDoubleTiles, tile.tileId];
        }
        else if (tile.kind !== 'surfboard') {
            if (!('row' in source))
                return false;
            set({ ...changes, hand: [...state.hand, tile] });
            return true;
        }
        set({ ...changes, hand: state.hand.filter((item) => item.id !== tile.id) });
        return true;
    },
    rotateSwitchTile: (row, col) => {
        const { board, submittedPositions } = get();
        if (submittedPositions?.has(`${row}-${col}`))
            return;
        const cell = board[row]?.[col];
        if (!cell || cell.kind !== 'switch')
            return;
        if (!('activeSide' in cell))
            return;
        const newSide: SwitchSide = cell.activeSide === 'A' ? 'B' : 'A';
        const next = setCell(board, row, col, { ...cell, activeSide: newSide });
        set({
            board: next,
        });
    },
    reorderHand: (activeId, overId) => {
        const { hand } = get();
        const oldIndex = hand.findIndex((t) => t.id === activeId);
        const newIndex = hand.findIndex((t) => t.id === overId);
        if (oldIndex === -1 || newIndex === -1)
            return;
        const next = [...hand];
        const [moved] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, moved);
        set({ hand: next });
    },
    returnPickTile: (tileId) => {
        const tile = get().hand.find((t) => t.id === tileId);
        if (!tile || tile.kind !== 'regular' || !tile.isPickTile)
            return;
        get().returnTileToSupply({ tileId });
    },
    returnDoubleTile: (tileId) => {
        const tile = get().hand.find((t) => t.id === tileId);
        if (!tile || tile.kind !== 'double')
            return;
        get().returnTileToSupply({ tileId });
    },
    returnSurfboardTile: (tileId) => {
        const tile = get().hand.find((t) => t.id === tileId);
        if (!tile || tile.kind !== 'surfboard')
            return;
        get().returnTileToSupply({ tileId });
    },
    sortHand: () => {
        const { hand } = get();
        const sortKey = (t: HandTile) => t.kind === 'regular' ? t.letter
            : t.kind === 'double' ? t.tileId[0]
                : t.kind === 'surfboard' ? '~'
                    : t.sideA.letter;
        const sorted = [...hand].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
        set({ hand: sorted });
    },
    shuffleHand: () => {
        const { hand } = get();
        const shuffled = [...hand];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        set({ hand: shuffled });
    },
    advanceRound: () => {
        const { round } = get();
        const nextRound = round + 1;
        const config = getMode(get().modeId).getRoundConfig(round);
        if (round >= config.totalRounds)
            return;
        set({ round: nextRound, pickTilesUsedForRound: 0, doubleTileUsedForRound: false, doubleTileIdForRound: null });
        get().drawHand();
    },
    applyRideSelection: (tileIds) => {
        const state = get();
        if (state.modeId !== 'surf-fix' || state.authoring?.rideSelection !== 'brush')
            return { ok: false, message: 'Ride selection is not enabled for this game.' };
        try {
            const result = validateSurfFixRideSelection(state, tileIds);
            if (!result.ok)
                return result;
            set({ rideClaim: result.claim });
            return { ok: true };
        }
        catch {
            return { ok: false, message: 'Could not select this Ride. Check the board and try again.' };
        }
    },
    clearRideSelection: (pathKey) => {
        const claim = get().rideClaim;
        set({ rideClaim: pathKey && claim ? removeRideClaim(claim, pathKey) : null });
    },
    choosePrimaryRide: (tileIds, boardKey) => {
        const state = get();
        if (state.modeId !== 'surf-fix' || state.gameOver)
            return { ok: false, message: 'Choose a Ride during a Surf-Fix turn.' };
        try {
            const result = chooseSurfFixRide(state, tileIds, boardKey);
            if (!result.ok)
                return result;
            set({ rideClaim: result.claim });
            return { ok: true };
        }
        catch {
            return { ok: false, message: 'Could not choose this Ride. Check the board and try again.' };
        }
    },
    resetBoard: () => {
        const mode = getMode(get().modeId);
        const { vowelBag, consonantBag, backupVowelBag = [], backupConsonantBag = [], } = mode.buildBags();
        set({
            board: buildBoardForMode(get().modeId),
            authoring: get().modeId === 'surf-fix' ? get().authoring ?? null : null,
            round: 1,
            score: 0,
            vowelBag,
            consonantBag,
            backupVowelBag,
            backupConsonantBag,
            hand: [],
            handDrawnForRound: null,
            handVersion: 0,
            validPositions: null,
            submittedPositions: null,
            submittedBentWordPositions: null,
            animatingPositions: null,
            playedWords: [],
            chainWords: [],
            rideClaim: null,
            gameOver: false,
            toastMessage: null,
            toastTheme: 'default',
            pendingRerun: null,
            pickTilesUsedForRound: 0,
            doubleTileUsedForRound: false,
            doubleTileIdForRound: null,
            remainingDoubleTiles: ['CH', 'PH', 'SH', 'TH', 'CK'],
            ...resolveTimerPrefs(get().modeId),
            roundTimerEndsAt: null,
            timerStatus: 'idle',
            timerPausedRemainingMs: null,
            wildcardMustBeUsedAsXRound: null,
        });
        useGameStore.temporal.getState().clear();
    },
    addScore: (points) => set({ score: get().score + points }),
    addSubmittedPositions: (positions) => {
        const prev = get().submittedPositions;
        const merged = new Set(prev ?? []);
        for (const p of positions)
            merged.add(p);
        set({ submittedPositions: merged });
    },
    addPlayedWords: (words) => set({ playedWords: [...words, ...get().playedWords] }),
    toggleHints: () => set({ hintsEnabled: !get().hintsEnabled }),
    setTimerEnabled: (enabled) => set({
        timerEnabled: enabled,
        roundTimerEndsAt: enabled ? get().roundTimerEndsAt : null,
        timerStatus: enabled ? get().timerStatus : 'idle',
    }),
    setTimerMinutes1_12: (minutes) => set({ timerMinutes1_12: clampTimerMinutes(minutes) }),
    setTimerMinutes13_16: (minutes) => set({ timerMinutes13_16: clampTimerMinutes(minutes) }),
    startRoundTimer: (round, now) => {
        const { timerEnabled, timerMinutes1_12, timerMinutes13_16 } = get();
        if (!timerEnabled)
            return;
        const minutes = round >= 13 ? timerMinutes13_16 : timerMinutes1_12;
        const start = now ?? Date.now();
        set({
            roundTimerEndsAt: start + minutes * 60000,
            timerStatus: 'running',
            timerPausedRemainingMs: null,
        });
    },
    clearRoundTimer: () => set({
        roundTimerEndsAt: null,
        timerStatus: 'idle',
        timerPausedRemainingMs: null,
    }),
    expireRoundTimer: () => set({
        roundTimerEndsAt: null,
        timerStatus: 'expired',
        timerPausedRemainingMs: null,
    }),
    pauseRoundTimer: () => {
        const { timerStatus, roundTimerEndsAt } = get();
        if (timerStatus !== 'running' || !roundTimerEndsAt)
            return;
        const remaining = Math.max(0, roundTimerEndsAt - Date.now());
        set({ timerStatus: 'paused', roundTimerEndsAt: null, timerPausedRemainingMs: remaining });
    },
    resumeRoundTimer: () => {
        const { timerStatus, timerPausedRemainingMs } = get();
        if (timerStatus !== 'paused' || timerPausedRemainingMs === null)
            return;
        set({
            timerStatus: 'running',
            roundTimerEndsAt: Date.now() + timerPausedRemainingMs,
            timerPausedRemainingMs: null,
        });
    },
    rotateHandTile: (tileId) => {
        const { hand } = get();
        const updated = hand.map((t) => t.id === tileId && t.kind === 'switch'
            ? { ...t, activeSide: (t.activeSide === 'A' ? 'B' : 'A') as SwitchSide }
            : t);
        set({ hand: updated });
    },
    addPickTile: (letter) => {
        const { pickTilesUsedForRound, hand, modeId, round } = get();
        const pickLimit = getMode(modeId).getRoundConfig(round).pickTiles;
        if (pickTilesUsedForRound >= pickLimit)
            return 'limit-reached';
        const tile: HandTile = {
            kind: 'regular',
            id: generateId(),
            letter,
            value: LETTER_VALUES[letter],
            category: 'AEIOU'.includes(letter) ? 'vowel' : 'consonant',
            isPickTile: true,
            origin: 'drawer',
        };
        set({
            hand: [...hand, tile],
            pickTilesUsedForRound: pickTilesUsedForRound + 1,
        });
        return 'ok';
    },
    swapBoardTileWithPick: (row, col, letter) => {
        const { board, hand, pickTilesUsedForRound, modeId, round, chainWords } = get();
        const pickLimit = getMode(modeId).getRoundConfig(round).pickTiles;
        if (pickTilesUsedForRound >= pickLimit)
            return 'blocked';
        const cell = board[row]?.[col];
        if (!cell || cell.kind === 'empty' || cell.origin !== 'placed')
            return 'blocked';
        const sp = get().submittedPositions;
        const oldBoardTileId = boardCellTileId(cell, row, col);
        let returnedTile: HandTile;
        if (cell.kind === 'regular') {
            if (sp?.has(`${row}-${col}`))
                return 'blocked';
            if (cell.isPickTile || cell.letter !== letter)
                return 'blocked';
            returnedTile = {
                kind: 'regular',
                id: cell.handTileId ?? generateId(),
                letter: cell.letter,
                value: cell.value,
                category: 'AEIOU'.includes(cell.letter) ? 'vowel' : 'consonant',
                isPickTile: false,
                origin: 'board',
            };
        }
        else {
            return 'blocked';
        }
        const pickHandTileId = generateId();
        const pickCell: BoardCell = {
            kind: 'regular',
            letter,
            value: LETTER_VALUES[letter],
            isPickTile: true,
            origin: 'placed',
            handTileId: pickHandTileId,
        };
        set({
            board: setCell(board, row, col, pickCell),
            hand: [...hand, returnedTile],
            chainWords: replaceWordLedgerTileId(chainWords, oldBoardTileId, pickHandTileId),
            pendingRerun: null,
            pickTilesUsedForRound: pickTilesUsedForRound + 1,
        });
        return 'ok';
    },
    swapPickTileWithRegular: (row, col, handTileId) => {
        const { board, hand, pickTilesUsedForRound } = get();
        const cell = board[row]?.[col];
        if (!cell || cell.kind !== 'regular' || cell.origin !== 'placed' || !cell.isPickTile)
            return 'blocked';
        const sp = get().submittedPositions;
        if (sp?.has(`${row}-${col}`))
            return 'blocked';
        const tileIndex = hand.findIndex((t) => t.id === handTileId);
        if (tileIndex === -1)
            return 'blocked';
        const tile = hand[tileIndex];
        let boardCell: BoardCell;
        if (tile.kind === 'regular' && !tile.isPickTile) {
            if (tile.letter !== cell.letter)
                return 'blocked';
            boardCell = { kind: 'regular', letter: tile.letter, value: tile.value, origin: 'placed', handTileId: tile.id };
        }
        else if (tile.kind === 'switch') {
            const activeLetter = (tile.activeSide === 'A' ? tile.sideA : tile.sideB).letter;
            if (activeLetter !== cell.letter)
                return 'blocked';
            boardCell = { kind: 'switch', id: tile.tileId, sideA: tile.sideA, sideB: tile.sideB, origin: 'placed', activeSide: tile.activeSide, handTileId: tile.id };
        }
        else {
            return 'blocked';
        }
        const nextHand = [...hand];
        nextHand.splice(tileIndex, 1);
        set({
            board: setCell(board, row, col, boardCell),
            hand: nextHand,
            pendingRerun: null,
            pickTilesUsedForRound: Math.max(0, pickTilesUsedForRound - 1),
        });
        return 'ok';
    },
    reclaimSwitchTile: (row, col, handTileId) => {
        const { board, hand, modeId, chainWords } = get();
        if (!canExchangeEquivalentTiles(modeId))
            return 'blocked';
        const cell = board[row]?.[col];
        if (!cell || cell.kind !== 'switch' || cell.origin !== 'placed')
            return 'blocked';
        const oldBoardTileId = boardCellTileId(cell, row, col);
        const activeSide = cell.activeSide ?? 'A';
        const activeLetter = getActiveSwitchLetter(cell);
        const tileIndex = hand.findIndex((t) => t.id === handTileId);
        if (tileIndex === -1)
            return 'blocked';
        const tile = hand[tileIndex];
        if (!canRegularTileReclaimEquivalent(tile, activeLetter))
            return 'blocked';
        const boardCell: BoardCell = {
            kind: 'regular',
            letter: tile.letter,
            value: tile.value,
            origin: 'placed',
            handTileId: tile.id,
        };
        const returnedSwitch: HandTile = {
            kind: 'switch',
            id: cell.handTileId ?? generateId(),
            tileId: cell.id,
            sideA: cell.sideA,
            sideB: cell.sideB,
            activeSide,
            origin: 'board',
        };
        const nextHand = [...hand];
        nextHand.splice(tileIndex, 1);
        set({
            board: setCell(board, row, col, boardCell),
            hand: [...nextHand, returnedSwitch],
            chainWords: replaceWordLedgerTileId(chainWords, oldBoardTileId, tile.id),
            pendingRerun: null,
        });
        return 'ok';
    },
    placeHandSwitchOverRegular: (row, col, handTileId) => {
        const { board, hand, modeId, chainWords } = get();
        if (!canExchangeEquivalentTiles(modeId))
            return 'blocked';
        const cell = board[row]?.[col];
        if (!cell || cell.kind !== 'regular' || cell.origin !== 'placed' || cell.isPickTile)
            return 'blocked';
        const oldBoardTileId = boardCellTileId(cell, row, col);
        const tileIndex = hand.findIndex((t) => t.id === handTileId);
        if (tileIndex === -1)
            return 'blocked';
        const tile = hand[tileIndex];
        if (tile.kind !== 'switch')
            return 'blocked';
        const activeSide = tile.activeSide;
        const activeLetter = (activeSide === 'A' ? tile.sideA : tile.sideB).letter;
        if (activeLetter !== cell.letter)
            return 'blocked';
        const boardCell: BoardCell = {
            kind: 'switch',
            id: tile.tileId,
            sideA: tile.sideA,
            sideB: tile.sideB,
            origin: 'placed',
            activeSide,
            handTileId: tile.id,
        };
        const returnedRegular: HandTile = {
            kind: 'regular',
            id: cell.handTileId ?? generateId(),
            letter: cell.letter,
            value: cell.value,
            category: 'AEIOU'.includes(cell.letter) ? 'vowel' : 'consonant',
            isPickTile: false,
            origin: 'board',
        };
        const nextHand = [...hand];
        nextHand.splice(tileIndex, 1);
        set({
            board: setCell(board, row, col, boardCell),
            hand: [...nextHand, returnedRegular],
            chainWords: replaceWordLedgerTileId(chainWords, oldBoardTileId, tile.id),
            pendingRerun: null,
        });
        return 'ok';
    },
    setWildcardLetter: (row, col, letter) => {
        const { board, modeId, submittedPositions, wildcardMustBeUsedAsXRound, round } = get();
        if (modeId !== 'crosswords' && modeId !== 'surf-fix')
            return;
        const cell = board[row]?.[col];
        if (!cell || cell.kind === 'empty')
            return;
        if (cell.origin !== 'placed')
            return;
        if (submittedPositions?.has(`${row}-${col}`))
            return;
        const isPlacedX = cell.kind === 'regular' && cell.letter === 'X';
        const isWildcard = cell.kind === 'wildcard';
        if (!isPlacedX && !isWildcard)
            return;
        if (cell.kind === 'regular' && cell.isPickTile)
            return;
        if (wildcardMustBeUsedAsXRound === round && letter !== null && letter !== 'X')
            return;
        const handTileId = cell.handTileId;
        let nextCell: BoardCell;
        if (!letter || letter === 'X') {
            nextCell = { kind: 'regular', letter: 'X', value: LETTER_VALUES['X'], origin: 'placed', handTileId };
        }
        else {
            nextCell = { kind: 'wildcard', representsLetter: letter, origin: 'placed', handTileId };
        }
        set({ board: setCell(board, row, col, nextCell) });
    },
    setHandWildcardLetter: (tileId, letter) => {
        const { hand, modeId, wildcardMustBeUsedAsXRound, round } = get();
        const tile = hand.find((t) => t.id === tileId);
        if (!canSetHandWildcardLetter({
            tile,
            modeAllowsWildcardLetters: canChooseWildcardLetters(modeId),
            forceUseXActive: wildcardMustBeUsedAsXRound === round,
            letter,
        }))
            return;
        const representsLetter = normalizeWildcardLetterChoice(letter);
        const nextHand = hand.map((t) => {
            if (t.id !== tileId || t.kind !== 'regular')
                return t;
            const nextTile = { ...t };
            if (representsLetter) {
                nextTile.wildcardRepresentsLetter = representsLetter;
            }
            else {
                delete nextTile.wildcardRepresentsLetter;
            }
            return nextTile;
        });
        set({ hand: nextHand });
    },
    reclaimWildcardTile: (row, col, handTileId) => {
        const { board, hand, modeId, wildcardMustBeUsedAsXRound, round, chainWords } = get();
        if (!canExchangeEquivalentTiles(modeId))
            return 'blocked';
        if (wildcardMustBeUsedAsXRound !== null)
            return 'blocked';
        const cell = board[row]?.[col];
        if (!cell || cell.kind !== 'wildcard' || cell.origin !== 'placed')
            return 'blocked';
        if (cell.representsLetter === undefined)
            return 'blocked';
        const oldBoardTileId = boardCellTileId(cell, row, col);
        const tileIndex = hand.findIndex((t) => t.id === handTileId);
        if (tileIndex === -1)
            return 'blocked';
        const tile = hand[tileIndex];
        if (!canRegularTileReclaimEquivalent(tile, cell.representsLetter))
            return 'blocked';
        const boardCell: BoardCell = {
            kind: 'regular',
            letter: tile.letter,
            value: tile.value,
            origin: 'placed',
            handTileId: tile.id,
        };
        const returnedX: HandTile = {
            kind: 'regular',
            id: cell.handTileId ?? generateId(),
            letter: 'X',
            value: LETTER_VALUES['X'],
            category: 'consonant',
            isPickTile: false,
            origin: 'board',
        };
        const nextHand = [...hand];
        nextHand.splice(tileIndex, 1);
        const forceXHand = nextHand.map((t) => {
            if (t.kind !== 'regular' || t.letter !== 'X' || !t.wildcardRepresentsLetter)
                return t;
            const nextTile = { ...t };
            delete nextTile.wildcardRepresentsLetter;
            return nextTile;
        });
        set({
            board: setCell(board, row, col, boardCell),
            hand: [...forceXHand, returnedX],
            chainWords: replaceWordLedgerTileId(chainWords, oldBoardTileId, tile.id),
            wildcardMustBeUsedAsXRound: round,
        });
        return 'ok';
    },
    addDoubleTile: (tileId) => {
        const { doubleTileUsedForRound, remainingDoubleTiles, hand } = get();
        if (doubleTileUsedForRound || !remainingDoubleTiles.includes(tileId))
            return 'limit-reached';
        const spec = DOUBLE_TILES.find((d) => d.id === tileId);
        if (!spec)
            return 'limit-reached';
        const tile: HandTile = {
            kind: 'double',
            id: generateId(),
            tileId,
            letters: spec.letters,
            value: spec.value,
            origin: 'drawer',
        };
        set({
            hand: [...hand, tile],
            doubleTileUsedForRound: true,
            doubleTileIdForRound: tileId,
            remainingDoubleTiles: remainingDoubleTiles.filter((id) => id !== tileId),
        });
        return 'ok';
    },
    addSurfboardTile: () => {
        const { hand } = get();
        if (hand.filter((t) => t.kind === 'surfboard').length >= 1)
            return 'limit-reached';
        set({
            hand: [...hand, { kind: 'surfboard', id: generateId(), tileId: 'SURF', origin: 'drawer' }],
        });
        return 'ok';
    },
    acceptSubmission: ({ points, newPositions, scored, isLastRound, bentWordPositions, chainWordDrafts }) => {
        const state = get();
        const mergedPositions = new Set(state.submittedPositions ?? []);
        for (const p of newPositions)
            mergedPositions.add(p);
        const mergedBentPositions = new Set(state.submittedBentWordPositions ?? []);
        if (bentWordPositions) {
            for (const p of bentWordPositions)
                mergedBentPositions.add(p);
        }
        const unusedHandTiles: HandTile[] = [];
        const unusedBoardDoubles: string[] = [];
        let newBoard = state.board;
        state.board.forEach((row, r) => {
            row.forEach((cell, c) => {
                const isNewPosition = newPositions.has(`${r}-${c}`);
                const isAlreadySubmitted = state.submittedPositions?.has(`${r}-${c}`);
                if (cell.kind !== 'empty' && 'origin' in cell && cell.origin === 'placed' && !isNewPosition && !isAlreadySubmitted) {
                    const tileId = cell.handTileId ?? generateId();
                    if (cell.kind === 'regular' && !cell.isPickTile) {
                        unusedHandTiles.push({
                            kind: 'regular',
                            id: tileId,
                            letter: cell.letter,
                            value: cell.value,
                            category: 'AEIOU'.includes(cell.letter) ? 'vowel' : 'consonant',
                            isPickTile: false,
                            origin: 'board',
                        });
                    }
                    else if (cell.kind === 'double') {
                        unusedBoardDoubles.push(cell.id ?? '');
                    }
                    else if (cell.kind === 'switch') {
                        unusedHandTiles.push({
                            kind: 'switch',
                            id: tileId,
                            tileId: cell.id ?? '',
                            sideA: cell.sideA,
                            sideB: cell.sideB,
                            activeSide: cell.activeSide ?? 'A',
                            origin: 'board',
                        });
                    }
                    else if (cell.kind === 'wildcard') {
                        unusedHandTiles.push({
                            kind: 'regular',
                            id: tileId,
                            letter: 'X',
                            value: LETTER_VALUES['X'],
                            category: 'consonant',
                            isPickTile: false,
                            origin: 'board',
                        });
                    }
                    newBoard = setCell(newBoard, r, c, { kind: 'empty' });
                }
            });
        });
        const carryoverHand = [
            ...state.hand.filter((t) => !(t.kind === 'regular' && t.isPickTile) && t.kind !== 'double' && t.kind !== 'surfboard'),
            ...unusedHandTiles,
        ];
        const unusedHandDoubles = state.hand.filter(t => t.kind === 'double').map(t => t.tileId);
        const nextRemainingDoubleTiles = [...state.remainingDoubleTiles, ...unusedHandDoubles, ...unusedBoardDoubles];
        const nextChainWords = chainWordDrafts && chainWordDrafts.length > 0
            ? mergeAcceptedChainWords(state.chainWords, chainWordDrafts)
            : state.chainWords;
        const base = {
            board: newBoard,
            hand: carryoverHand,
            handVersion: state.handVersion + 1,
            remainingDoubleTiles: nextRemainingDoubleTiles,
            score: state.score + points,
            submittedPositions: mergedPositions,
            submittedBentWordPositions: mergedBentPositions.size > 0 ? mergedBentPositions : null,
            playedWords: [...scored, ...state.playedWords],
            chainWords: nextChainWords,
        };
        if (isLastRound) {
            set(base);
            return;
        }
        const nextRound = state.round + 1;
        set({
            ...base,
            round: nextRound,
            handDrawnForRound: null,
            pickTilesUsedForRound: 0,
            doubleTileUsedForRound: false,
            doubleTileIdForRound: null,
            pendingRerun: null,
        });
    },
})), {
    partialize: (state) => ({
        rideClaim: state.rideClaim ?? null,
        board: state.board,
        score: state.score,
        hand: state.hand,
        round: state.round,
        submittedPositions: state.submittedPositions,
        submittedBentWordPositions: state.submittedBentWordPositions,
        playedWords: state.playedWords,
        chainWords: state.chainWords,
        handDrawnForRound: state.handDrawnForRound,
        pickTilesUsedForRound: state.pickTilesUsedForRound,
        doubleTileUsedForRound: state.doubleTileUsedForRound,
        doubleTileIdForRound: state.doubleTileIdForRound,
        remainingDoubleTiles: state.remainingDoubleTiles,
        pendingRerun: state.pendingRerun,
        wildcardMustBeUsedAsXRound: state.wildcardMustBeUsedAsXRound,
    }),
    equality: (a, b) => a.rideClaim === b.rideClaim &&
        a.board === b.board &&
        a.score === b.score &&
        a.hand === b.hand &&
        a.round === b.round &&
        a.submittedPositions === b.submittedPositions &&
        a.submittedBentWordPositions === b.submittedBentWordPositions &&
        a.playedWords === b.playedWords &&
        a.chainWords === b.chainWords &&
        a.handDrawnForRound === b.handDrawnForRound &&
        a.pickTilesUsedForRound === b.pickTilesUsedForRound &&
        a.doubleTileUsedForRound === b.doubleTileUsedForRound &&
        a.doubleTileIdForRound === b.doubleTileIdForRound &&
        a.remainingDoubleTiles === b.remainingDoubleTiles &&
        a.pendingRerun === b.pendingRerun &&
        a.wildcardMustBeUsedAsXRound === b.wildcardMustBeUsedAsXRound,
    limit: 200,
}));
export const selectCell = (row: number, col: number) => (state: GameState) => state.board[row]?.[col];
export const selectHand = (state: GameState) => state.hand;
export const selectRound = (state: GameState) => state.round;
export const selectScore = (state: GameState) => state.score;
export const selectHandVersion = (state: GameState) => state.handVersion;
export const selectIsValidPosition = (row: number, col: number) => {
    const key = `${row}-${col}`;
    return (state: GameState) => (state.validPositions?.has(key) ?? false) || (state.submittedPositions?.has(key) ?? false);
};
export const selectAnimDelay = (row: number, col: number) => (state: GameState) => state.animatingPositions?.get(`${row}-${col}`);
export const selectIsSubmittedPosition = (row: number, col: number) => {
    const key = `${row}-${col}`;
    return (state: GameState) => state.submittedPositions?.has(key) ?? false;
};
export const selectPlayedWords = (state: GameState) => state.playedWords;
let lastPlayedWordsRef: GameState['playedWords'] | null = null;
let lastVisiblePlayedWords: GameState['playedWords'] = [];
export const selectVisiblePlayedWords = (state: GameState) => {
    if (state.playedWords === lastPlayedWordsRef)
        return lastVisiblePlayedWords;
    lastPlayedWordsRef = state.playedWords;
    lastVisiblePlayedWords = state.playedWords.filter((entry) => entry.points > 0);
    return lastVisiblePlayedWords;
};
let lastPillPlayedWordsRef: GameState['playedWords'] | null = null;
let lastRoundWordPills: ReturnType<typeof buildRoundWordPills> = [];
export const selectRoundWordPills = (state: GameState) => {
    if (state.playedWords === lastPillPlayedWordsRef)
        return lastRoundWordPills;
    lastPillPlayedWordsRef = state.playedWords;
    lastRoundWordPills = buildRoundWordPills(state.playedWords);
    return lastRoundWordPills;
};
export const selectGameOver = (state: GameState) => state.gameOver;
export const selectPickTilesUsedForRound = (state: GameState) => state.pickTilesUsedForRound;
export const selectPickTileUsedForRound = (state: GameState) => state.pickTilesUsedForRound > 0;
export const selectPickTileLetterForRound = (state: GameState) => {
    const latestPick = [...state.hand].reverse().find((t) => t.kind === 'regular' && t.isPickTile);
    return latestPick && latestPick.kind === 'regular' ? latestPick.letter : null;
};
export const selectDoubleTileUsedForRound = (state: GameState) => state.doubleTileUsedForRound;
export const selectDoubleTileIdForRound = (state: GameState) => state.doubleTileIdForRound;
export const selectRemainingDoubleTiles = (state: GameState) => state.remainingDoubleTiles;
export const selectTimerEnabled = (state: GameState) => state.timerEnabled;
export const selectTimerMinutes1_12 = (state: GameState) => state.timerMinutes1_12;
export const selectTimerMinutes13_16 = (state: GameState) => state.timerMinutes13_16;
export const selectRoundTimerEndsAt = (state: GameState) => state.roundTimerEndsAt;
export const selectTimerStatus = (state: GameState) => state.timerStatus;
export const selectTimerPausedRemainingMs = (state: GameState) => state.timerPausedRemainingMs;
