import { acceptedAs, type DictionaryAcceptance } from '@/lib/surf-fix-rules/dictionary/acceptance';
export function surfFixReadingAcceptance(candidate: {
    text: string;
    cells: readonly unknown[];
    tileIds: readonly string[];
}): DictionaryAcceptance | null {
    const acceptance = acceptedAs(candidate.text);
    if (acceptance !== 'sbs')
        return acceptance;
    return candidate.cells.length >= 2 && candidate.tileIds.length >= 2 ? acceptance : null;
}
