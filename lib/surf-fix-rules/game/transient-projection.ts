import type { DictionaryAcceptance } from '@/lib/surf-fix-rules/dictionary/acceptance';
import { surfFixReadingAcceptance as acceptedAsSubmitCandidate } from '@/lib/modes/surf-fix/reading-acceptance';
import { compareCandidatePriority, uniqueCandidatesByTileOrder } from '@/lib/surf-fix-rules/frontier/candidate-ordering';
import { evaluateBoardReadContacts, type DraftBlockedContact, type DraftFrontierCandidate, type FrontierRead } from '@/lib/surf-fix-rules/frontier/draft-frontier-evaluator';
import { usesWordBoundaryEdge } from '@/lib/predicates/reads/word-boundary-contact';
import { discoverSbsSideContacts, isAcceptedSbsSideContact, sbsSideContactRejectionReason, type SbsSideContact } from '@/lib/surf-fix-rules/frontier/sbs-side-contact';
import { deriveAvailableWordFrontier, deriveSubmittedAssemblage } from '@/lib/surf-fix-rules/frontier/submitted-assemblage';
import { cellKey, deriveWordFrontier, type WordPort } from '@/lib/surf-fix-rules/frontier/word-frontier';
import type { Pos, SubmittedWord, TileRegistry, TransientPlacement } from '@/lib/surf-fix-rules/game/types';
import { dropStructurallyContainedReads } from '@/lib/surf-fix-rules/game/word-consumption';
import { cloneSurfFixReadTrace, type SurfFixProjectionRejectionTrace, type SurfFixReadTrace, type SurfFixSideContactTrace } from '@/lib/surf-fix-rules/trace/read-trace';
import { deriveDraftRead, type DraftRead, type DraftTile } from '@/lib/surf-fix-rules/walker/derive-draft-read';
import { discoverBoardReads } from '@/lib/surf-fix-rules/walker/board-reader';
import { isSurfFixAutomaticOrClaimedRead, pickDefaultSurfFixRide, requiredSurfFixEndingExtensions, selectSurfFixDefaultReads } from '@/lib/modes/surf-fix/default-read-policy';
import { claimedRidePaths, promoteRideClaim, rideBoardKey, type RideClaim, type RidePath } from '@/lib/predicates/reads/ride-claim';
import { surfFixReadAdmission } from '@/lib/modes/surf-fix/read-admission-policy';
import { projectedSurfFixScore, type SurfFixReadingPolicy } from '@/lib/modes/surf-fix/reading-policy';
import { compareRideOptions } from '@/lib/predicates/reads/rank-ride-options';
export type SurfFixRideOption = RidePath & {
    key: string;
    boardKey: string;
    points: number;
};
export type TransientProjection = {
    rideOptions?: SurfFixRideOption[];
} & ({
    kind: 'empty';
} | {
    kind: 'ambiguous';
    reason: string;
    rejectedRead?: TransientProjectionRejectedRead;
    rejectedSbsContact?: TransientProjectionSbsContact;
    rejectedSharedEnding?: TransientProjectionRejectedRead;
    rejectionTrace?: SurfFixProjectionRejectionTrace;
    cells: Pos[];
    transientCells: Pos[];
    transientTileIds: string[];
    draft: DraftRead;
} | {
    kind: 'stable';
    text: string;
    cells: Pos[];
    tileIds: string[];
    transientText: string;
    transientCells: Pos[];
    transientTileIds: string[];
    source: 'transient-only' | 'submitted-contact';
    accepted: boolean;
    acceptance: DictionaryAcceptance | null;
    baseWordId?: string;
    baseWordText?: string;
    contactTileIndex?: number;
    contactAffordance?: string;
    contactOnlyWordIds: string[];
    candidates: TransientProjectionCandidate[];
    submitCandidates: TransientProjectionSubmitCandidate[];
    sbsContacts: TransientProjectionSbsContact[];
    draft: DraftRead;
});
export type TransientProjectionRejectedRead = {
    text: string;
    cells: Pos[];
    tileIds: string[];
};
export type TransientProjectionCandidate = {
    key: string;
    text: string;
    tileCount: number;
    source: 'transient-only' | 'submitted-contact';
    accepted: boolean;
    acceptance: DictionaryAcceptance | null;
    baseWordText?: string;
    transientText: string;
};
export type TransientProjectionSubmitCandidate = {
    key: string;
    text: string;
    cells: Pos[];
    tileIds: string[];
    contactOnlyWordIds: string[];
    trace?: SurfFixReadTrace;
};
export type TransientProjectionSbsContact = {
    text: string;
    accepted: boolean;
    cells: Pos[];
    tileIds: string[];
    direction: 'horizontal' | 'vertical';
    preCell: Pos;
    postCell: Pos;
    reason?: 'not-in-sbs-list' | 'sbs-pre-space-occupied' | 'sbs-post-space-occupied';
};
export function deriveTransientProjection(input: {
    transientPlacements: readonly TransientPlacement[];
    tiles: TileRegistry;
    words: readonly SubmittedWord[];
    rideClaim?: RideClaim | null;
    readingPolicy?: SurfFixReadingPolicy;
    captureRideOptions?: boolean;
}): TransientProjection {
    const transientTiles = input.transientPlacements
        .map((placement) => {
        const tile = input.tiles[placement.tileId];
        return tile ? { id: tile.id, letter: tile.letter, row: placement.pos.row, col: placement.pos.col } : null;
    })
        .filter((tile): tile is DraftTile => !!tile);
    if (transientTiles.length === 0)
        return { kind: 'empty' };
    const draft = deriveDraftRead(transientTiles);
    const transientCells = input.transientPlacements.map((placement) => ({ ...placement.pos }));
    const transientTileIds = input.transientPlacements.map((placement) => placement.tileId);
    const discovered = discoverBoardReads({ ...input,
        scope: input.rideClaim || input.readingPolicy ? 'selectable' : 'automatic' });
    const context = { ...input, draft, transientCells, transientTileIds };
    const baseline = deriveBoardProjection(context, discovered);
    let result = baseline;
    if (input.readingPolicy === 'best-ride-v1' && !input.rideClaim
        && !discovered.graph.error && !discovered.walk.exhausted) {
        const newIds = new Set(transientTileIds);
        const baselineKeys = new Set(baseline.kind === 'stable' ? baseline.submitCandidates.map(read => read.tileIds.join('|')) : []);
        const boardKey = rideBoardKey([...discovered.graph.nodes.values()], input.words.map(word => ({ id: word.id, text: word.text, tileIds: word.orderedTileIds })));
        const alternatives = discovered.reads.filter(read => !read.endpointSideTurn
            && coversAllTileIds(read.looseTileIds, newIds)
            && (read.wholeWordExtension || baselineKeys.has(read.tileIds.join('|'))));
        const options = [baseline, ...alternatives.map(read => deriveBoardProjection({
                ...context, rideClaim: { text: read.text, tileIds: read.tileIds, cells: read.cells, boardKey },
            }, discovered))].flatMap(projection => projection.kind === 'stable' && projection.accepted
            ? [{ projection, points: projectedSurfFixScore(projection, input.tiles), letterCount: projection.text.length,
                    text: projection.text, cells: projection.cells }] : []);
        result = options.sort(compareRideOptions)[0]?.projection ?? baseline;
    }
    if (input.captureRideOptions && input.readingPolicy === 'best-ride-v1') {
        const newIds = new Set(transientTileIds);
        const boardKey = rideBoardKey([...discovered.graph.nodes.values()], input.words.map(word => ({ id: word.id, text: word.text, tileIds: word.orderedTileIds })));
        const paths = discovered.graph.error || discovered.walk.exhausted ? []
            : uniqueCandidatesByTileOrder(discovered.reads.filter(read => !read.endpointSideTurn && coversAllTileIds(read.looseTileIds, newIds)));
        const options = paths.flatMap(read => {
            const claim = promoteRideClaim(input.rideClaim, {
                text: read.text, tileIds: read.tileIds, cells: read.cells, boardKey,
            });
            const projection = deriveBoardProjection({ ...context, rideClaim: claim }, discovered);
            if (projection.kind !== 'stable' || !projection.accepted)
                return [];
            const retainedKeys = new Set(dropStructurallyContainedReads(projection.submitCandidates).map(path => path.tileIds.join('|')));
            if (claimedRidePaths(claim).some(path => !retainedKeys.has(path.tileIds.join('|'))))
                return [];
            return [{ key: read.tileIds.join('|'), text: read.text, tileIds: read.tileIds, cells: read.cells,
                    boardKey, points: projectedSurfFixScore(projection, input.tiles) }];
        });
        options.sort((a, b) => compareRideOptions({ ...a, letterCount: a.text.length }, { ...b, letterCount: b.text.length }));
        result = { ...result, rideOptions: options };
    }
    return result;
}
function deriveBoardProjection(input: {
    transientPlacements: readonly TransientPlacement[];
    tiles: TileRegistry;
    words: readonly SubmittedWord[];
    draft: DraftRead;
    transientCells: Pos[];
    transientTileIds: string[];
    rideClaim?: RideClaim | null;
    readingPolicy?: SurfFixReadingPolicy;
}, discovered: ReturnType<typeof discoverBoardReads>): TransientProjection {
    const claim = input.rideClaim;
    const claimedPaths = claimedRidePaths(claim);
    const requiredEndings = input.readingPolicy === 'best-ride-v1'
        ? claimedPaths.slice(1).map(path => ({ wordId: '', tileIds: path.tileIds }))
        : requiredSurfFixEndingExtensions(claim?.tileIds, input.words.map(word => ({
            id: word.id, text: word.text, tileIds: word.orderedTileIds, ledgerKind: word.ledgerKind,
        })), discovered.graph.nodes);
    const requiredPathKeys = new Set(requiredEndings.map(read => read.tileIds.join('|')));
    const reads = discovered.reads.filter(read => isSurfFixAutomaticOrClaimedRead(read, claim?.tileIds, requiredPathKeys));
    const allPaths = new Map(reads.map((read) => [read.tileIds.join('|'), read]));
    const looseIds = new Set(input.transientTileIds);
    const structuralFullReads = reads.filter(read => !read.endpointSideTurn && coversAllTileIds(read.looseTileIds, looseIds));
    if (claim && ((claim.additional?.length && input.readingPolicy !== 'best-ride-v1')
        || claim.boardKey !== rideBoardKey([...discovered.graph.nodes.values()], input.words.map(word => ({
            id: word.id, text: word.text, tileIds: word.orderedTileIds,
        }))) || claimedPaths.some(path => !structuralFullReads.some(read => read.tileIds.join('|') === path.tileIds.join('|')
        && read.text === path.text && JSON.stringify(read.cells) === JSON.stringify(path.cells))))) {
        return { kind: 'ambiguous', reason: 'invalid-ride-claim', cells: input.transientCells,
            transientCells: input.transientCells, transientTileIds: input.transientTileIds, draft: input.draft };
    }
    const requiredReadKeys = new Set([...requiredPathKeys, ...(claim ? [claim.tileIds.join('|')] : [])]);
    const fullReads = claim ? structuralFullReads.filter(read => read.tileIds.join('|') === claim.tileIds.join('|'))
        : structuralFullReads.filter(read => surfFixReadAdmission(read, requiredReadKeys, true).selectable);
    if (discovered.graph.error || discovered.walk.exhausted || fullReads.length === 0) {
        const greenCells = new Set(input.words.flatMap((word) => deriveWordFrontier(word).ports
            .filter((port) => port.affordance === 'pre' || port.affordance === 'post' || port.affordance === 'bend-entry' || port.affordance === 'bend-exit')
            .map((port) => cellKey(port.neighborCell))));
        const blocked = findBlockedSubmittedContacts(input.transientCells, input.words).filter((contact) => !greenCells.has(cellKey(contact.cell)));
        const reason = discovered.graph.error ?? (discovered.walk.exhausted ? 'traversal-limit'
            : blocked[0]?.reason ?? 'no-complete-reading');
        return { kind: 'ambiguous', reason, cells: input.transientCells, transientCells: input.transientCells,
            transientTileIds: input.transientTileIds, draft: input.draft,
            ...(blocked.length ? { rejectionTrace: { kind: 'blocked-contact' as const, reason, blockedContacts: blocked } } : {}) };
    }
    const missingEnding = requiredEndings.find(ending => {
        const read = allPaths.get(ending.tileIds.join('|'));
        return !read || read.endpointSideTurn;
    });
    if (missingEnding)
        return {
            kind: 'ambiguous', reason: 'invalid-shared-ending',
            rejectedSharedEnding: {
                text: missingEnding.tileIds.map(id => input.tiles[id]?.letter ?? '').join(''),
                tileIds: [...missingEnding.tileIds],
                cells: missingEnding.tileIds.map(id => discovered.graph.nodes.get(id)!).map(({ row, col }) => ({ row, col })),
            },
            cells: input.transientCells, transientCells: input.transientCells,
            transientTileIds: input.transientTileIds, draft: input.draft,
        };
    const evaluatedReads = uniqueCandidatesByTileOrder([
        ...fullReads, ...requiredEndings.map(ending => allPaths.get(ending.tileIds.join('|'))!),
    ]);
    const evaluations = evaluatedReads.map((chain) => {
        const read = frontierReadFromStructuralChain(chain, input.transientTileIds);
        const contacts = evaluateBoardReadContacts(read, input.words);
        return { chain, read, contacts };
    });
    for (const { contacts } of evaluations) {
        for (const candidate of contacts.activations) {
            if (candidate.activation && (candidate.contactAffordance === 'pre' || candidate.contactAffordance === 'post')) {
                requiredReadKeys.add(candidate.tileIds.join('|'));
            }
        }
    }
    const potential = uniqueCandidatesByTileOrder([
        ...evaluations.map(({ chain, read, contacts }): DraftFrontierCandidate => {
            const contact = chain.trace.steps.find((step) => step.kind === 'frontier-port');
            return { ...read, contactOnlyWordIds: [...new Set([...contacts.contactOnlyWordIds, ...chain.contactOnlyWordIds])], draft: read,
                ...(contact?.kind === 'frontier-port' ? { baseWordId: contact.wordId, baseWordText: contact.wordText,
                    contactTileIndex: contact.tileIndex, contactAffordance: contact.affordance } : {}),
                source: chain.tileIds.some((id) => !looseIds.has(id)) ? 'submitted-contact' : 'transient-only',
                trace: chain.trace, requiresAcceptedConsumption: chain.requiresAcceptedConsumption };
        }),
        ...evaluations.flatMap(({ contacts, read }) => contacts.activations.filter((candidate) => candidate.activation
            && (candidate.contactAffordance === 'pre' || candidate.contactAffordance === 'post'
                || !read.tileIds.includes(input.words.find((word) => word.id === candidate.baseWordId)?.orderedTileIds[candidate.contactTileIndex ?? -1] ?? '')))),
        ...evaluations.flatMap(({ read }) => {
            const ports = deriveWordFrontier({ id: 'draft', text: read.text, tileTexts: read.tileTexts, orderedTileIds: read.tileIds, shape: { cells: read.cells } }).ports
                .filter((port) => looseIds.has(read.tileIds[port.tileIndex])
                && (port.affordance === 'pre' || port.affordance === 'post' || port.affordance === 'bend-entry' || port.affordance === 'bend-exit')
                && discovered.graph.byCell.get(cellKey(port.neighborCell))?.isNew === false);
            return reads.flatMap((chain): DraftFrontierCandidate[] => {
                const contacts = ports.filter((port) => pathEdgeKeys(chain.cells).includes(edgeKey(port.anchorCell, port.neighborCell)));
                if (!contacts.length || chain.endpointSideTurn)
                    return [];
                const candidateRead = frontierReadFromStructuralChain(chain, input.transientTileIds);
                return [{ ...candidateRead, draft: read, source: 'submitted-contact', contactOnlyWordIds: [], activation: true,
                        consumedContactCells: contacts.map((port) => port.anchorCell), trace: chain.trace }];
            });
        }),
    ]).filter((candidate) => allPaths.has(candidate.tileIds.join('|'))
        && surfFixReadAdmission(candidate, requiredReadKeys, coversAllTileIds(candidate.transientTileIds, looseIds)).selectable);
    const occupied = new Set([...discovered.graph.byCell.keys()]);
    const candidates = selectSurfFixDefaultReads(potential, occupied, claim?.tileIds, requiredPathKeys)
        .sort((a, b) => Number(coversAllTileIds(b.transientTileIds, looseIds)) - Number(coversAllTileIds(a.transientTileIds, looseIds))
        || compareCandidatePriority(a, b));
    const fullCandidates = candidates.filter((candidate) => coversAllTileIds(candidate.transientTileIds, looseIds));
    const best = claim ? fullCandidates.find(candidate => candidate.tileIds.join('|') === claim.tileIds.join('|'))
        : pickDefaultSurfFixRide(fullCandidates);
    if (!best)
        return { kind: 'ambiguous', reason: 'no-complete-reading', cells: input.transientCells, transientCells: input.transientCells,
            transientTileIds: input.transientTileIds, draft: input.draft };
    const orderedCandidates = [best, ...candidates.filter(candidate => candidate !== best)];
    const proposed = orderedCandidates.map(candidate => toSubmitCandidate(candidate, candidate.contactOnlyWordIds));
    const submitCandidates = uniqueSubmitCandidates([
        ...maximalSubmitCandidates(proposed),
        ...proposed.filter(candidate => requiredPathKeys.has(candidate.tileIds.join('|'))
            || claim?.tileIds.join('|') === candidate.tileIds.join('|')),
    ]);
    return adjudicateStableProjection({
        core: { ...best, candidates: summarizeCandidates(candidates), submitCandidates, draft: input.draft },
        words: input.words, tiles: input.tiles, transientPlacements: input.transientPlacements, transientCells: input.transientCells,
        blockedContactExclusionPaths: candidates.filter(candidate => surfFixReadAdmission(candidate, requiredReadKeys, coversAllTileIds(candidate.transientTileIds, looseIds)).consumesContacts),
        readContactShapes: fullCandidates.map((candidate) => readContactShapeFromStructuralChain(allPaths.get(candidate.tileIds.join('|'))!)),
    });
}
type StableProjectionCore = {
    text: string;
    cells: readonly Pos[];
    tileIds: readonly string[];
    transientText: string;
    transientCells: readonly Pos[];
    transientTileIds: readonly string[];
    source: 'transient-only' | 'submitted-contact';
    contactOnlyWordIds: readonly string[];
    baseWordId?: string;
    baseWordText?: string;
    contactTileIndex?: number;
    contactAffordance?: string;
    candidates: TransientProjectionCandidate[];
    submitCandidates: TransientProjectionSubmitCandidate[];
    draft: DraftRead;
};
function adjudicateStableProjection(input: {
    core: StableProjectionCore;
    words: readonly SubmittedWord[];
    tiles: TileRegistry;
    transientPlacements: readonly TransientPlacement[];
    transientCells: readonly Pos[];
    blockedContactExclusionPaths: readonly {
        cells: readonly Pos[];
        consumedContactCells?: readonly Pos[];
    }[];
    readContactShapes: readonly BlockedContactReadShape[];
}): TransientProjection {
    const requiredBoundaryReads = input.core.submitCandidates.filter((candidate) => input.words.some((word) => (usesWordBoundaryEdge(candidate.cells, word.shape.cells)))).map((candidate) => ({ cells: candidate.cells }));
    const exclusionPaths = [...input.blockedContactExclusionPaths, ...requiredBoundaryReads];
    const blockedReadSubmittedContactContext = buildBlockedReadSubmittedContactContext(input.words, exclusionPaths);
    const sbsContacts = discoverProjectionSbsContacts({
        words: input.words,
        tiles: input.tiles,
        transientPlacements: input.transientPlacements,
        submitCandidates: input.core.submitCandidates,
    });
    const blockedContacts = uniqueBlockedContacts([
        ...findBlockedSubmittedContacts(input.transientCells, input.words, exclusionPaths),
        ...input.readContactShapes.flatMap((shape) => findBlockedReadSubmittedContacts(shape, blockedReadSubmittedContactContext)),
    ]);
    return finalizeProjection({
        core: input.core,
        blockedContacts,
        sbsContacts,
        tiles: input.tiles,
    });
}
function finalizeProjection(input: {
    core: StableProjectionCore;
    blockedContacts: readonly DraftBlockedContact[];
    sbsContacts: readonly SbsSideContact[];
    tiles: TileRegistry;
}): TransientProjection {
    const { core } = input;
    const acceptedSbsContacts = input.sbsContacts.filter(isAcceptedSbsSideContact);
    if (input.blockedContacts.length > 0 && !blockedContactsCoveredBySbs(input.blockedContacts, acceptedSbsContacts)) {
        const rejectedSbsContact = rejectedSbsContactForBlockedContacts(input.blockedContacts, input.sbsContacts);
        const rejectedRead = rejectedSbsContact ? rejectedReadForBlockedSbsContact(rejectedSbsContact, core.draft, input.tiles) : null;
        const rejectedSbsSummary = rejectedSbsContact ? summarizeSbsContact(rejectedSbsContact) : null;
        return {
            kind: 'ambiguous',
            reason: input.blockedContacts[0]?.reason ?? 'blocked-submitted-contact',
            ...(rejectedRead ? { rejectedRead } : {}),
            ...(rejectedSbsSummary ? { rejectedSbsContact: rejectedSbsSummary } : {}),
            rejectionTrace: blockedContactRejectionTrace({
                reason: input.blockedContacts[0]?.reason ?? 'blocked-submitted-contact',
                blockedContacts: input.blockedContacts,
                rejectedRead,
                rejectedSbsContact: rejectedSbsSummary,
            }),
            cells: core.transientCells.map(cloneCell),
            transientCells: core.transientCells.map(cloneCell),
            transientTileIds: [...core.transientTileIds],
            draft: core.draft,
        };
    }
    const sbsSummaries = summarizeSbsContacts(input.sbsContacts);
    const submitCandidates = core.submitCandidates.map((candidate) => withSbsSideContactTrace(candidate, sbsSummaries));
    return {
        kind: 'stable',
        text: core.text,
        cells: core.cells.map(cloneCell),
        tileIds: [...core.tileIds],
        transientText: core.transientText,
        transientCells: core.transientCells.map(cloneCell),
        transientTileIds: [...core.transientTileIds],
        source: core.source,
        accepted: core.submitCandidates.length > 0
            && core.submitCandidates.every((candidate) => acceptedAsSubmitCandidate(candidate) !== null)
            && sbsSummaries.every((contact) => contact.accepted),
        acceptance: acceptedAsSubmitCandidate(core),
        ...(core.baseWordId !== undefined ? { baseWordId: core.baseWordId } : {}),
        ...(core.baseWordText !== undefined ? { baseWordText: core.baseWordText } : {}),
        ...(core.contactTileIndex !== undefined ? { contactTileIndex: core.contactTileIndex } : {}),
        ...(core.contactAffordance !== undefined ? { contactAffordance: core.contactAffordance } : {}),
        contactOnlyWordIds: [...core.contactOnlyWordIds],
        candidates: core.candidates,
        submitCandidates,
        sbsContacts: sbsSummaries,
        draft: core.draft,
    };
}
function blockedContactRejectionTrace(input: {
    reason: string;
    blockedContacts: readonly DraftBlockedContact[];
    rejectedRead: TransientProjectionRejectedRead | null;
    rejectedSbsContact: TransientProjectionSbsContact | null;
}): SurfFixProjectionRejectionTrace {
    return {
        kind: 'blocked-contact',
        reason: input.reason,
        blockedContacts: input.blockedContacts.map((contact) => ({
            cell: cloneCell(contact.cell),
            reason: contact.reason,
        })),
        ...(input.rejectedRead ? {
            rejectedRead: {
                text: input.rejectedRead.text,
                cells: input.rejectedRead.cells.map(cloneCell),
                tileIds: [...input.rejectedRead.tileIds],
            },
        } : {}),
        ...(input.rejectedSbsContact ? { rejectedSbsContact: sideContactTraceFromSummary(input.rejectedSbsContact) } : {}),
    };
}
function withSbsSideContactTrace(candidate: TransientProjectionSubmitCandidate, contacts: readonly TransientProjectionSbsContact[]): TransientProjectionSubmitCandidate {
    if (!candidate.trace || contacts.length === 0)
        return candidate;
    return {
        ...candidate,
        trace: {
            ...cloneSurfFixReadTrace(candidate.trace),
            sideContacts: contacts.map(sideContactTraceFromSummary),
        },
    };
}
function sideContactTraceFromSummary(contact: TransientProjectionSbsContact): SurfFixSideContactTrace {
    return {
        text: contact.text,
        cells: contact.cells.map(cloneCell),
        tileIds: [...contact.tileIds],
        accepted: contact.accepted,
        reason: contact.accepted ? 'accepted-sbs' : contact.reason ?? 'not-in-sbs-list',
    };
}
function toSubmitCandidate(candidate: {
    text: string;
    cells: readonly Pos[];
    tileIds: readonly string[];
    trace?: SurfFixReadTrace;
}, contactOnlyWordIds: readonly string[]): TransientProjectionSubmitCandidate {
    return {
        key: `${candidate.text}:${candidate.tileIds.join('|')}`,
        text: candidate.text,
        cells: candidate.cells.map(cloneCell),
        tileIds: [...candidate.tileIds],
        contactOnlyWordIds: [...contactOnlyWordIds],
        ...(candidate.trace ? { trace: cloneSurfFixReadTrace(candidate.trace) } : {}),
    };
}
function uniqueSubmitCandidates(candidates: readonly TransientProjectionSubmitCandidate[]): TransientProjectionSubmitCandidate[] {
    return uniqueCandidatesByTileOrder(candidates);
}
function maximalSubmitCandidates(candidates: readonly TransientProjectionSubmitCandidate[]): TransientProjectionSubmitCandidate[] {
    return dropStructurallyContainedReads(uniqueSubmitCandidates(candidates));
}
type StructuralChain = ReturnType<typeof discoverBoardReads>['reads'][number];
type BlockedContactReadShape = {
    text: string;
    cells: readonly Pos[];
    tileIds: readonly string[];
    letters: readonly string[];
};
function frontierReadFromStructuralChain(chain: StructuralChain, transientTileIds: readonly string[]): FrontierRead {
    const looseTileIds = new Set(transientTileIds);
    const transientCells: Pos[] = [];
    const transientIds: string[] = [];
    const transientLetters: string[] = [];
    const letters = structuralLetters(chain);
    chain.tileIds.forEach((tileId, index) => {
        if (!looseTileIds.has(tileId))
            return;
        const cell = chain.cells[index];
        const letter = letters[index];
        if (!cell || !letter)
            return;
        transientCells.push(cloneCell(cell));
        transientIds.push(tileId);
        transientLetters.push(letter);
    });
    return {
        text: chain.text,
        tileTexts: letters,
        cells: chain.cells.map(cloneCell),
        tileIds: [...chain.tileIds],
        transientText: transientLetters.join(''),
        transientCells,
        transientTileIds: transientIds,
        ...(chain.trace ? { trace: cloneSurfFixReadTrace(chain.trace) } : {}),
    };
}
function structuralLetters(chain: StructuralChain): string[] {
    return [...chain.letters];
}
function coversAllTileIds(tileIds: readonly string[], requiredTileIds: ReadonlySet<string>): boolean {
    const present = new Set(tileIds);
    return [...requiredTileIds].every((tileId) => present.has(tileId));
}
function summarizeCandidates(candidates: readonly DraftFrontierCandidate[]): TransientProjectionCandidate[] {
    const displayCandidates = candidates.some((candidate) => candidate.source === 'submitted-contact' && !candidate.activation)
        ? candidates.filter((candidate) => candidate.source === 'submitted-contact')
        : candidates;
    const seen = new Set<string>();
    return [...displayCandidates]
        .sort(compareCandidatePriority)
        .flatMap((candidate) => {
        const key = `${candidate.text}:${candidate.tileIds.join('|')}`;
        if (seen.has(key))
            return [];
        seen.add(key);
        const acceptance = acceptedAsSubmitCandidate(candidate);
        return [{
                key,
                text: candidate.text,
                tileCount: candidate.cells.length,
                source: candidate.source,
                accepted: acceptance !== null,
                acceptance,
                baseWordText: candidate.baseWordText,
                transientText: candidate.transientText,
            }];
    });
}
function discoverProjectionSbsContacts(input: {
    words: readonly SubmittedWord[];
    tiles: TileRegistry;
    transientPlacements: readonly TransientPlacement[];
    submitCandidates: readonly {
        tileIds: readonly string[];
        cells: readonly Pos[];
    }[];
}): SbsSideContact[] {
    return discoverSbsSideContacts({
        words: input.words,
        tiles: input.tiles,
        placedTiles: input.transientPlacements.map((placement) => ({
            tileId: placement.tileId,
            cell: { ...placement.pos },
        })),
        submitPaths: input.submitCandidates.map((candidate) => ({
            tileIds: candidate.tileIds,
            cells: candidate.cells,
        })),
    });
}
function summarizeSbsContacts(contacts: readonly SbsSideContact[]): TransientProjectionSbsContact[] {
    return contacts.map(summarizeSbsContact);
}
function summarizeSbsContact(contact: SbsSideContact): TransientProjectionSbsContact {
    return {
        text: contact.text,
        accepted: isAcceptedSbsSideContact(contact),
        cells: contact.cells.map(cloneCell),
        tileIds: [...contact.tileIds],
        direction: contact.direction,
        preCell: { ...contact.preCell },
        postCell: { ...contact.postCell },
        reason: sbsSideContactRejectionReason(contact),
    };
}
function blockedContactsCoveredBySbs(blockedContacts: readonly {
    cell: Pos;
}[], acceptedSbsContacts: readonly SbsSideContact[]): boolean {
    const acceptedSbsCellKeys = new Set(acceptedSbsContacts.flatMap((contact) => contact.cells.map(cellKey)));
    return blockedContacts.every((contact) => acceptedSbsCellKeys.has(cellKey(contact.cell)));
}
function rejectedSbsContactForBlockedContacts(blockedContacts: readonly {
    cell: Pos;
}[], sbsContacts: readonly SbsSideContact[]): SbsSideContact | null {
    const acceptedSbsCellKeys = new Set(sbsContacts.filter(isAcceptedSbsSideContact).flatMap((contact) => contact.cells.map(cellKey)));
    for (const blockedContact of blockedContacts) {
        const key = cellKey(blockedContact.cell);
        if (acceptedSbsCellKeys.has(key))
            continue;
        const rejectedContact = sbsContacts.find((contact) => (!isAcceptedSbsSideContact(contact)
            && contact.cells.some((cell) => cellKey(cell) === key)));
        if (rejectedContact)
            return rejectedContact;
    }
    return null;
}
function rejectedReadForBlockedSbsContact(contact: SbsSideContact, draft: DraftRead, tiles: TileRegistry): TransientProjectionRejectedRead | null {
    if (draft.kind !== 'stable')
        return null;
    const draftTileIds = new Set(draft.tileIds);
    const submittedContactIndex = contact.tileIds.findIndex((tileId) => !draftTileIds.has(tileId));
    if (submittedContactIndex < 0)
        return null;
    const submittedTileId = contact.tileIds[submittedContactIndex];
    const submittedCell = contact.cells[submittedContactIndex];
    const submittedTile = tiles[submittedTileId];
    if (!submittedCell || !submittedTile)
        return null;
    if (!draftContactIsCollinearEndpoint(draft, submittedCell))
        return null;
    const read = deriveDraftRead([
        ...draftTilesForRead(draft),
        {
            id: submittedTile.id,
            letter: submittedTile.letter,
            row: submittedCell.row,
            col: submittedCell.col,
        },
    ]);
    if (read.kind !== 'stable')
        return null;
    const submittedReadIndex = read.tileIds.indexOf(submittedTile.id);
    if (submittedReadIndex !== 0 && submittedReadIndex !== read.tileIds.length - 1)
        return null;
    return {
        text: read.text,
        cells: read.cells.map(cloneCell),
        tileIds: [...read.tileIds],
    };
}
function draftTilesForRead(draft: Extract<DraftRead, {
    kind: 'stable';
}>): DraftTile[] {
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
function draftContactIsCollinearEndpoint(draft: Extract<DraftRead, {
    kind: 'stable';
}>, submittedCell: Pos): boolean {
    const first = draft.cells[0];
    const second = draft.cells[1];
    const last = draft.cells[draft.cells.length - 1];
    const penultimate = draft.cells[draft.cells.length - 2];
    if (first && second && isSameStepDirection(submittedCell, first, first, second))
        return true;
    if (last && penultimate && isSameStepDirection(penultimate, last, last, submittedCell))
        return true;
    return draft.cells.length === 1 && (isAdjacent(first, submittedCell));
}
function isSameStepDirection(a: Pos, b: Pos, c: Pos, d: Pos): boolean {
    return d.row - c.row === b.row - a.row && d.col - c.col === b.col - a.col;
}
function isAdjacent(a: Pos | undefined, b: Pos): boolean {
    if (!a)
        return false;
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}
type SubmitPathContactExclusions = {
    submitPathEdges: ReadonlySet<string>;
    consumedContactCellKeys: ReadonlySet<string>;
};
type BlockedReadSubmittedContactContext = {
    submittedReadThroughFaceKeys: ReadonlySet<string>;
    exclusions: SubmitPathContactExclusions;
};
function findBlockedSubmittedContacts(cells: readonly Pos[], words: readonly SubmittedWord[], submitPaths: readonly {
    cells: readonly Pos[];
    consumedContactCells?: readonly Pos[];
}[] = []): DraftBlockedContact[] {
    const reasonsByNeighborCell = collectBlockedSubmittedContactReasons(words, submitPaths);
    return cells.flatMap((cell) => blockedContactForCell(cell, reasonsByNeighborCell));
}
function collectBlockedSubmittedContactReasons(words: readonly SubmittedWord[], submitPaths: readonly {
    cells: readonly Pos[];
    consumedContactCells?: readonly Pos[];
}[]): Map<string, string[]> {
    const assemblage = deriveSubmittedAssemblage(words);
    const reasonsByNeighborCell = new Map<string, string[]>();
    const exclusions = buildSubmitPathContactExclusions(submitPaths);
    for (const word of words) {
        for (const port of deriveAvailableWordFrontier(word, assemblage).ports) {
            if (isExcludedBlockedSubmittedContact(port, exclusions))
                continue;
            addBlockedSubmittedContactReason(reasonsByNeighborCell, port);
        }
    }
    return reasonsByNeighborCell;
}
function buildSubmitPathContactExclusions(submitPaths: readonly {
    cells: readonly Pos[];
    consumedContactCells?: readonly Pos[];
}[]): SubmitPathContactExclusions {
    return {
        submitPathEdges: new Set(submitPaths.flatMap((path) => pathEdgeKeys(path.cells))),
        consumedContactCellKeys: new Set(submitPaths.flatMap((path) => (path.consumedContactCells ?? []).map(cellKey))),
    };
}
function isExcludedBlockedSubmittedContact(port: WordPort, exclusions: SubmitPathContactExclusions): boolean {
    if (port.effect !== 'invalidate')
        return true;
    return exclusions.submitPathEdges.has(edgeKey(port.anchorCell, port.neighborCell))
        || exclusions.consumedContactCellKeys.has(cellKey(port.neighborCell));
}
function addBlockedSubmittedContactReason(reasonsByNeighborCell: Map<string, string[]>, port: WordPort): void {
    const key = cellKey(port.neighborCell);
    reasonsByNeighborCell.set(key, [...(reasonsByNeighborCell.get(key) ?? []), port.reason ?? 'blocked-submitted-contact']);
}
function blockedContactForCell(cell: Pos, reasonsByNeighborCell: ReadonlyMap<string, readonly string[]>): DraftBlockedContact[] {
    const reason = reasonsByNeighborCell.get(cellKey(cell))?.[0];
    return reason ? [{ cell: cloneCell(cell), reason }] : [];
}
function findBlockedReadSubmittedContacts(read: BlockedContactReadShape, context: BlockedReadSubmittedContactContext): DraftBlockedContact[] {
    const readWord = {
        id: 'draft',
        text: read.text,
        tileTexts: [...read.letters],
        orderedTileIds: [...read.tileIds],
        shape: { cells: read.cells.map(cloneCell) },
    };
    return deriveWordFrontier(readWord).ports.flatMap((port) => {
        if (!isBlockedReadSubmittedContact(port, context))
            return [];
        return [{ cell: cloneCell(port.anchorCell), reason: port.reason ?? 'blocked-submitted-contact' }];
    });
}
function buildBlockedReadSubmittedContactContext(words: readonly SubmittedWord[], submitPaths: readonly {
    cells: readonly Pos[];
    consumedContactCells?: readonly Pos[];
}[] = []): BlockedReadSubmittedContactContext {
    return {
        submittedReadThroughFaceKeys: findSubmittedReadThroughFaceKeys(words),
        exclusions: buildSubmitPathContactExclusions(submitPaths),
    };
}
function readContactShapeFromStructuralChain(chain: StructuralChain): BlockedContactReadShape {
    return {
        text: chain.text,
        cells: chain.cells,
        tileIds: chain.tileIds,
        letters: structuralLetters(chain),
    };
}
function findSubmittedReadThroughFaceKeys(words: readonly SubmittedWord[]): Set<string> {
    const keys = new Set<string>();
    const assemblage = deriveSubmittedAssemblage(words);
    for (const word of words) {
        for (const port of deriveAvailableWordFrontier(word, assemblage).ports) {
            if (!isReadThroughSubmittedFace(port))
                continue;
            keys.add(directedFaceKey(port.anchorCell, port.neighborCell));
        }
    }
    return keys;
}
function isReadThroughSubmittedFace(port: WordPort): boolean {
    return port.affordance === 'post'
        || port.affordance === 'bend-exit';
}
function isBlockedReadSubmittedContact(port: WordPort, context: BlockedReadSubmittedContactContext): boolean {
    if (port.effect !== 'invalidate')
        return false;
    if (!context.submittedReadThroughFaceKeys.has(directedFaceKey(port.neighborCell, port.anchorCell)))
        return false;
    if (context.exclusions.submitPathEdges.has(edgeKey(port.anchorCell, port.neighborCell)))
        return false;
    return !context.exclusions.consumedContactCellKeys.has(cellKey(port.anchorCell));
}
function uniqueBlockedContacts(contacts: readonly DraftBlockedContact[]): DraftBlockedContact[] {
    const seen = new Set<string>();
    return contacts.filter((contact) => {
        const key = `${cellKey(contact.cell)}:${contact.reason}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function pathEdgeKeys(cells: readonly Pos[]): string[] {
    const keys: string[] = [];
    for (let index = 0; index < cells.length - 1; index += 1) {
        const current = cells[index];
        const next = cells[index + 1];
        if (!current || !next)
            continue;
        keys.push(edgeKey(current, next));
    }
    return keys;
}
function edgeKey(a: Pos, b: Pos): string {
    const aKey = cellKey(a);
    const bKey = cellKey(b);
    return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
}
function directedFaceKey(anchorCell: Pos, neighborCell: Pos): string {
    return `${cellKey(anchorCell)}>${cellKey(neighborCell)}`;
}
function cloneCell(cell: Pos): Pos {
    return { row: cell.row, col: cell.col };
}
