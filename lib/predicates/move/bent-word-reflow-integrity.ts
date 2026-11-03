import type { BatchMoveValidationContext } from '@/lib/modes/move-policy';
import { positionKey } from '@/lib/modes/move-policy';
import { extractWords } from '@/lib/dictionary';
import { extractBentWords } from '@/lib/predicates/submit/extract-bent-words';
import { validateSurfboards } from '@/lib/predicates/submit/validate-surfboards';
import { areSubmittedPositionsCovered, buildWordMultiset, collectFullySubmittedWordState, wordMultisetsEqual, } from '@/lib/predicates/move/submitted-word-integrity';
type CompoundWordState = {
    coveredPositions: Set<string>;
    wordCounts: Map<string, number>;
};
export function collectFullySubmittedCompoundWordState(board: BatchMoveValidationContext['board'], submittedPositions: Set<string> | null): CompoundWordState {
    const coveredPositions = new Set<string>();
    if (!submittedPositions || submittedPositions.size === 0) {
        return { coveredPositions, wordCounts: new Map() };
    }
    const submittedBentWords = extractBentWords(board).filter((word) => word.positions.every((pos) => submittedPositions.has(positionKey(pos.row, pos.col))));
    const submittedStraightHyphenWords = extractWords(board).filter((word) => word.word.includes('-') &&
        !word.word.startsWith('-') &&
        !word.word.endsWith('-') &&
        word.positions.every((pos) => submittedPositions.has(positionKey(pos.row, pos.col))));
    for (const word of submittedBentWords) {
        for (const pos of word.positions) {
            coveredPositions.add(positionKey(pos.row, pos.col));
        }
    }
    for (const word of submittedStraightHyphenWords) {
        for (const pos of word.positions) {
            coveredPositions.add(positionKey(pos.row, pos.col));
        }
    }
    return {
        coveredPositions,
        wordCounts: buildWordMultiset([
            ...submittedBentWords.map((word) => word.word),
            ...submittedStraightHyphenWords.map((word) => word.word),
        ]),
    };
}
export function bentWordReflowIntegrityHolds(ctx: BatchMoveValidationContext): boolean {
    if (validateSurfboards(ctx.nextBoard) !== null)
        return false;
    if (!ctx.submittedPositions || !ctx.nextSubmittedPositions)
        return false;
    const baselineCompound = collectFullySubmittedCompoundWordState(ctx.board, ctx.submittedPositions);
    const nextCompound = collectFullySubmittedCompoundWordState(ctx.nextBoard, ctx.nextSubmittedPositions);
    if (!wordMultisetsEqual(baselineCompound.wordCounts, nextCompound.wordCounts))
        return false;
    const baselineStraight = collectFullySubmittedWordState(ctx.board, ctx.submittedPositions, {
        acceptWord: (word) => {
            if (word.word.includes('-'))
                return false;
            const fullyInsideCompound = word.positions.every((pos) => baselineCompound.coveredPositions.has(positionKey(pos.row, pos.col)));
            return !fullyInsideCompound;
        },
    });
    const nextStraight = collectFullySubmittedWordState(ctx.nextBoard, ctx.nextSubmittedPositions, {
        acceptWord: (word) => {
            if (word.word.includes('-'))
                return false;
            const fullyInsideCompound = word.positions.every((pos) => nextCompound.coveredPositions.has(positionKey(pos.row, pos.col)));
            return !fullyInsideCompound;
        },
    });
    const combinedNextCoverage = new Set(nextStraight.coveredPositions);
    for (const key of nextCompound.coveredPositions)
        combinedNextCoverage.add(key);
    if (!areSubmittedPositionsCovered(ctx.nextSubmittedPositions, combinedNextCoverage))
        return false;
    return wordMultisetsEqual(baselineStraight.wordCounts, nextStraight.wordCounts);
}
