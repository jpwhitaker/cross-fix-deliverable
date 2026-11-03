import type { GameAuthoring } from '@/lib/game-settings'
import type { BoardCell } from '@/lib/game-store';
import type { ExtractedWord } from '@/lib/dictionary';
import { acceptedAs } from '@/lib/surf-fix-rules/dictionary/acceptance';
import { applySubmitBundle } from '@/lib/surf-fix-rules/game/state';
import type { SubmittedWord, TileRegistry } from '@/lib/surf-fix-rules/game/types';
import { deriveTransientProjection, type TransientProjection, type TransientProjectionSbsContact, type TransientProjectionSubmitCandidate, } from '@/lib/surf-fix-rules/game/transient-projection';
import type { SurfFixWord, SurfFixWordDraft } from '@/lib/modes/shared/word-ledger-types';
import type { SubmitResult, SubmitSbsSideContact } from '@/lib/modes/types';
import { evaluatePickTileRequirement } from '@/lib/predicates/submit/evaluate-pick-tile-requirement';
import { wordKey } from '@/lib/predicates/submit/identify-ride';
import { isWildcardForceUseSatisfied } from '@/lib/predicates/submit/is-wildcard-force-use-satisfied';
import { sideContactValue } from '@/lib/predicates/score/side-contact-value';
import { isFixedTileId } from '@/lib/modes/shared/tile-ids';
import type { RideClaim } from '@/lib/predicates/reads/ride-claim';
import { surfFixReadingPolicy } from './reading-policy';
import { adaptSurfFixBoardToEngine, fixedSeedWordId, surfFixLetterCount, } from './adapter';
import { surfFixRoundConfig } from './round-config';
import { surfFixReadingAcceptance } from './reading-acceptance';
import { ledgerContainsSbsSource, surfFixSbsLedgerWordDraftFromSource, } from './sbs-ledger';
type SurfFixSubmitContext = {
    round: number;
    wildcardMustBeUsedAsXRound?: number | null;
    chainWords?: SurfFixWord[];
    rideClaim?: RideClaim | null;
    authoring?: GameAuthoring | null;
};
export function validateSurfFixSubmit(board: BoardCell[][], submittedPositions: Set<string> | null, context?: SurfFixSubmitContext): SubmitResult {
    try {
        return validateSurfFixSubmitUnsafe(board, submittedPositions, context);
    }
    catch {
        return rejectedRuleBoundaryResult();
    }
}
function validateSurfFixSubmitUnsafe(board: BoardCell[][], submittedPositions: Set<string> | null, context?: SurfFixSubmitContext): SubmitResult {
    const round = context?.round ?? 1;
    const wildcardMustBeUsedAsXRound = context?.wildcardMustBeUsedAsXRound ?? null;
    const adapted = adaptSurfFixBoardToEngine({
        board,
        submittedPositions,
        chainWords: context?.chainWords ?? [],
    });
    if (adapted.transientPlacements.length === 0) {
        return {
            ok: false,
            code: 'no-new-words',
            message: 'No new words found — keep building!',
            meta: { words: [], newAcceptedWords: [] },
        };
    }
    const projection = deriveTransientProjection({
        words: adapted.submittedWords,
        tiles: adapted.tileRegistry,
        transientPlacements: adapted.transientPlacements,
        rideClaim: context?.rideClaim,
        readingPolicy: surfFixReadingPolicy(context?.authoring),
    });
    if (projection.kind !== 'stable') {
        return rejectedProjectionResult(projection);
    }
    const projectedWords = projection.submitCandidates.map((candidate) => extractedWordFromRead(candidate.text, candidate.cells));
    if (!projection.accepted) {
        const rejectedSbsContact = projection.sbsContacts.find((contact) => !contact.accepted);
        if (rejectedSbsContact) {
            return {
                ok: false,
                code: 'invalid-sbs',
                message: rejectedSbsMessage(rejectedSbsContact),
                meta: { words: projectedWords },
            };
        }
        const rejectedText = rejectedSubmitCandidateText(projection);
        return {
            ok: false,
            code: 'not-accepted',
            message: `Not accepted: ${rejectedText}`,
            meta: { words: projectedWords, ...(acceptedAs(rejectedText) === null ? { rejectedSpelling: rejectedText } : {}) },
        };
    }
    const newWords = projection.submitCandidates.map((candidate) => submittedWordFromCandidate(candidate, adapted.tileRegistry, round));
    const contactOnlyWordIds = projection.submitCandidates.flatMap((candidate) => candidate.contactOnlyWordIds);
    const submitOutcome = applySubmitBundle({
        words: adapted.submittedWords,
        archivedWords: {},
        newWords,
        contactOnlyWordIds,
    });
    const submittedCandidateIds = new Set(newWords.map((word) => word.id));
    const mintedWords = submitOutcome.words.filter((word) => submittedCandidateIds.has(word.id));
    const newAcceptedWords = mintedWords.map(extractedWordFromSubmittedWord);
    if (newAcceptedWords.length === 0) {
        return {
            ok: false,
            code: 'no-new-words',
            message: 'No new words found — keep building!',
            meta: { words: projectedWords, newAcceptedWords },
        };
    }
    if (!isWildcardForceUseSatisfied(board, submittedPositions, newAcceptedWords, round, wildcardMustBeUsedAsXRound)) {
        return {
            ok: false,
            code: 'wildcard-must-use-as-x',
            message: 'X was taken back — place it as X this round!',
            meta: { words: projectedWords, newAcceptedWords },
        };
    }
    const pickRequirement = evaluatePickTileRequirement({
        board,
        submittedPositions,
        candidateWords: newAcceptedWords,
        requiredPickTiles: surfFixRoundConfig(round).pickTiles,
    });
    if (!pickRequirement.satisfied) {
        return {
            ok: false,
            code: 'pick-tile-required',
            message: pickRequirement.message,
            meta: { words: projectedWords, newAcceptedWords },
        };
    }
    const rideCells = context?.rideClaim?.cells ?? projection.cells;
    const ride = newAcceptedWords.find(word => wordKey(word) === rideCells.map(cell => `${cell.row}-${cell.col}`).join('|'));
    if (context?.rideClaim && !ride)
        return { ok: false, code: 'not-accepted', message: 'The selected Ride could not be preserved. Select your Ride again.', meta: { words: projectedWords } };
    const sbsSideContacts = projection.sbsContacts
        .filter((contact) => contact.accepted)
        .map((contact) => sbsSideContactMetaFromProjectionContact(contact, adapted.tileRegistry));
    const sbsBirthDrafts = sbsSideContacts.flatMap((contact) => (ledgerContainsSbsSource(context?.chainWords ?? [], {
        text: contact.word,
        orderedTileIds: contact.tileIds,
        shape: { cells: contact.positions },
    })
        ? []
        : sbsSideContactLedgerDraft(contact, round)));
    const chainWordDrafts = [
        ...sbsBirthDrafts,
        ...mintedWords.map((word) => hostDraftFromSubmittedWord(word, adapted.submittedWords)),
    ];
    return {
        ok: true,
        code: 'ok',
        meta: {
            words: newAcceptedWords,
            newAcceptedWords,
            rideKey: ride ? wordKey(ride) : undefined,
            chainWordDrafts,
            ...(sbsSideContacts.length > 0 ? { sbsSideContacts } : {}),
        },
    };
}
function sbsSideContactMetaFromProjectionContact(contact: TransientProjectionSbsContact, tiles: TileRegistry): SubmitSbsSideContact {
    return {
        word: contact.text,
        positions: contact.cells.map((cell) => ({ ...cell })),
        tileIds: [...contact.tileIds],
        valuePoints: sideContactValue(surfFixLetterCount(contact.text), contact.tileIds.map((id) => tiles[id].value)),
    };
}
export function rejectedSubmitCandidateText(projection: Pick<Extract<TransientProjection, {
    kind: 'stable';
}>, 'text' | 'submitCandidates'>): string {
    const rejectedCandidate = firstRejectedSubmitCandidate(projection.submitCandidates);
    return (rejectedCandidate?.text ?? projection.submitCandidates[0]?.text ?? projection.text).toUpperCase();
}
function firstRejectedSubmitCandidate(candidates: readonly TransientProjectionSubmitCandidate[]): TransientProjectionSubmitCandidate | undefined {
    return candidates.find((candidate) => surfFixReadingAcceptance(candidate) === null);
}
function rejectedRuleBoundaryResult(): SubmitResult {
    return {
        ok: false,
        code: 'not-accepted',
        message: 'Cannot submit this placement: invalid Surf-Fix state',
        meta: { words: [] },
    };
}
export function rejectedProjectionResult(projection: Exclude<TransientProjection, {
    kind: 'stable';
}>): Extract<SubmitResult, {
    ok: false;
}> {
    if (projection.kind === 'empty') {
        return {
            ok: false,
            code: 'no-new-words',
            message: 'No new words found — keep building!',
            meta: { words: [], newAcceptedWords: [] },
        };
    }
    if (projection.rejectedSharedEnding) {
        return { ok: false, code: 'not-accepted',
            message: `The shared ending also forms ${projection.rejectedSharedEnding.text}, which needs a complete legal path with open ends.`,
            meta: { words: [] } };
    }
    if (projection.rejectedRead) {
        return {
            ok: false,
            code: 'invalid-sbs',
            message: `Invalid side contact: ${projection.rejectedRead.text.toUpperCase()}`,
            meta: { words: [] },
        };
    }
    if (projection.rejectedSbsContact) {
        return {
            ok: false,
            code: 'invalid-sbs',
            message: rejectedSbsMessage(projection.rejectedSbsContact),
            meta: { words: [] },
        };
    }
    if (projection.reason === 'no-complete-reading') {
        return { ok: false, code: 'multiple-word-groups', message: 'No complete reading connects all new tiles with open ends', meta: { words: [] } };
    }
    if (projection.reason === 'invalid-ride-claim') {
        return { ok: false, code: 'not-accepted', message: 'The selected Ride is no longer a complete legal path with open ends. Select and apply your Ride again.', meta: { words: [] } };
    }
    if (projection.reason === 'traversal-limit') {
        return { ok: false, code: 'not-accepted', message: 'This placement has too many possible readings to evaluate. Adjust the placement and try again.', meta: { words: [] } };
    }
    if (['overlapping-tiles', 'conflicting-tile-identity', 'missing-word-tile'].includes(projection.reason)) {
        return { ok: false, code: 'not-accepted', message: 'The saved tile positions are inconsistent. Restore the last valid board before submitting.', meta: { words: [] } };
    }
    if (projection.reason === 'disconnected-loose-tiles' || projection.reason === 'loose-tile-not-in-any-chain') {
        return {
            ok: false,
            code: 'multiple-word-groups',
            message: 'Two or more separate word groups',
            meta: { words: [] },
        };
    }
    if (projection.reason === 'straight-interior-side') {
        return {
            ok: false,
            code: 'invalid-sbs',
            message: 'Side contact must be an accepted SBS pair with open ends',
            meta: { words: [] },
        };
    }
    return {
        ok: false,
        code: 'not-accepted',
        message: `Cannot submit this placement: ${projection.reason}`,
        meta: { words: [] },
    };
}
function rejectedSbsMessage(contact: TransientProjectionSbsContact): string {
    const text = contact.text.toUpperCase();
    if (contact.reason === 'sbs-pre-space-occupied')
        return `Side contact ${text} needs an open space before it`;
    if (contact.reason === 'sbs-post-space-occupied')
        return `Side contact ${text} needs an open space after it`;
    return `Invalid side contact: ${text}`;
}
function submittedWordFromCandidate(candidate: TransientProjectionSubmitCandidate, tileRegistry: TileRegistry, round: number): SubmittedWord {
    const tileTexts = candidate.tileIds.map((tileId) => {
        const tile = tileRegistry[tileId];
        if (!tile)
            throw new Error(`Submit candidate references missing tile ${tileId}`);
        return tile.letter;
    });
    const text = tileTexts.join('');
    if (text !== candidate.text) {
        throw new Error(`Submit candidate text ${candidate.text} does not match tile text ${text}`);
    }
    const acceptance = acceptedAs(candidate.text);
    return {
        id: submitCandidateWordId(candidate),
        ledgerKind: acceptance === 'sbs' ? 'sbs' : undefined,
        text,
        tileTexts,
        orderedTileIds: [...candidate.tileIds],
        shape: { cells: candidate.cells.map((cell) => ({ ...cell })) },
        ancestors: [],
        roundCreated: round,
        history: [],
    };
}
function submitCandidateWordId(candidate: TransientProjectionSubmitCandidate): string {
    return `pending:${candidate.key}`;
}
function extractedWordFromSubmittedWord(word: SubmittedWord): ExtractedWord {
    return extractedWordFromRead(word.text, word.shape.cells);
}
function extractedWordFromRead(text: string, cells: readonly {
    row: number;
    col: number;
}[]): ExtractedWord {
    return {
        word: text,
        positions: cells.map((cell) => ({ ...cell })),
        valid: acceptedAs(text) === 'word',
        letterCount: surfFixLetterCount(text),
    };
}
function sbsSideContactLedgerDraft(contact: SubmitSbsSideContact, round: number): SurfFixWordDraft[] {
    const draft = surfFixSbsLedgerWordDraftFromSource({
        word: contact.word,
        positions: contact.positions,
        tileIds: contact.tileIds,
        round,
    });
    return draft ? [draft] : [];
}
function hostDraftFromSubmittedWord(word: SubmittedWord, existingWords: readonly SubmittedWord[]): SurfFixWordDraft {
    const revisionOfWordId = graduationRevisionWordId(word, existingWords);
    return {
        ledgerKind: revisionOfWordId ? 'word' : word.ledgerKind ?? 'word',
        text: word.text,
        orderedTileIds: [...word.orderedTileIds],
        shape: { cells: word.shape.cells.map((cell) => ({ ...cell })) },
        ancestors: word.ancestors.filter((ancestor) => ancestor !== revisionOfWordId && !isFixedSeedWordId(ancestor)),
        roundCreated: word.roundCreated,
        revisionOfWordId,
    };
}
function graduationRevisionWordId(word: SubmittedWord, existingWords: readonly SubmittedWord[]): string | null {
    if (acceptedAs(word.text) !== 'word')
        return null;
    const existingById = new Map(existingWords.map((entry) => [entry.id, entry]));
    const sbsAncestors = word.ancestors.filter((ancestorId) => {
        const ancestor = existingById.get(ancestorId);
        return ancestor && (ancestor.ledgerKind ?? 'word') === 'sbs';
    });
    return sbsAncestors.length === 1 ? sbsAncestors[0] : null;
}
function isFixedSeedWordId(wordId: string): boolean {
    const seedPrefix = fixedSeedWordId('');
    if (!wordId.startsWith(seedPrefix))
        return false;
    return isFixedTileId(wordId.slice(seedPrefix.length));
}
