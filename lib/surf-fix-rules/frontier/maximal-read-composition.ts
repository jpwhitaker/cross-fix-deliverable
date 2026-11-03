import { composeReadsAroundSharedCore } from '@/lib/predicates/reads/compose-reads-around-shared-core';
import { cellKey } from '@/lib/surf-fix-rules/frontier/word-frontier';
import type { DraftFrontierCandidate, FrontierRead } from '@/lib/surf-fix-rules/frontier/draft-frontier-evaluator';
import type { Pos, SubmittedWord, TileRegistry } from '@/lib/surf-fix-rules/game/types';
import { buildSurfFixLooseReadTrace, buildSurfFixReadTrace, type SurfFixReadTrace } from '@/lib/surf-fix-rules/trace/read-trace';
export function composeCandidateSiblingsAroundRead(input: {
    candidates: readonly DraftFrontierCandidate[];
    read: FrontierRead;
    words: readonly SubmittedWord[];
    tiles?: TileRegistry;
}): {
    candidates: DraftFrontierCandidate[];
    consumedCandidateIndexes: Set<number>;
} {
    const structuralCompositions = composeReadsAroundSharedCore(input.candidates, input.read);
    const tileTexts = tileTextsById(input.read, input.words, input.tiles);
    const candidates: DraftFrontierCandidate[] = [];
    const consumedCandidateIndexes = new Set<number>();
    for (const composition of structuralCompositions) {
        const leading = input.candidates[composition.leadingReadIndex];
        const trailing = input.candidates[composition.trailingReadIndex];
        if (!leading || !trailing)
            continue;
        if (candidatesShareSubmittedAttachment(leading, trailing))
            continue;
        const composedTileTexts = composition.tileIds.map((tileId) => tileTexts.get(tileId));
        if (composedTileTexts.some((text) => text === undefined))
            continue;
        const text = composedTileTexts.join('');
        const consumedContactCells = uniqueCells([
            ...(leading.consumedContactCells ?? []),
            ...(trailing.consumedContactCells ?? []),
        ]);
        const leadingCandidate = { ...leading };
        delete leadingCandidate.activation;
        candidates.push({
            ...leadingCandidate,
            text,
            cells: composition.cells.map(cloneCell),
            tileIds: [...composition.tileIds],
            transientText: input.read.transientText,
            transientCells: input.read.transientCells.map(cloneCell),
            transientTileIds: [...input.read.transientTileIds],
            source: 'submitted-contact',
            contactOnlyWordIds: uniqueStrings([
                ...leading.contactOnlyWordIds,
                ...trailing.contactOnlyWordIds,
            ]),
            ...(leading.requiresAcceptedConsumption || trailing.requiresAcceptedConsumption
                ? { requiresAcceptedConsumption: true }
                : {}),
            ...(consumedContactCells.length > 0
                ? { consumedContactCells }
                : {}),
            draft: input.read,
            trace: composeCandidateTrace({
                text,
                cells: composition.cells,
                tileIds: composition.tileIds,
                read: input.read,
                leading,
                trailing,
            }),
        });
        consumedCandidateIndexes.add(composition.leadingReadIndex);
        consumedCandidateIndexes.add(composition.trailingReadIndex);
    }
    return { candidates, consumedCandidateIndexes };
}
function candidatesShareSubmittedAttachment(leading: DraftFrontierCandidate, trailing: DraftFrontierCandidate): boolean {
    const leadingWordIds = submittedAttachmentWordIds(leading);
    for (const wordId of submittedAttachmentWordIds(trailing)) {
        if (leadingWordIds.has(wordId))
            return true;
    }
    return false;
}
function submittedAttachmentWordIds(candidate: DraftFrontierCandidate): Set<string> {
    const wordIds = new Set(candidate.baseWordId ? [candidate.baseWordId] : []);
    for (const step of candidate.trace?.steps ?? []) {
        if (step.kind === 'frontier-port' || step.kind === 'straight-through-interior-bridge' || step.kind === 'shared-interior-endpoint' || step.kind === 'submitted-word-edge') {
            wordIds.add(step.wordId);
        }
        if (step.kind === 'draft-submitted-hybrid')
            wordIds.add(step.submittedWordId);
    }
    return wordIds;
}
function tileTextsById(read: FrontierRead, words: readonly SubmittedWord[], tiles?: TileRegistry): Map<string, string> {
    const texts = new Map<string, string>();
    for (const tile of Object.values(tiles ?? {}))
        texts.set(tile.id, tile.letter);
    for (const word of words) {
        word.orderedTileIds.forEach((tileId, index) => {
            const text = word.tileTexts[index];
            if (text !== undefined)
                texts.set(tileId, text);
        });
    }
    read.tileIds.forEach((tileId, index) => {
        const text = read.tileTexts[index];
        if (text !== undefined)
            texts.set(tileId, text);
    });
    return texts;
}
function composeCandidateTrace(input: {
    text: string;
    cells: readonly Pos[];
    tileIds: readonly string[];
    read: FrontierRead;
    leading: DraftFrontierCandidate;
    trailing: DraftFrontierCandidate;
}): SurfFixReadTrace {
    const coreTrace = input.read.trace ?? buildSurfFixLooseReadTrace({
        text: input.read.text,
        cells: input.read.cells,
        tileIds: input.read.tileIds,
    });
    const traces = [input.leading.trace, coreTrace, input.trailing.trace]
        .filter((trace): trace is SurfFixReadTrace => !!trace);
    return buildSurfFixReadTrace({
        text: input.text,
        cells: input.cells,
        tileIds: input.tileIds,
        steps: uniqueSerializedValues(traces.flatMap((trace) => trace.steps)),
        sideContacts: uniqueSerializedValues(traces.flatMap((trace) => trace.sideContacts)),
    });
}
function uniqueSerializedValues<T>(values: readonly T[]): T[] {
    const seen = new Set<string>();
    return values.filter((value) => {
        const key = JSON.stringify(value);
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function uniqueCells(cells: readonly Pos[]): Pos[] {
    const seen = new Set<string>();
    return cells.flatMap((cell) => {
        const key = cellKey(cell);
        if (seen.has(key))
            return [];
        seen.add(key);
        return [cloneCell(cell)];
    });
}
function uniqueStrings(values: readonly string[]): string[] {
    return [...new Set(values)];
}
function cloneCell(cell: Pos): Pos {
    return { row: cell.row, col: cell.col };
}
