import type { BoardCell } from '@/lib/game-store';
import type { SubmitResult } from '@/lib/modes/types';
import { extractWords } from '@/lib/dictionary';
import { crosswordsRoundConfig } from '@/lib/modes/crosswords/round-config';
import { hasPlacedTiles } from '@/lib/predicates/submit/get-submit-facts';
import { getNewAcceptedWords } from '@/lib/predicates/submit/get-new-accepted-words';
import { evaluatePickTileRequirement } from '@/lib/predicates/submit/evaluate-pick-tile-requirement';
import { isCandidateGroupContiguous } from '@/lib/predicates/submit/is-candidate-group-contiguous';
import { getFreestandingWordsFromSubmittedComponents } from '@/lib/predicates/submit/get-freestanding-words';
import { countFreestandingComponentsUsedInCandidate } from '@/lib/predicates/submit/count-fs-words-used-in-candidate';
import { isWildcardForceUseSatisfied } from '@/lib/predicates/submit/is-wildcard-force-use-satisfied';
import { identifyRide, wordKey } from '@/lib/predicates/submit/identify-ride';
import { extractBentWords } from '@/lib/predicates/submit/extract-bent-words';
import { validateSurfboards } from '@/lib/predicates/submit/validate-surfboards';
import { positionKey } from '@/lib/modes/move-policy';
import { isAcceptedCrosswordsWord } from './sbs-rules';
export function validateCrosswordsSubmit(board: BoardCell[][], submittedPositions: Set<string> | null, context?: {
    round: number;
    wildcardMustBeUsedAsXRound: number | null;
    submittedBentWordPositions?: Set<string> | null;
}): SubmitResult {
    if (!hasPlacedTiles(board)) {
        return { ok: false, code: 'no-placed-tiles', message: 'Drag some letters to the board first!' };
    }
    const surfboardError = validateSurfboards(board);
    if (surfboardError === 'surfboard-x-junction') {
        return { ok: false, code: 'surfboard-x-junction', message: 'The surfboard has letters on too many sides — remove some' };
    }
    if (surfboardError === 'surfboard-orphan') {
        return { ok: false, code: 'surfboard-orphan', message: 'Place the surfboard between two parts of a word' };
    }
    const bentWords = extractBentWords(board);
    const claimed = new Set(bentWords.flatMap((w) => w.positions.map((p) => positionKey(p.row, p.col))));
    const straightWords = extractWords(board).filter((w) => !w.positions.every((p) => claimed.has(positionKey(p.row, p.col))));
    const words = [...bentWords, ...straightWords];
    for (const word of words) {
        if (isAcceptedCrosswordsWord(word))
            continue;
        if (word.word.length === 2) {
            return {
                ok: false,
                code: 'invalid-sbs',
                message: `Invalid SBS sequence: ${word.word.toUpperCase()}`,
            };
        }
        return {
            ok: false,
            code: 'not-accepted',
            message: `Not accepted: ${word.word.toUpperCase()}`,
        };
    }
    const newAcceptedWords = getNewAcceptedWords(words, submittedPositions, isAcceptedCrosswordsWord);
    if (context &&
        !isWildcardForceUseSatisfied(board, submittedPositions, newAcceptedWords, context.round, context.wildcardMustBeUsedAsXRound)) {
        return {
            ok: false,
            code: 'wildcard-must-use-as-x',
            message: 'X was taken back — must be used this round!',
            meta: { words, newAcceptedWords },
        };
    }
    if (newAcceptedWords.length === 0) {
        return {
            ok: false,
            code: 'no-new-words',
            message: 'No new words found — keep building!',
            meta: { words, newAcceptedWords },
        };
    }
    if (newAcceptedWords.length >= 2 && !isCandidateGroupContiguous(newAcceptedWords)) {
        return {
            ok: false,
            code: 'multiple-word-groups',
            message: 'Two or more separate word groups',
            meta: { words, newAcceptedWords },
        };
    }
    const prevBentWordPositions = context?.submittedBentWordPositions ?? null;
    const fsWords = getFreestandingWordsFromSubmittedComponents(board, submittedPositions, prevBentWordPositions);
    const fsComponentsUsed = countFreestandingComponentsUsedInCandidate(fsWords, newAcceptedWords);
    if (fsComponentsUsed > 1) {
        const ride = identifyRide(newAcceptedWords, submittedPositions);
        return {
            ok: false,
            code: 'too-many-fs-words',
            message: 'Only one freestanding word per Ride.',
            meta: { words, newAcceptedWords, rideKey: ride ? wordKey(ride) : undefined },
        };
    }
    const currentRound = context?.round ?? 1;
    const pickRequirement = evaluatePickTileRequirement({
        board,
        submittedPositions,
        candidateWords: newAcceptedWords,
        requiredPickTiles: crosswordsRoundConfig(currentRound).pickTiles,
    });
    if (!pickRequirement.satisfied) {
        return {
            ok: false,
            code: 'pick-tile-required',
            message: pickRequirement.message,
            meta: { words, newAcceptedWords },
        };
    }
    const ride = identifyRide(newAcceptedWords, submittedPositions);
    const newBentWords = bentWords.filter((bw) => newAcceptedWords.some((aw) => wordKey(aw) === wordKey(bw)));
    return {
        ok: true,
        code: 'ok',
        meta: {
            words,
            newAcceptedWords,
            rideKey: ride ? wordKey(ride) : undefined,
            bentWords: newBentWords.length > 0 ? newBentWords : undefined,
        },
    };
}
