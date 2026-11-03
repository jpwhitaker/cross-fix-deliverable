import type { SurfFixWord, SurfFixWordDraft } from '@/lib/modes/shared/word-ledger-types';
import { surfFixWordLedgerKind } from '@/lib/modes/shared/word-ledger';
import type { PlayedWordEntry } from '@/lib/presentation/round-word-pills';
import { isStraightSideSequence } from '@/lib/predicates/reads/straight-side-run';
export type LegacySurfFixSbsWord = {
    id: string;
    text: string;
    tileIds: string[];
    cells: Array<{
        row: number;
        col: number;
    }>;
    roundCreated: number;
};
export type SurfFixSbsLedgerSource = {
    word: string;
    positions: Array<{
        row: number;
        col: number;
    }>;
    tileIds: string[];
    round: number;
};
export function surfFixSbsLedgerWordDraftFromSource(source: SurfFixSbsLedgerSource): SurfFixWordDraft | null {
    if (!isStraightSideSequence(source.positions) || source.positions.length !== source.tileIds.length)
        return null;
    return {
        ledgerKind: 'sbs',
        text: source.word,
        orderedTileIds: [...source.tileIds],
        shape: { cells: source.positions.map((cell) => ({ row: cell.row, col: cell.col })) },
        ancestors: [],
        roundCreated: source.round,
        revisionOfWordId: null,
    };
}
export function surfFixSbsLedgerWordsFromPlayedWords(entries: readonly PlayedWordEntry[]): SurfFixWord[] {
    return uniqueSbsWords(entries.flatMap((entry) => {
        if (entry.role !== 'sbs')
            return [];
        const draft = surfFixSbsLedgerWordDraftFromSource({
            word: entry.word,
            positions: entry.highlightPositions ?? [],
            tileIds: entry.highlightTileIds ?? [],
            round: entry.round,
        });
        return draft ? [wordFromSbsDraft(draft)] : [];
    }));
}
export function surfFixSbsLedgerWordsFromLegacyWords(words: readonly LegacySurfFixSbsWord[]): SurfFixWord[] {
    return uniqueSbsWords(words.flatMap((word) => {
        const draft = surfFixSbsLedgerWordDraftFromSource({
            word: word.text,
            positions: word.cells,
            tileIds: word.tileIds,
            round: word.roundCreated,
        });
        return draft ? [wordFromSbsDraft(draft, word.id)] : [];
    }));
}
export function mergeImportedSurfFixSbsLedgerWords(input: {
    chainWords: readonly SurfFixWord[];
    playedWords?: readonly PlayedWordEntry[];
    legacySbsWords?: readonly LegacySurfFixSbsWord[];
}): SurfFixWord[] {
    const migrated = uniqueSbsWords([
        ...surfFixSbsLedgerWordsFromLegacyWords(input.legacySbsWords ?? []),
        ...surfFixSbsLedgerWordsFromPlayedWords(input.playedWords ?? []),
    ]);
    const nextWords = input.chainWords.map(cloneWord);
    for (const word of migrated) {
        if (ledgerContainsSbsSource(nextWords, word))
            continue;
        nextWords.unshift(word);
    }
    return nextWords;
}
export function ledgerContainsSbsSource(words: readonly SurfFixWord[], source: Pick<SurfFixWord, 'text' | 'orderedTileIds' | 'shape'>): boolean {
    const key = sbsLedgerIdentity(source);
    for (const word of words) {
        if (sbsLedgerIdentity(word) === key)
            return true;
        if (word.history.some((snapshot) => sbsLedgerIdentity(snapshot) === key))
            return true;
    }
    return false;
}
function wordFromSbsDraft(draft: SurfFixWordDraft, id = sbsLedgerWordId(draft)): SurfFixWord {
    return {
        id,
        ledgerKind: 'sbs',
        text: draft.text,
        orderedTileIds: [...draft.orderedTileIds],
        shape: { cells: draft.shape.cells.map((cell) => ({ ...cell })) },
        ancestors: [],
        roundCreated: draft.roundCreated,
        history: [],
    };
}
function sbsLedgerWordId(source: Pick<SurfFixWordDraft, 'text' | 'orderedTileIds' | 'shape' | 'roundCreated'>): string {
    return `sbs:${source.roundCreated}:${sbsLedgerIdentity(source)}`;
}
function sbsLedgerIdentity(source: Pick<SurfFixWord, 'text' | 'orderedTileIds' | 'shape'>): string {
    const cells = source.shape.cells.map((cell) => `${cell.row},${cell.col}`).join('|');
    return `${source.text}:${cells}:${source.orderedTileIds.join('|')}`;
}
function uniqueSbsWords(words: readonly SurfFixWord[]): SurfFixWord[] {
    const seen = new Set<string>();
    const unique: SurfFixWord[] = [];
    for (const word of words) {
        const key = sbsLedgerIdentity(word);
        if (seen.has(key))
            continue;
        seen.add(key);
        unique.push(word);
    }
    return unique;
}
function cloneWord(word: SurfFixWord): SurfFixWord {
    const orderedTileIds = word.orderedTileIds ?? [];
    const cells = word.shape?.cells ?? [];
    const ancestors = word.ancestors ?? [];
    const history = word.history ?? [];
    return {
        ...word,
        ledgerKind: surfFixWordLedgerKind(word),
        orderedTileIds: [...orderedTileIds],
        shape: { cells: cells.map((cell) => ({ ...cell })) },
        ancestors: [...ancestors],
        history: history.map((snapshot) => ({
            ...snapshot,
            ledgerKind: surfFixWordLedgerKind(snapshot),
            orderedTileIds: [...(snapshot.orderedTileIds ?? [])],
            shape: { cells: (snapshot.shape?.cells ?? []).map((cell) => ({ ...cell })) },
            ancestors: [...(snapshot.ancestors ?? [])],
        })),
    };
}
