import { extractWords, type ExtractedWord } from '@/lib/dictionary';
import type { BoardCell } from '@/lib/game-store';
import { positionKey } from '@/lib/util/position-key';
export function isValidHighlightWord(word: Pick<ExtractedWord, 'valid' | 'word'>): boolean {
    return word.valid && word.word.length >= 2;
}
export function getValidWordPositionKeysFromExtractedWords(words: ExtractedWord[]): Set<string> {
    const keys = new Set<string>();
    for (const word of words) {
        if (!isValidHighlightWord(word))
            continue;
        for (const pos of word.positions) {
            keys.add(positionKey(pos.row, pos.col));
        }
    }
    return keys;
}
export function getValidWordPositionKeys(board: BoardCell[][]): Set<string> {
    const words = extractWords(board);
    return getValidWordPositionKeysFromExtractedWords(words);
}
