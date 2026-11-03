const VOWELS = new Set(['A', 'E', 'I', 'O', 'U', 'Y']);
const SAME_LETTER_SBS = new Set([
    'BB', 'CC', 'DD', 'EE', 'FF', 'GG', 'LL', 'MM',
    'NN', 'OO', 'PP', 'RR', 'SS', 'TT', 'ZZ',
]);
const STARTER_SBS = new Set([
    'BL', 'BR', 'CH', 'CL', 'CR', 'DR', 'EA', 'FL',
    'FR', 'GL', 'GR', 'OU', 'PH', 'PL', 'PR', 'SC',
    'SH', 'SK', 'SL', 'SM', 'SN', 'SP', 'ST', 'SW',
    'TH', 'TR', 'WH', 'WR',
]);
export function isAcceptedSbsWord(word: string): boolean {
    const normalized = word.trim().toUpperCase();
    if (normalized.length !== 2)
        return false;
    const a = normalized[0];
    const b = normalized[1];
    if (!isUpperAtoZ(a) || !isUpperAtoZ(b))
        return false;
    if ((isVowel(a) && isConsonant(b)) || (isConsonant(a) && isVowel(b)))
        return true;
    if (b === 'S' && isConsonant(a))
        return true;
    if (SAME_LETTER_SBS.has(normalized))
        return true;
    if (STARTER_SBS.has(normalized))
        return true;
    return false;
}
function isUpperAtoZ(ch: string): boolean {
    return ch.length === 1 && ch >= 'A' && ch <= 'Z';
}
function isVowel(letter: string): boolean {
    return VOWELS.has(letter);
}
function isConsonant(letter: string): boolean {
    return isUpperAtoZ(letter) && !isVowel(letter);
}
