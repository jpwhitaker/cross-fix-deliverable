import { isAccepted } from '@/lib/surf-fix-rules/dictionary/acceptance';
export function isAcceptedSurfFixWord(word: Pick<{
    valid: boolean;
    word: string;
}, 'valid' | 'word'>): boolean {
    if (word.valid)
        return true;
    return isAccepted(word.word);
}
