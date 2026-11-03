import { candidateTileOrderKey, compareCandidatePriority, uniqueCandidatesByTileOrder } from '@/lib/surf-fix-rules/frontier/candidate-ordering';
import { canShareInteriorEndpoint } from '@/lib/predicates/reads/shared-interior-endpoint';
import { composeCandidateSiblingsAroundRead } from '@/lib/surf-fix-rules/frontier/maximal-read-composition';
import { cellKey, deriveWordFrontier, stepCell, type WordPort } from '@/lib/surf-fix-rules/frontier/word-frontier';
import { deriveAvailableWordFrontier, deriveSubmittedAssemblage, type SubmittedAssemblage } from '@/lib/surf-fix-rules/frontier/submitted-assemblage';
import { isForwardReadingStep } from '@/lib/surf-fix-rules/game/reading-order';
import { forEachSubmittedWordCell } from '@/lib/surf-fix-rules/game/submitted-word-cells';
import type { Direction, Pos, SubmittedWord, SurfFixWord, TileRegistry } from '@/lib/surf-fix-rules/game/types';
import { appendSurfFixReadTracePortStep, buildSurfFixLooseReadTrace, buildSurfFixReadTrace, buildSurfFixReadTraceFromPort, cloneSurfFixReadTrace, type SurfFixReadTrace, type SurfFixTraceStep } from '@/lib/surf-fix-rules/trace/read-trace';
import { deriveDraftRead, type DraftRead, type DraftTile } from '@/lib/surf-fix-rules/walker/derive-draft-read';
export type DraftFrontierEvaluation = {
    candidates: DraftFrontierCandidate[];
    rejectionReason?: string;
    blockedContacts?: DraftBlockedContact[];
};
export type DraftBlockedContact = {
    cell: Pos;
    reason: string;
};
export type FrontierRead = {
    text: string;
    tileTexts: string[];
    cells: Pos[];
    tileIds: string[];
    transientText: string;
    transientCells: Pos[];
    transientTileIds: string[];
    trace?: SurfFixReadTrace;
};
export type DraftFrontierCandidate = {
    text: string;
    cells: Pos[];
    tileIds: string[];
    transientText: string;
    transientCells: Pos[];
    transientTileIds: string[];
    source: 'transient-only' | 'submitted-contact';
    baseWordId?: string;
    baseWordText?: string;
    contactTileIndex?: number;
    contactAffordance?: string;
    contactOnlyWordIds: string[];
    activation?: boolean;
    requiresAcceptedConsumption?: boolean;
    consumedContactCells?: Pos[];
    draft: FrontierRead;
    trace?: SurfFixReadTrace;
};
export function evaluateBoardReadContacts(read: FrontierRead, words: readonly SubmittedWord[]) {
    const assemblage = deriveSubmittedAssemblage(words);
    const ports = words.flatMap((word) => deriveAvailableWordFrontier(word, assemblage, { respectSharedOwnerBlockedFaces: false }).ports.map((port) => ({ word, port })));
    const activations = read.cells.flatMap((cell, index) => ports.flatMap(({ word, port }) => {
        if (!sameCell(port.neighborCell, cell))
            return [];
        const candidate = candidateFromActivationContact(word, port, read, index);
        return candidate ? [candidate] : [];
    }));
    const consumed = new Set(activations.filter((candidate) => !candidate.requiresAcceptedConsumption)
        .flatMap((candidate) => (candidate.consumedContactCells ?? candidate.transientCells).map(cellKey)));
    const contacts = analyzeDraftContacts(read, words, assemblage, consumed);
    return { activations, contactOnlyWordIds: contacts.rejectionReason ? [] : contacts.contactOnlyWordIds };
}
export function evaluateDraftAgainstFrontiers(input: {
    draft: Extract<DraftRead, {
        kind: 'stable';
    }>;
    words: readonly SubmittedWord[];
    tiles?: TileRegistry;
    allowBlockedContacts?: boolean;
}): DraftFrontierEvaluation {
    return evaluateReadAgainstFrontiers({
        read: frontierReadFromDraft(input.draft),
        words: input.words,
        tiles: input.tiles,
        allowBlockedContacts: input.allowBlockedContacts,
    });
}
export function evaluateReadAgainstFrontiers(input: {
    read: FrontierRead;
    words: readonly SubmittedWord[];
    tiles?: TileRegistry;
    allowBlockedContacts?: boolean;
}): DraftFrontierEvaluation {
    const assemblage = deriveSubmittedAssemblage(input.words);
    const submittedCandidates = submittedContactCandidates({
        draft: input.read,
        words: input.words,
        assemblage,
    });
    const endpointShareCandidates = markEndpointSharesCompetingWithExtensions({
        candidates: submittedEndpointShareCandidates({
            draft: input.read,
            words: input.words,
            assemblage,
        }),
        extensionCandidates: submittedCandidates,
        words: input.words,
    });
    const activationCandidates = submittedActivationCandidates({
        draft: input.read,
        words: input.words,
        assemblage,
    });
    const hybridCandidates = draftSubmittedHybridCandidates({
        draft: input.read,
        words: input.words,
    });
    const consumedContactCellKeys = new Set([...activationCandidates, ...hybridCandidates]
        .filter((candidate) => !candidate.requiresAcceptedConsumption)
        .flatMap((candidate) => (candidate.consumedContactCells ?? candidate.transientCells).map(cellKey)));
    const contactAnalysis = analyzeDraftContacts(input.read, input.words, assemblage, consumedContactCellKeys);
    const contactOnlyWordIds = contactAnalysis.rejectionReason ? [] : contactAnalysis.contactOnlyWordIds;
    const transientOnly: DraftFrontierCandidate = {
        text: input.read.text,
        cells: input.read.cells.map(cloneCell),
        tileIds: [...input.read.tileIds],
        transientText: input.read.transientText,
        transientCells: input.read.transientCells.map(cloneCell),
        transientTileIds: [...input.read.transientTileIds],
        source: 'transient-only',
        contactOnlyWordIds: [...contactOnlyWordIds],
        draft: input.read,
        trace: input.read.trace ?? buildSurfFixLooseReadTrace({
            text: input.read.text,
            cells: input.read.cells,
            tileIds: input.read.tileIds,
        }),
    };
    const initialCandidates = uniqueCandidatesByTileOrder([
        transientOnly,
        ...submittedCandidates,
        ...endpointShareCandidates,
        ...activationCandidates,
        ...hybridCandidates,
    ].map((candidate) => withContactOnlyWordIds(candidate, contactOnlyWordIds)));
    const compositions = composeCandidateSiblingsAroundRead({
        candidates: initialCandidates,
        read: input.read,
        words: input.words,
        tiles: input.tiles,
    });
    const candidates = uniqueCandidatesByTileOrder(extendCandidatesToMaximal([
        ...initialCandidates.filter((_, index) => !compositions.consumedCandidateIndexes.has(index)),
        ...compositions.candidates,
    ], input.words, assemblage));
    if (contactAnalysis.rejectionReason) {
        return {
            candidates: input.allowBlockedContacts ? candidates : [],
            rejectionReason: contactAnalysis.rejectionReason,
            ...(input.allowBlockedContacts ? { blockedContacts: contactAnalysis.blockedContacts } : {}),
        };
    }
    return {
        candidates,
        ...(input.allowBlockedContacts ? { blockedContacts: contactAnalysis.blockedContacts } : {}),
    };
}
function frontierReadFromDraft(draft: Extract<DraftRead, {
    kind: 'stable';
}>): FrontierRead {
    return {
        text: draft.text,
        tileTexts: [...draft.tileTexts],
        cells: draft.cells.map(cloneCell),
        tileIds: [...draft.tileIds],
        transientText: draft.text,
        transientCells: draft.cells.map(cloneCell),
        transientTileIds: [...draft.tileIds],
    };
}
function withContactOnlyWordIds(candidate: DraftFrontierCandidate, contactOnlyWordIds: readonly string[]): DraftFrontierCandidate {
    const baseFilteredContactOnlyIds = contactOnlyWordIds.filter((wordId) => wordId !== candidate.baseWordId);
    return {
        ...candidate,
        contactOnlyWordIds: uniqueStrings([...candidate.contactOnlyWordIds, ...baseFilteredContactOnlyIds]),
    };
}
export function pickBestDraftFrontierCandidate(candidates: readonly DraftFrontierCandidate[]): DraftFrontierCandidate | null {
    return [...candidates].sort(compareCandidatePriority)[0] ?? null;
}
export function activationCandidateExtendsReadBoundary(candidate: DraftFrontierCandidate, read: FrontierRead): boolean {
    if (candidate.contactAffordance !== 'pre' && candidate.contactAffordance !== 'post')
        return false;
    const run = activationCandidateReadRun(candidate, read);
    return !!run && (run.start === 0 || run.end === read.tileIds.length - 1);
}
export function activationCandidateUsesRead(candidate: DraftFrontierCandidate, read: FrontierRead): boolean {
    return activationCandidateReadRun(candidate, read) !== null;
}
function activationCandidateReadRun(candidate: DraftFrontierCandidate, read: FrontierRead): {
    start: number;
    end: number;
} | null {
    if (!candidate.activation)
        return null;
    if (candidate.transientTileIds.length === 0)
        return null;
    const readTransientTileIds = new Set(read.transientTileIds);
    if (!candidate.transientTileIds.every((tileId) => readTransientTileIds.has(tileId)))
        return null;
    return findTransientRunInRead(read, candidate);
}
function findTransientRunInRead(read: FrontierRead, candidate: DraftFrontierCandidate): {
    start: number;
    end: number;
} | null {
    for (let start = 0; start <= read.tileIds.length - candidate.transientTileIds.length; start += 1) {
        const matches = candidate.transientTileIds.every((tileId, offset) => {
            const readIndex = start + offset;
            const candidateCell = candidate.transientCells[offset];
            const readCell = read.cells[readIndex];
            return read.tileIds[readIndex] === tileId
                && !!candidateCell
                && !!readCell
                && sameCell(candidateCell, readCell);
        });
        if (matches)
            return { start, end: start + candidate.transientTileIds.length - 1 };
    }
    return null;
}
function submittedContactCandidates(input: {
    draft: FrontierRead;
    words: readonly SubmittedWord[];
    assemblage: SubmittedAssemblage;
}): DraftFrontierCandidate[] {
    const first = input.draft.cells[0];
    const last = input.draft.cells[input.draft.cells.length - 1];
    const candidates: DraftFrontierCandidate[] = [];
    for (const word of input.words) {
        const frontier = deriveAvailableWordFrontier(word, input.assemblage);
        for (const port of frontier.ports) {
            if (first && sameCell(port.neighborCell, first)) {
                const candidate = candidateFromLeadingContact(word, port, input.draft);
                if (candidate)
                    candidates.push(candidate);
            }
            if (last && port.effect === 'start-word' && sameCell(port.neighborCell, last)) {
                const candidate = candidateFromSeedTrailingContact(word, port, input.draft);
                if (candidate)
                    candidates.push(candidate);
            }
        }
    }
    return candidates;
}
function candidateFromSeedLeadingContact(word: SubmittedWord, port: WordPort, draft: FrontierRead): DraftFrontierCandidate | null {
    const first = draft.cells[0];
    if (!first || !isForwardReadingStep(port.anchorCell, first))
        return null;
    const contactKind = classifyLeadingContactByDraftDirection(port, draft);
    if (!contactKind)
        return null;
    const tileId = word.orderedTileIds[port.tileIndex];
    const text = word.tileTexts[port.tileIndex];
    if (!tileId || !text)
        return null;
    const cells = [cloneCell(port.anchorCell), ...draft.cells.map(cloneCell)];
    const tileIds = [tileId, ...draft.tileIds];
    const candidateText = `${text}${draft.text}`;
    return {
        text: candidateText,
        cells,
        tileIds,
        transientText: draft.transientText,
        transientCells: draft.transientCells.map(cloneCell),
        transientTileIds: [...draft.transientTileIds],
        source: 'submitted-contact',
        baseWordId: word.id,
        baseWordText: word.text,
        contactTileIndex: port.tileIndex,
        contactAffordance: port.affordance,
        contactOnlyWordIds: contactKind === 'side-share' ? [word.id] : [],
        draft,
        trace: buildSurfFixReadTraceFromPort({
            text: candidateText,
            cells,
            tileIds,
            port,
        }),
    };
}
function candidateFromLeadingContact(word: SubmittedWord, port: WordPort, draft: FrontierRead): DraftFrontierCandidate | null {
    if (port.effect === 'start-word')
        return candidateFromSeedLeadingContact(word, port, draft);
    if (port.effect === 'preserve-word')
        return candidateFromOuterEdgeLeadingContact(word, port, draft);
    if (port.affordance === 'end-border')
        return null;
    if (port.effect !== 'extend-end' && port.effect !== 'exit-interior')
        return null;
    const baseCells = word.shape.cells.slice(0, port.tileIndex + 1).map(cloneCell);
    const baseTileIds = word.orderedTileIds.slice(0, port.tileIndex + 1);
    const baseText = word.tileTexts.slice(0, port.tileIndex + 1).join('');
    const extension = port.effect === 'extend-end'
        ? collectDraftRunFromIndex(draft, 0, port.direction)
        : draftRunFromRange(draft, 0, draft.cells.length);
    if (!extension)
        return null;
    const partialDraftExtension = extension.tileIds.length < draft.tileIds.length;
    const cells = [...baseCells, ...extension.cells];
    const tileIds = [...baseTileIds, ...extension.tileIds];
    const text = `${baseText}${extension.text}`;
    const consumedCells = partialDraftExtension && draft.cells[0] ? [draft.cells[0]] : [];
    return {
        text,
        cells,
        tileIds,
        transientText: extension.text,
        transientCells: extension.cells,
        transientTileIds: extension.tileIds,
        source: 'submitted-contact',
        baseWordId: word.id,
        baseWordText: word.text,
        contactTileIndex: port.tileIndex,
        contactAffordance: port.affordance,
        contactOnlyWordIds: [],
        ...(partialDraftExtension ? {
            activation: true,
            consumedContactCells: consumedCells.map(cloneCell),
        } : {}),
        draft,
        trace: buildSurfFixReadTraceFromPort({
            text,
            cells,
            tileIds,
            port,
            consumedCells,
        }),
    };
}
function candidateFromSeedTrailingContact(word: SubmittedWord, port: WordPort, draft: FrontierRead): DraftFrontierCandidate | null {
    const last = draft.cells[draft.cells.length - 1];
    if (!last || !isForwardReadingStep(last, port.anchorCell))
        return null;
    const contactKind = classifyTrailingContactByDraftDirection(port, draft);
    if (!contactKind)
        return null;
    const tileId = word.orderedTileIds[port.tileIndex];
    const text = word.tileTexts[port.tileIndex];
    if (!tileId || !text)
        return null;
    const cells = [...draft.cells.map(cloneCell), cloneCell(port.anchorCell)];
    const tileIds = [...draft.tileIds, tileId];
    const candidateText = `${draft.text}${text}`;
    return {
        text: candidateText,
        cells,
        tileIds,
        transientText: draft.transientText,
        transientCells: draft.transientCells.map(cloneCell),
        transientTileIds: [...draft.transientTileIds],
        source: 'submitted-contact',
        baseWordId: word.id,
        baseWordText: word.text,
        contactTileIndex: port.tileIndex,
        contactAffordance: port.affordance,
        contactOnlyWordIds: contactKind === 'side-share' ? [word.id] : [],
        draft,
        trace: appendOrBuildPortTrace(draft, candidateText, cells, tileIds, port),
    };
}
function classifyLeadingContactByDraftDirection(port: WordPort, draft: FrontierRead): 'extension' | 'side-share' | null {
    const first = draft.cells[0];
    if (!first)
        return null;
    const contactDirection = directionBetween(port.anchorCell, first);
    if (!contactDirection)
        return null;
    const second = draft.cells[1];
    if (!second)
        return 'extension';
    const draftDirection = directionBetween(first, second);
    if (!draftDirection)
        return null;
    return contactDirection === draftDirection ? 'extension' : 'side-share';
}
function classifyTrailingContactByDraftDirection(port: WordPort, draft: FrontierRead): 'extension' | 'side-share' | null {
    const last = draft.cells[draft.cells.length - 1];
    if (!last)
        return null;
    const contactDirection = directionBetween(last, port.anchorCell);
    if (!contactDirection)
        return null;
    const previous = draft.cells[draft.cells.length - 2];
    if (!previous)
        return 'extension';
    const draftDirection = directionBetween(previous, last);
    if (!draftDirection)
        return null;
    return contactDirection === draftDirection ? 'extension' : 'side-share';
}
function candidateFromOuterEdgeLeadingContact(word: SubmittedWord, port: WordPort, draft: FrontierRead): DraftFrontierCandidate | null {
    if (!isForwardReadingStep(port.anchorCell, draft.cells[0]))
        return null;
    const tileId = word.orderedTileIds[port.tileIndex];
    const text = word.tileTexts[port.tileIndex];
    if (!tileId || !text)
        return null;
    const cells = [{ ...port.anchorCell }, ...draft.cells.map(cloneCell)];
    const tileIds = [tileId, ...draft.tileIds];
    const candidateText = `${text}${draft.text}`;
    return {
        text: candidateText,
        cells,
        tileIds,
        transientText: draft.transientText,
        transientCells: draft.transientCells.map(cloneCell),
        transientTileIds: [...draft.transientTileIds],
        source: 'submitted-contact',
        baseWordId: word.id,
        baseWordText: word.text,
        contactTileIndex: port.tileIndex,
        contactAffordance: port.affordance,
        contactOnlyWordIds: [],
        draft,
        trace: appendOrBuildPortTrace(draft, candidateText, cells, tileIds, port),
    };
}
function submittedEndpointShareCandidates(input: {
    draft: FrontierRead;
    words: readonly SubmittedWord[];
    assemblage: SubmittedAssemblage;
}): DraftFrontierCandidate[] {
    const first = input.draft.cells[0];
    const last = input.draft.cells[input.draft.cells.length - 1];
    const candidates: DraftFrontierCandidate[] = [];
    for (const word of input.words) {
        const frontier = deriveAvailableWordFrontier(word, input.assemblage);
        for (const port of frontier.ports) {
            if (!isEndpointSharePort(word, port))
                continue;
            if (first && sameCell(port.neighborCell, first)) {
                const candidate = candidateFromEndpointShareLeadingContact(word, port, input.draft);
                if (candidate)
                    candidates.push(candidate);
            }
            if (last && sameCell(port.neighborCell, last)) {
                const candidate = candidateFromEndpointShareTrailingContact(word, port, input.draft);
                if (candidate)
                    candidates.push(candidate);
            }
        }
    }
    return candidates;
}
function markEndpointSharesCompetingWithExtensions(input: {
    candidates: readonly DraftFrontierCandidate[];
    extensionCandidates: readonly DraftFrontierCandidate[];
    words: readonly SubmittedWord[];
}): DraftFrontierCandidate[] {
    return input.candidates.map((candidate) => (endpointShareCompetesWithExtension(candidate, input.extensionCandidates, input.words)
        ? { ...candidate, requiresAcceptedConsumption: true }
        : candidate));
}
function endpointShareCompetesWithExtension(endpointCandidate: DraftFrontierCandidate, extensionCandidates: readonly DraftFrontierCandidate[], words: readonly SubmittedWord[]): boolean {
    const contact = endpointShareContact(endpointCandidate);
    if (!contact)
        return false;
    return extensionCandidates.some((extensionCandidate) => (extensionCandidateClaimsContact(extensionCandidate, contact, words)));
}
function endpointShareContact(candidate: DraftFrontierCandidate): {
    anchorCell: Pos;
    touchCell: Pos;
} | null {
    if (candidate.tileIds.length !== candidate.draft.tileIds.length + 1)
        return null;
    const leading = candidate.draft.tileIds.every((tileId, index) => candidate.tileIds[index + 1] === tileId);
    if (leading) {
        const anchorCell = candidate.cells[0];
        const touchCell = candidate.draft.cells[0];
        return anchorCell && touchCell ? { anchorCell, touchCell } : null;
    }
    const trailing = candidate.draft.tileIds.every((tileId, index) => candidate.tileIds[index] === tileId);
    if (trailing) {
        const anchorCell = candidate.cells[candidate.cells.length - 1];
        const touchCell = candidate.draft.cells[candidate.draft.cells.length - 1];
        return anchorCell && touchCell ? { anchorCell, touchCell } : null;
    }
    return null;
}
function extensionCandidateClaimsContact(candidate: DraftFrontierCandidate, contact: {
    anchorCell: Pos;
    touchCell: Pos;
}, words: readonly SubmittedWord[]): boolean {
    if (candidate.contactAffordance !== 'pre' && candidate.contactAffordance !== 'post')
        return false;
    const anchorCell = candidateAnchorCell(candidate, words);
    if (!anchorCell || !sameCell(anchorCell, contact.anchorCell))
        return false;
    return candidate.transientCells.some((cell) => sameCell(cell, contact.touchCell));
}
function candidateAnchorCell(candidate: DraftFrontierCandidate, words: readonly SubmittedWord[]): Pos | null {
    if (!candidate.baseWordId || candidate.contactTileIndex === undefined)
        return null;
    const word = words.find((entry) => entry.id === candidate.baseWordId);
    return word?.shape.cells[candidate.contactTileIndex] ?? null;
}
function candidateFromEndpointShareLeadingContact(word: SubmittedWord, port: WordPort, draft: FrontierRead): DraftFrontierCandidate | null {
    if (classifyLeadingContactByDraftDirection(port, draft) !== 'extension')
        return null;
    if (!isForwardReadingStep(port.anchorCell, draft.cells[0]))
        return null;
    const tileId = word.orderedTileIds[port.tileIndex];
    const text = word.tileTexts[port.tileIndex];
    if (!tileId || !text)
        return null;
    const cells = [cloneCell(port.anchorCell), ...draft.cells.map(cloneCell)];
    const tileIds = [tileId, ...draft.tileIds];
    const candidateText = `${text}${draft.text}`;
    return {
        text: candidateText,
        cells,
        tileIds,
        transientText: draft.transientText,
        transientCells: draft.transientCells.map(cloneCell),
        transientTileIds: [...draft.transientTileIds],
        source: 'submitted-contact',
        baseWordId: word.id,
        baseWordText: word.text,
        contactTileIndex: port.tileIndex,
        contactAffordance: port.affordance,
        contactOnlyWordIds: [],
        draft,
        trace: appendOrBuildPortTrace(draft, candidateText, cells, tileIds, port),
    };
}
function candidateFromEndpointShareTrailingContact(word: SubmittedWord, port: WordPort, draft: FrontierRead): DraftFrontierCandidate | null {
    if (classifyTrailingContactByDraftDirection(port, draft) !== 'extension')
        return null;
    const last = draft.cells[draft.cells.length - 1];
    if (!last || !isForwardReadingStep(last, port.anchorCell))
        return null;
    const tileId = word.orderedTileIds[port.tileIndex];
    const text = word.tileTexts[port.tileIndex];
    if (!tileId || !text)
        return null;
    const cells = [...draft.cells.map(cloneCell), cloneCell(port.anchorCell)];
    const tileIds = [...draft.tileIds, tileId];
    const candidateText = `${draft.text}${text}`;
    return {
        text: candidateText,
        cells,
        tileIds,
        transientText: draft.transientText,
        transientCells: draft.transientCells.map(cloneCell),
        transientTileIds: [...draft.transientTileIds],
        source: 'submitted-contact',
        baseWordId: word.id,
        baseWordText: word.text,
        contactTileIndex: port.tileIndex,
        contactAffordance: port.affordance,
        contactOnlyWordIds: [],
        draft,
        trace: appendOrBuildPortTrace(draft, candidateText, cells, tileIds, port),
    };
}
function isEndpointSharePort(word: SubmittedWord, port: WordPort): boolean {
    const isEndpoint = port.tileIndex === 0 || port.tileIndex === word.shape.cells.length - 1;
    const pathDirection = endpointPathDirection(word, port.tileIndex);
    return isEndpoint && !!pathDirection && directionsArePerpendicular(pathDirection, port.direction) && (port.affordance === 'outer-edge'
        || port.affordance === 'start-border'
        || port.affordance === 'end-border');
}
function endpointPathDirection(word: SubmittedWord, tileIndex: number): Direction | null {
    if (tileIndex === 0) {
        const current = word.shape.cells[0];
        const next = word.shape.cells[1];
        return current && next ? directionBetween(current, next) : null;
    }
    if (tileIndex === word.shape.cells.length - 1) {
        const previous = word.shape.cells[tileIndex - 1];
        const current = word.shape.cells[tileIndex];
        return previous && current ? directionBetween(previous, current) : null;
    }
    return null;
}
function directionsArePerpendicular(a: Direction, b: Direction): boolean {
    return ((isVerticalDirection(a) && isHorizontalDirection(b))
        || (isHorizontalDirection(a) && isVerticalDirection(b)));
}
function appendOrBuildPortTrace(read: FrontierRead, text: string, cells: readonly Pos[], tileIds: readonly string[], port: WordPort): SurfFixReadTrace {
    return read.trace
        ? appendSurfFixReadTracePortStep({
            trace: read.trace,
            text,
            cells,
            tileIds,
            port,
        })
        : buildSurfFixReadTraceFromPort({
            text,
            cells,
            tileIds,
            port,
        });
}
function uniqueStrings(values: readonly string[]): string[] {
    return [...new Set(values)];
}
function isVerticalDirection(direction: Direction): boolean {
    return direction === 'up' || direction === 'down';
}
function isHorizontalDirection(direction: Direction): boolean {
    return direction === 'left' || direction === 'right';
}
function draftEntersBendEntryCollinearly(draft: FrontierRead, draftTileIndex: number, word: SubmittedWord, port: WordPort): boolean {
    const previous = draft.cells[draftTileIndex - 1];
    const current = draft.cells[draftTileIndex];
    if (!previous || !current)
        return false;
    const incoming = directionBetween(previous, current);
    const continuation = submittedContinuationDirection(word, port);
    return !!incoming && !!continuation && incoming === continuation;
}
function candidateEntersBendEntryCollinearly(candidate: DraftFrontierCandidate, word: SubmittedWord, port: WordPort): boolean {
    const previous = candidate.cells[candidate.cells.length - 2];
    const current = candidate.cells[candidate.cells.length - 1];
    if (!previous || !current)
        return false;
    const incoming = directionBetween(previous, current);
    const continuation = submittedContinuationDirection(word, port);
    return !!incoming && !!continuation && incoming === continuation;
}
function submittedContinuationDirection(word: SubmittedWord, port: WordPort): Direction | null {
    const current = word.shape.cells[port.tileIndex];
    const next = word.shape.cells[port.tileIndex + 1];
    return current && next ? directionBetween(current, next) : null;
}
function submittedActivationCandidates(input: {
    draft: FrontierRead;
    words: readonly SubmittedWord[];
    assemblage: SubmittedAssemblage;
}): DraftFrontierCandidate[] {
    const candidates: DraftFrontierCandidate[] = [];
    for (let index = 0; index < input.draft.cells.length; index += 1) {
        const isDraftStart = index === 0;
        const isDraftEndpoint = index === input.draft.cells.length - 1;
        const cell = input.draft.cells[index];
        for (const word of input.words) {
            const frontier = deriveAvailableWordFrontier(word, input.assemblage);
            for (const port of frontier.ports) {
                if (!sameCell(port.neighborCell, cell))
                    continue;
                if (isDraftStart && port.effect !== 'enter-interior' && port.effect !== 'extend-start' && port.effect !== 'exit-interior')
                    continue;
                if (isDraftEndpoint && port.effect !== 'exit-interior' && port.effect !== 'extend-end' && port.effect !== 'enter-interior')
                    continue;
                if (isDraftEndpoint
                    && port.effect === 'enter-interior'
                    && draftEntersBendEntryCollinearly(input.draft, index, word, port))
                    continue;
                const candidate = candidateFromActivationContact(word, port, input.draft, index);
                if (candidate)
                    candidates.push(candidate);
            }
        }
    }
    return candidates;
}
function candidateFromActivationContact(word: SubmittedWord, port: WordPort, draft: FrontierRead, draftTileIndex: number): DraftFrontierCandidate | null {
    if (port.affordance === 'start-border' || port.affordance === 'end-border')
        return null;
    const draftCell = draft.cells[draftTileIndex];
    if (!draftCell || !draft.tileIds[draftTileIndex] || !draft.tileTexts[draftTileIndex])
        return null;
    if (port.effect === 'extend-end') {
        const baseCells = word.shape.cells.slice(0, port.tileIndex + 1).map(cloneCell);
        const baseTileIds = word.orderedTileIds.slice(0, port.tileIndex + 1);
        const baseText = word.tileTexts.slice(0, port.tileIndex + 1).join('');
        const extension = collectDraftRunFromIndex(draft, draftTileIndex, port.direction);
        if (!extension)
            return null;
        const cells = [...baseCells, ...extension.cells];
        const tileIds = [...baseTileIds, ...extension.tileIds];
        const text = `${baseText}${extension.text}`;
        const consumedCells = [cloneCell(draftCell)];
        return {
            text,
            cells,
            tileIds,
            transientText: extension.text,
            transientCells: extension.cells,
            transientTileIds: extension.tileIds,
            source: 'submitted-contact',
            baseWordId: word.id,
            baseWordText: word.text,
            contactTileIndex: port.tileIndex,
            contactAffordance: port.affordance,
            contactOnlyWordIds: [],
            activation: true,
            consumedContactCells: consumedCells,
            draft,
            trace: buildSurfFixReadTraceFromPort({
                text,
                cells,
                tileIds,
                port,
                consumedCells,
            }),
        };
    }
    if (port.effect === 'exit-interior') {
        const baseCells = word.shape.cells.slice(0, port.tileIndex + 1).map(cloneCell);
        const baseTileIds = word.orderedTileIds.slice(0, port.tileIndex + 1);
        const baseText = word.tileTexts.slice(0, port.tileIndex + 1).join('');
        const draftTileId = draft.tileIds[draftTileIndex];
        const draftLetter = draft.tileTexts[draftTileIndex];
        if (!draftTileId || !draftLetter)
            return null;
        const cells = [...baseCells, cloneCell(draftCell)];
        const tileIds = [...baseTileIds, draftTileId];
        const text = `${baseText}${draftLetter}`;
        const consumedCells = [cloneCell(draftCell)];
        return {
            text,
            cells,
            tileIds,
            transientText: draftLetter,
            transientCells: [cloneCell(draftCell)],
            transientTileIds: [draftTileId],
            source: 'submitted-contact',
            baseWordId: word.id,
            baseWordText: word.text,
            contactTileIndex: port.tileIndex,
            contactAffordance: port.affordance,
            contactOnlyWordIds: [],
            activation: true,
            consumedContactCells: consumedCells,
            draft,
            trace: buildSurfFixReadTraceFromPort({
                text,
                cells,
                tileIds,
                port,
                consumedCells,
            }),
        };
    }
    if (port.effect === 'extend-start') {
        const startIndex = 0;
        const suffixCells = word.shape.cells.slice(startIndex).map(cloneCell);
        const suffixTileIds = word.orderedTileIds.slice(startIndex);
        const suffixText = word.tileTexts.slice(startIndex).join('');
        const extension = collectDraftRunFromIndex(draft, draftTileIndex, port.direction, { reverse: true });
        if (!extension)
            return null;
        const cells = [...extension.cells, ...suffixCells];
        const tileIds = [...extension.tileIds, ...suffixTileIds];
        const text = `${extension.text}${suffixText}`;
        const consumedCells = [cloneCell(draftCell)];
        return {
            text,
            cells,
            tileIds,
            transientText: extension.text,
            transientCells: extension.cells,
            transientTileIds: extension.tileIds,
            source: 'submitted-contact',
            baseWordId: word.id,
            baseWordText: word.text,
            contactTileIndex: port.tileIndex,
            contactAffordance: port.affordance,
            contactOnlyWordIds: [],
            activation: true,
            consumedContactCells: consumedCells,
            draft,
            trace: buildSurfFixReadTraceFromPort({
                text,
                cells,
                tileIds,
                port,
                consumedCells,
            }),
        };
    }
    if (port.effect === 'enter-interior') {
        const suffixCells = word.shape.cells.slice(port.tileIndex).map(cloneCell);
        const suffixTileIds = word.orderedTileIds.slice(port.tileIndex);
        const suffixText = word.tileTexts.slice(port.tileIndex).join('');
        const draftTileId = draft.tileIds[draftTileIndex];
        const draftLetter = draft.tileTexts[draftTileIndex];
        if (!draftTileId || !draftLetter)
            return null;
        const cells = [cloneCell(draftCell), ...suffixCells];
        const tileIds = [draftTileId, ...suffixTileIds];
        const text = `${draftLetter}${suffixText}`;
        const consumedCells = [cloneCell(draftCell)];
        return {
            text,
            cells,
            tileIds,
            transientText: draftLetter,
            transientCells: [cloneCell(draftCell)],
            transientTileIds: [draftTileId],
            source: 'submitted-contact',
            baseWordId: word.id,
            baseWordText: word.text,
            contactTileIndex: port.tileIndex,
            contactAffordance: port.affordance,
            contactOnlyWordIds: [],
            activation: true,
            consumedContactCells: consumedCells,
            draft,
            trace: buildSurfFixReadTraceFromPort({
                text,
                cells,
                tileIds,
                port,
                consumedCells,
            }),
        };
    }
    return null;
}
type SubmittedContactTile = {
    word: SubmittedWord;
    tileId: string;
    letter: string;
    cell: Pos;
    index: number;
};
function draftSubmittedHybridCandidates(input: {
    draft: FrontierRead;
    words: readonly SubmittedWord[];
}): DraftFrontierCandidate[] {
    const draftWord: SurfFixWord = {
        id: 'draft',
        text: input.draft.text,
        tileTexts: [...input.draft.tileTexts],
        orderedTileIds: [...input.draft.tileIds],
        shape: { cells: input.draft.cells.map(cloneCell) },
    };
    const submittedByCell = submittedContactTilesByCell(input.words);
    const candidates: DraftFrontierCandidate[] = [];
    const occupied = new Set([...input.words.flatMap((word) => word.shape.cells), ...input.draft.cells].map(cellKey));
    for (const port of deriveWordFrontier(draftWord).ports) {
        if (!isPotentialDraftHybridPort(port))
            continue;
        const submittedTiles = submittedByCell.get(cellKey(port.neighborCell)) ?? [];
        for (const submitted of submittedTiles) {
            if (input.draft.tileIds.includes(submitted.tileId))
                continue;
            const candidate = candidateFromDraftHybridContact(submitted, port, input.draft, occupied);
            if (candidate)
                candidates.push(candidate);
        }
    }
    return uniqueCandidatesByTileOrder(candidates);
}
function submittedContactTilesByCell(words: readonly SubmittedWord[]): Map<string, SubmittedContactTile[]> {
    const byCell = new Map<string, SubmittedContactTile[]>();
    forEachSubmittedWordCell(words, ({ word, index, cell, tileId, letter }) => {
        if (!letter)
            return;
        const key = cellKey(cell);
        byCell.set(key, [...(byCell.get(key) ?? []), {
                word,
                tileId,
                letter,
                cell: cloneCell(cell),
                index,
            }]);
    });
    return byCell;
}
function isPotentialDraftHybridPort(port: WordPort): boolean {
    return (port.effect === 'enter-interior'
        || port.effect === 'extend-start'
        || port.effect === 'extend-end'
        || port.effect === 'start-word');
}
function candidateFromDraftHybridContact(submitted: SubmittedContactTile, port: WordPort, draft: FrontierRead, occupied: ReadonlySet<string>): DraftFrontierCandidate | null {
    const contactCell = draft.cells[port.tileIndex];
    if (!contactCell)
        return null;
    if (port.effect === 'enter-interior') {
        if (!submittedFaceHasInvalidate(submitted, contactCell))
            return null;
        return draftHybridCandidate({
            submitted,
            port,
            draft,
            text: `${submitted.letter}${draft.tileTexts.slice(port.tileIndex).join('')}`,
            cells: [submitted.cell, ...draft.cells.slice(port.tileIndex)],
            tileIds: [submitted.tileId, ...draft.tileIds.slice(port.tileIndex)],
            transientText: draft.tileTexts.slice(port.tileIndex).join(''),
            transientCells: draft.cells.slice(port.tileIndex),
            transientTileIds: draft.tileIds.slice(port.tileIndex),
            contactCell,
        });
    }
    return candidateFromSubmittedEndpointContact(submitted, port, draft, contactCell, occupied);
}
function candidateFromSubmittedEndpointContact(submitted: SubmittedContactTile, port: WordPort, draft: FrontierRead, contactCell: Pos, occupied: ReadonlySet<string>): DraftFrontierCandidate | null {
    if (!isDraftEndpointExtensionPort(port))
        return null;
    const isHyphenEndpoint = submitted.letter === '-' && submittedFaceHasInvalidate(submitted, contactCell);
    const isSingleTileInteriorSideEndpoint = submitted.letter !== '-'
        && submittedFaceHasStraightInteriorSideInvalidate(submitted, contactCell)
        && canShareInteriorEndpoint(submitted.word.shape.cells, submitted.index, contactCell, occupied);
    if (!isHyphenEndpoint && !isSingleTileInteriorSideEndpoint)
        return null;
    const read = deriveDraftRead([
        ...draftTilesForRead(draft),
        {
            id: submitted.tileId,
            letter: submitted.letter,
            row: submitted.cell.row,
            col: submitted.cell.col,
        },
    ]);
    if (read.kind !== 'stable')
        return null;
    const submittedReadIndex = read.tileIds.indexOf(submitted.tileId);
    if (submittedReadIndex !== 0 && submittedReadIndex !== read.tileIds.length - 1)
        return null;
    return draftHybridCandidate({
        submitted,
        port,
        draft,
        text: read.text,
        cells: read.cells,
        tileIds: read.tileIds,
        transientText: draft.text,
        transientCells: draft.cells,
        transientTileIds: draft.tileIds,
        contactCell,
        activation: isSingleTileInteriorSideEndpoint,
        requiresAcceptedConsumption: isSingleTileInteriorSideEndpoint,
    });
}
function isDraftEndpointExtensionPort(port: WordPort): boolean {
    return port.effect === 'extend-start' || port.effect === 'extend-end' || port.effect === 'start-word';
}
function draftTilesForRead(draft: FrontierRead): DraftTile[] {
    return draft.cells.flatMap((cell, index) => {
        const id = draft.tileIds[index];
        const letter = draft.tileTexts[index];
        if (!id || !letter)
            return [];
        return {
            id,
            letter,
            row: cell.row,
            col: cell.col,
        };
    });
}
function submittedFaceHasInvalidate(submitted: SubmittedContactTile, draftCell: Pos): boolean {
    return deriveWordFrontier(submitted.word).ports.some((port) => (port.tileIndex === submitted.index
        && port.effect === 'invalidate'
        && sameCell(port.anchorCell, submitted.cell)
        && sameCell(port.neighborCell, draftCell)));
}
function submittedFaceHasStraightInteriorSideInvalidate(submitted: SubmittedContactTile, draftCell: Pos): boolean {
    return deriveWordFrontier(submitted.word).ports.some((port) => (port.tileIndex === submitted.index
        && port.effect === 'invalidate'
        && port.reason === 'straight-interior-side'
        && sameCell(port.anchorCell, submitted.cell)
        && sameCell(port.neighborCell, draftCell)));
}
function draftHybridCandidate(input: {
    submitted: SubmittedContactTile;
    port: WordPort;
    draft: FrontierRead;
    text: string;
    cells: readonly Pos[];
    tileIds: readonly string[];
    transientText: string;
    transientCells: readonly Pos[];
    transientTileIds: readonly string[];
    contactCell: Pos;
    activation?: boolean;
    requiresAcceptedConsumption?: boolean;
}): DraftFrontierCandidate {
    return {
        text: input.text,
        cells: input.cells.map(cloneCell),
        tileIds: [...input.tileIds],
        transientText: input.transientText,
        transientCells: input.transientCells.map(cloneCell),
        transientTileIds: [...input.transientTileIds],
        source: 'submitted-contact',
        baseWordId: input.submitted.word.id,
        baseWordText: input.submitted.word.text,
        contactTileIndex: input.submitted.index,
        contactAffordance: input.port.affordance,
        contactOnlyWordIds: [],
        ...(input.activation === false ? {} : { activation: true }),
        ...(input.requiresAcceptedConsumption ? { requiresAcceptedConsumption: true } : {}),
        consumedContactCells: [cloneCell(input.contactCell)],
        draft: input.draft,
        trace: buildSurfFixReadTrace({
            text: input.text,
            cells: input.cells,
            tileIds: input.tileIds,
            steps: [traceStepFromDraftHybrid(input.submitted, input.port, input.contactCell)],
        }),
    };
}
function traceStepFromDraftHybrid(submitted: SubmittedContactTile, port: WordPort, contactCell: Pos): SurfFixTraceStep {
    return {
        kind: 'draft-submitted-hybrid',
        submittedWordId: submitted.word.id,
        submittedWordText: submitted.word.text,
        submittedTileIndex: submitted.index,
        submittedTileId: submitted.tileId,
        submittedCell: cloneCell(submitted.cell),
        draftPortAffordance: port.affordance,
        draftPortEffect: port.effect,
        draftAnchorCell: cloneCell(port.anchorCell),
        draftNeighborCell: cloneCell(port.neighborCell),
        contactCell: cloneCell(contactCell),
    };
}
function analyzeDraftContacts(draft: FrontierRead, words: readonly SubmittedWord[], assemblage: SubmittedAssemblage, consumedContactCellKeys: ReadonlySet<string> = new Set()): {
    contactOnlyWordIds: string[];
    blockedContacts: DraftBlockedContact[];
    rejectionReason?: string;
} {
    const portsByNeighborCell = new Map<string, WordPort[]>();
    for (const word of words) {
        for (const port of deriveAvailableWordFrontier(word, assemblage).ports) {
            const key = cellKey(port.neighborCell);
            portsByNeighborCell.set(key, [...(portsByNeighborCell.get(key) ?? []), port]);
        }
    }
    const contactOnlyWordIds = new Set<string>();
    const blockedContacts: DraftBlockedContact[] = [];
    for (const cell of draft.cells) {
        const ports = portsByNeighborCell.get(cellKey(cell)) ?? [];
        const blocked = ports.find((port) => port.effect === 'invalidate');
        if (blocked && !consumedContactCellKeys.has(cellKey(cell))) {
            blockedContacts.push({
                cell: cloneCell(cell),
                reason: blocked.reason ?? 'blocked-submitted-contact',
            });
        }
        for (const port of ports) {
            if (port.effect === 'preserve-word')
                contactOnlyWordIds.add(port.wordId);
        }
    }
    return {
        contactOnlyWordIds: [...contactOnlyWordIds],
        blockedContacts,
        rejectionReason: blockedContacts[0]?.reason,
    };
}
function extendCandidatesToMaximal(initialCandidates: readonly DraftFrontierCandidate[], words: readonly SubmittedWord[], assemblage: SubmittedAssemblage): DraftFrontierCandidate[] {
    const maximalCandidates: DraftFrontierCandidate[] = [];
    const queue = initialCandidates.map(cloneCandidate);
    const seen = new Set<string>();
    while (queue.length > 0) {
        const candidate = queue.shift();
        if (!candidate)
            continue;
        const key = candidateTileOrderKey(candidate);
        if (seen.has(key))
            continue;
        seen.add(key);
        const extensions = extendTail(candidate, words, assemblage);
        if (extensions.length === 0) {
            maximalCandidates.push(candidate);
            continue;
        }
        queue.push(...extensions);
    }
    return maximalCandidates;
}
function extendTail(candidate: DraftFrontierCandidate, words: readonly SubmittedWord[], assemblage: SubmittedAssemblage): DraftFrontierCandidate[] {
    const last = candidate.cells[candidate.cells.length - 1];
    const candidateCells = new Set(candidate.cells.map(cellKey));
    const candidateTileIds = new Set(candidate.tileIds);
    const extensions: DraftFrontierCandidate[] = [];
    for (const word of words) {
        if (word.orderedTileIds.some((tileId) => candidateTileIds.has(tileId)))
            continue;
        const frontier = deriveAvailableWordFrontier(word, assemblage);
        for (const port of frontier.ports) {
            if (!sameCell(port.neighborCell, last))
                continue;
            if (port.affordance === 'start-border')
                continue;
            if (port.effect !== 'extend-start' && port.effect !== 'enter-interior')
                continue;
            if (port.effect === 'enter-interior' && !candidateEntersBendEntryCollinearly(candidate, word, port))
                continue;
            if (word.shape.cells.some((cell) => candidateCells.has(cellKey(cell))))
                continue;
            const startIndex = port.effect === 'enter-interior' ? port.tileIndex : 0;
            const text = `${candidate.text}${word.tileTexts.slice(startIndex).join('')}`;
            const cells = [...candidate.cells.map(cloneCell), ...word.shape.cells.slice(startIndex).map(cloneCell)];
            const tileIds = [...candidate.tileIds, ...word.orderedTileIds.slice(startIndex)];
            extensions.push({
                ...candidate,
                text,
                cells,
                tileIds,
                source: 'submitted-contact',
                baseWordId: candidate.baseWordId ?? word.id,
                baseWordText: candidate.baseWordText ?? word.text,
                contactTileIndex: candidate.contactTileIndex ?? port.tileIndex,
                contactAffordance: candidate.contactAffordance ?? port.affordance,
                trace: candidate.trace
                    ? appendSurfFixReadTracePortStep({
                        trace: candidate.trace,
                        text,
                        cells,
                        tileIds,
                        port,
                    })
                    : buildSurfFixReadTraceFromPort({
                        text,
                        cells,
                        tileIds,
                        port,
                    }),
            });
        }
    }
    return extensions;
}
function sameCell(a: Pos, b: Pos): boolean {
    return a.row === b.row && a.col === b.col;
}
function directionBetween(from: Pos, to: Pos): Direction | null {
    if (to.row === from.row - 1 && to.col === from.col)
        return 'up';
    if (to.row === from.row && to.col === from.col + 1)
        return 'right';
    if (to.row === from.row + 1 && to.col === from.col)
        return 'down';
    if (to.row === from.row && to.col === from.col - 1)
        return 'left';
    return null;
}
type DraftRun = {
    cells: Pos[];
    tileIds: string[];
    text: string;
};
function collectDraftRunFromIndex(draft: FrontierRead, startIndex: number, direction: Direction, options: {
    reverse?: boolean;
} = {}): DraftRun | null {
    const indexesByCell = new Map(draft.cells.map((cell, index) => [cellKey(cell), index]));
    const indexes: number[] = [];
    let cursor = draft.cells[startIndex];
    if (!cursor)
        return null;
    while (cursor) {
        const index = indexesByCell.get(cellKey(cursor));
        if (index === undefined)
            break;
        indexes.push(index);
        cursor = stepCell(cursor, direction);
    }
    return draftRunFromIndexes(draft, options.reverse ? indexes.reverse() : indexes);
}
function draftRunFromRange(draft: FrontierRead, startIndex: number, endIndex: number): DraftRun | null {
    const indexes = Array.from({ length: endIndex - startIndex }, (_, offset) => startIndex + offset);
    return draftRunFromIndexes(draft, indexes);
}
function draftRunFromIndexes(draft: FrontierRead, indexes: readonly number[]): DraftRun | null {
    const cells = indexes.map((index) => draft.cells[index]).filter((cell): cell is Pos => !!cell).map(cloneCell);
    const tileIds = indexes.map((index) => draft.tileIds[index]).filter((tileId): tileId is string => !!tileId);
    const letters = indexes.map((index) => draft.tileTexts[index]).filter((letter): letter is string => !!letter);
    if (cells.length === 0 || cells.length !== tileIds.length || cells.length !== letters.length)
        return null;
    return {
        cells,
        tileIds,
        text: letters.join(''),
    };
}
function cloneCell(cell: Pos): Pos {
    return { row: cell.row, col: cell.col };
}
function cloneCandidate(candidate: DraftFrontierCandidate): DraftFrontierCandidate {
    return {
        ...candidate,
        cells: candidate.cells.map(cloneCell),
        tileIds: [...candidate.tileIds],
        transientCells: candidate.transientCells.map(cloneCell),
        transientTileIds: [...candidate.transientTileIds],
        contactOnlyWordIds: [...candidate.contactOnlyWordIds],
        ...(candidate.consumedContactCells ? { consumedContactCells: candidate.consumedContactCells.map(cloneCell) } : {}),
        ...(candidate.trace ? { trace: cloneSurfFixReadTrace(candidate.trace) } : {}),
    };
}
