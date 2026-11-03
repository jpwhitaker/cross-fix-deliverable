import type { GameAuthoring } from '@/lib/game-settings'
import type { BoardCell, BagTile } from '@/lib/game-store';
import type { RoundConfig, Letter } from '@/lib/tiles';
import type { BatchMoveValidationContext, EvaluationResult } from './move-policy';
import type { ExtractedWord } from '@/lib/dictionary';
import type { SurfFixWord, SurfFixWordDraft } from './shared/word-ledger-types';
import type { RideClaim } from '@/lib/predicates/reads/ride-claim';
export type GameModeId = 'keiki-play' | 'crosswords' | 'surf-fix';
export type SubmitResultCode = 'ok' | 'no-placed-tiles' | 'touches-submitted' | 'invalid-sbs' | 'not-accepted' | 'multiple-word-groups' | 'pick-tile-required' | 'no-new-words' | 'too-many-fs-words' | 'wildcard-must-use-as-x' | 'surfboard-orphan' | 'surfboard-x-junction';
export type SubmitResultMeta = {
    words?: ExtractedWord[];
    rejectedSpelling?: string;
    newAcceptedWords?: ExtractedWord[];
    rideKey?: string;
    bentWords?: ExtractedWord[];
    chainWordDrafts?: SurfFixWordDraft[];
    sbsSideContacts?: SubmitSbsSideContact[];
};
export type SubmitSbsSideContact = {
    word: string;
    positions: Array<{
        row: number;
        col: number;
    }>;
    tileIds: string[];
    valuePoints?: number;
};
export type SubmitResult = {
    ok: true;
    code: 'ok';
    meta?: SubmitResultMeta;
} | {
    ok: false;
    code: Exclude<SubmitResultCode, 'ok'>;
    message: string;
    meta?: SubmitResultMeta;
};
export type BatchMoveApplyResult = {
    ok: true;
    chainWords: SurfFixWord[];
} | {
    ok: false;
};
export type ModeBags = {
    vowelBag: BagTile[];
    consonantBag: BagTile[];
    backupVowelBag?: BagTile[];
    backupConsonantBag?: BagTile[];
};
export type LengthBonusContext = {
    board: BoardCell[][];
    word: ExtractedWord;
    submittedPositions: Set<string> | null;
};
export interface GameMode {
    readonly id: GameModeId;
    readonly boardSize: {
        rows: number;
        cols: number;
    };
    readonly seedBoard?: (board: BoardCell[][]) => BoardCell[][];
    readonly pickTilePool: readonly Letter[];
    validateSubmit: (board: BoardCell[][], submittedPositions: Set<string> | null, context?: {
        round: number;
        wildcardMustBeUsedAsXRound: number | null;
        submittedBentWordPositions?: Set<string> | null;
        chainWords?: SurfFixWord[];
        rideClaim?: RideClaim | null;
        authoring?: GameAuthoring | null;
    }) => SubmitResult;
    validateBatchMove: (ctx: BatchMoveValidationContext) => EvaluationResult;
    applyBatchMove?: (ctx: BatchMoveValidationContext, chainWords: SurfFixWord[], movedTileIds: readonly string[]) => BatchMoveApplyResult;
    supportsCompoundArmRotatePivot?: boolean;
    buildBags: () => ModeBags;
    getRoundConfig: (round: number) => RoundConfig;
    shouldWordHaveLengthBonus: (wordKey: string, rideKey: string | null, context?: LengthBonusContext) => boolean;
}
