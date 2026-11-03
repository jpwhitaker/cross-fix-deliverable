import { isAcceptedSbsWord } from '@/lib/modes/shared/sbs-rules';
export function isAcceptedCrosswordsSbsWord(word: string): boolean {
    return isAcceptedSbsWord(word);
}
export function isAcceptedCrosswordsWord(word: Pick<{
    valid: boolean;
    word: string;
}, 'valid' | 'word'>): boolean {
    if (word.valid)
        return true;
    return isAcceptedCrosswordsSbsWord(word.word);
}
