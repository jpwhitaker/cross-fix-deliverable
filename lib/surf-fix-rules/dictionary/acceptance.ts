import { isValidWord } from '@/lib/dictionary';
import { isAcceptedSbsWord } from '@/lib/modes/shared/sbs-rules';
export type Dictionary = {
    isWord(text: string): boolean;
    isSbs(text: string): boolean;
};
export type DictionaryAcceptance = 'word' | 'sbs';
export const dictionary: Dictionary = {
    isWord(text: string) {
        return isWord(text);
    },
    isSbs(text: string) {
        return isSbs(text);
    },
};
export function isWord(text: string): boolean {
    return isValidWord(normalizeDictionaryText(text));
}
export function acceptedAs(text: string, acceptedDictionary: Dictionary = dictionary): DictionaryAcceptance | null {
    if (acceptedDictionary.isWord(text))
        return 'word';
    if (acceptedDictionary.isSbs(text))
        return 'sbs';
    return null;
}
export function isAccepted(text: string, acceptedDictionary: Dictionary = dictionary): boolean {
    return acceptedAs(text, acceptedDictionary) !== null;
}
export function isSbs(text: string): boolean {
    return isAcceptedSbsWord(normalizeDictionaryText(text));
}
export function normalizeDictionaryText(text: string): string {
    return text.trim().toUpperCase().replace(/\s+/g, '-');
}
