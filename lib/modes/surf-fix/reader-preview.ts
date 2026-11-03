import type { GameAuthoring } from '@/lib/game-settings'
import type { BoardCell } from '@/lib/game-store';
import type { SurfFixWord } from '@/lib/modes/shared/word-ledger-types';
import { deriveTransientProjection, type TransientProjectionSbsContact, type TransientProjectionSubmitCandidate, type SurfFixRideOption, } from '@/lib/surf-fix-rules/game/transient-projection';
import { adaptSurfFixBoardToEngine } from './adapter';
import { selectSurfFixRide } from './ride-selection';
import { appendRideClaim, type RideClaim } from '@/lib/predicates/reads/ride-claim';
import { surfFixReadingPolicy } from './reading-policy';
export type SurfFixReaderPreview = {
    parts: string[];
    text: string;
    tileIds: string[];
    rideOptions?: SurfFixRideOption[];
};
export function getSurfFixReaderPreview(input: {
    board: BoardCell[][];
    submittedPositions: Set<string> | null;
    chainWords: readonly SurfFixWord[];
    rideClaim?: RideClaim | null;
    authoring?: GameAuthoring | null;
    selectedTileIds?: readonly string[];
    includeRideOptions?: boolean;
}, presentation: 'all-reads' | 'ride-only' = 'all-reads'): SurfFixReaderPreview | null {
    try {
        const selection = input.selectedTileIds === undefined ? null : selectSurfFixRide(input, input.selectedTileIds);
        if (selection && !selection.ok)
            return null;
        const claim = selection?.ok ? selection.claim : input.rideClaim;
        if (presentation === 'ride-only' && claim && (!input.includeRideOptions || selection))
            return previewFromParts([claim.text], claim.tileIds);
        const adapted = adaptSurfFixBoardToEngine(input);
        if (adapted.transientPlacements.length === 0)
            return null;
        const projection = deriveTransientProjection({
            words: adapted.submittedWords,
            tiles: adapted.tileRegistry,
            transientPlacements: adapted.transientPlacements,
            rideClaim: selection?.ok
                ? surfFixReadingPolicy(input.authoring) ? appendRideClaim(input.rideClaim, selection.claim) : selection.claim
                : input.rideClaim,
            readingPolicy: surfFixReadingPolicy(input.authoring),
            captureRideOptions: input.includeRideOptions,
        });
        if (presentation === 'ride-only' && claim)
            return {
                ...previewFromParts([claim.text], claim.tileIds)!, rideOptions: projection.rideOptions,
            };
        if (projection.kind !== 'stable') {
            if (presentation === 'ride-only')
                return null;
            const rejectedSbs = projection.kind === 'ambiguous'
                ? projection.rejectedSharedEnding?.text ?? projection.rejectedRead?.text ?? projection.rejectedSbsContact?.text
                : undefined;
            if (selection?.ok)
                return previewFromParts([selection.claim.text, ...(rejectedSbs ? [rejectedSbs] : [])], selection.claim.tileIds);
            return rejectedSbs ? previewFromParts([rejectedSbs]) : null;
        }
        if (presentation === 'ride-only')
            return {
                ...previewFromParts([projection.text], projection.tileIds)!, rideOptions: projection.rideOptions,
            };
        return previewFromParts([
            ...submitCandidatePreviewTexts(projection.submitCandidates, projection.sbsContacts),
            ...projection.sbsContacts.map((contact) => contact.text),
        ], [...projection.submitCandidates, ...projection.sbsContacts].flatMap(read => read.tileIds));
    }
    catch {
        return null;
    }
}
function submitCandidatePreviewTexts(candidates: readonly TransientProjectionSubmitCandidate[], sbsContacts: readonly TransientProjectionSbsContact[]): string[] {
    const sbsTileIds = new Set(sbsContacts.flatMap((contact) => contact.tileIds));
    return candidates
        .filter((candidate) => !isRedundantOneTileSbsFragment(candidate, sbsTileIds))
        .map((candidate) => candidate.text);
}
function isRedundantOneTileSbsFragment(candidate: TransientProjectionSubmitCandidate, sbsTileIds: ReadonlySet<string>): boolean {
    return candidate.tileIds.length === 1 && sbsTileIds.has(candidate.tileIds[0] ?? '');
}
function previewFromParts(parts: readonly string[], tileIds: readonly string[] = []): SurfFixReaderPreview | null {
    const uniqueParts = uniqueNonEmpty(parts.map((part) => part.toUpperCase()));
    if (uniqueParts.length === 0)
        return null;
    return {
        parts: uniqueParts,
        text: uniqueParts.join(' + '),
        tileIds: [...new Set(tileIds)],
    };
}
function uniqueNonEmpty(values: readonly string[]): string[] {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const value of values) {
        if (value.length === 0 || seen.has(value))
            continue;
        seen.add(value);
        unique.push(value);
    }
    return unique;
}
