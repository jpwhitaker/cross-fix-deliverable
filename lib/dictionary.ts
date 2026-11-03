import type { BoardCell } from '@/lib/game-store';
import type { SwitchSide } from '@/lib/tiles';
import { LETTER_VALUES, lengthPoints } from '@/lib/tiles';
import type { Letter } from '@/lib/tiles';
let dictionary: Set<string> | null = null;
let compoundsDictionary: Set<string> | null = null;
let loadPromise: Promise<void> | null = null;
async function fetchWordList(): Promise<string[]> {
    if (typeof window === 'undefined') {
        const { readFileSync } = await import('fs');
        const { join } = await import('path');
        const filePath = join(process.cwd(), 'public/dictionary.json');
        try {
            return JSON.parse(readFileSync(filePath, 'utf8'));
        }
        catch (err) {
            throw new Error(`Failed to load dictionary from ${filePath}: ${(err as Error).message}`);
        }
    }
    const res = await fetch('/dictionary.json');
    if (!res.ok)
        throw new Error(`Failed to load dictionary: HTTP ${res.status} ${res.statusText}`);
    return res.json();
}
type DictionarySets = {
    dictionary: Set<string>;
    compoundsDictionary: Set<string>;
};
export function buildDictionarySets(words: unknown[]): DictionarySets {
    const nextDictionary = new Set<string>();
    const nextCompoundsDictionary = new Set<string>();
    for (let i = 0; i < words.length; i++) {
        const entry = words[i];
        if (typeof entry !== 'string') {
            throw new Error(`Invalid dictionary entry at index ${i}: expected string`);
        }
        const normalized = entry.toLowerCase();
        if (normalized.includes(' ')) {
            nextCompoundsDictionary.add(normalized);
        }
        else {
            nextDictionary.add(normalized);
        }
    }
    return {
        dictionary: nextDictionary,
        compoundsDictionary: nextCompoundsDictionary,
    };
}
export function loadDictionary(): Promise<void> {
    if (dictionary)
        return Promise.resolve();
    if (loadPromise)
        return loadPromise;
    loadPromise = fetchWordList()
        .then((words) => {
        const rawWords = words as unknown[];
        const built = buildDictionarySets(rawWords);
        dictionary = built.dictionary;
        compoundsDictionary = built.compoundsDictionary;
    })
        .catch(err => {
        dictionary = null;
        compoundsDictionary = null;
        loadPromise = null;
        throw err;
    });
    return loadPromise;
}
export function isValidWord(word: string): boolean {
    if (!dictionary)
        return false;
    const lower = word.toLowerCase();
    if (dictionary.has(lower))
        return true;
    if (lower.includes('-') && compoundsDictionary?.has(lower.replace(/-/g, ' ')))
        return true;
    return false;
}
export type ExtractedWord = {
    word: string;
    positions: {
        row: number;
        col: number;
    }[];
    valid: boolean;
    letterCount: number;
};
export function cellLetters(cell: BoardCell, surfboardChar = ''): string {
    if (cell.kind === 'empty')
        return '';
    switch (cell.kind) {
        case 'regular':
            return cell.letter;
        case 'double':
            return cell.letters[0] + cell.letters[1];
        case 'switch': {
            const side: SwitchSide = cell.activeSide ?? 'A';
            return side === 'A' ? cell.sideA.letter : cell.sideB.letter;
        }
        case 'wildcard':
            return cell.representsLetter ?? 'X';
        case 'surfboard':
            return surfboardChar;
        default:
            return '';
    }
}
function cellValue(cell: BoardCell): number {
    if (cell.kind === 'empty')
        return 0;
    switch (cell.kind) {
        case 'regular':
            return cell.value;
        case 'double':
            return cell.value;
        case 'switch': {
            const side: SwitchSide = ('activeSide' in cell && cell.activeSide) ? cell.activeSide : 'A';
            return side === 'A' ? cell.sideA.value : cell.sideB.value;
        }
        case 'wildcard':
            return cell.representsLetter ? LETTER_VALUES[cell.representsLetter] : LETTER_VALUES['X' as Letter];
        case 'surfboard':
            return 0;
        default:
            return 0;
    }
}
export function extractWords(board: BoardCell[][]): ExtractedWord[] {
    const words: ExtractedWord[] = [];
    const rows = board.length;
    const cols = board[0]?.length ?? 0;
    for (let r = 0; r < rows; r++) {
        let c = 0;
        while (c < cols) {
            const cell = board[r][c];
            if (cell.kind === 'empty' || cell.kind === 'surfboard') {
                c++;
                continue;
            }
            const positions: {
                row: number;
                col: number;
            }[] = [];
            let word = '';
            let letterCount = 0;
            while (c < cols && board[r][c].kind !== 'empty') {
                if (board[r][c].kind === 'surfboard') {
                    word += '-';
                    positions.push({ row: r, col: c });
                    c++;
                    continue;
                }
                const letters = cellLetters(board[r][c]);
                word += letters;
                letterCount += letters.length;
                positions.push({ row: r, col: c });
                c++;
            }
            if (positions.length >= 2 && letterCount >= 2) {
                words.push({ word, positions, valid: isValidWord(word), letterCount });
            }
        }
    }
    for (let c = 0; c < cols; c++) {
        let r = 0;
        while (r < rows) {
            const cell = board[r][c];
            if (cell.kind === 'empty' || cell.kind === 'surfboard') {
                r++;
                continue;
            }
            const positions: {
                row: number;
                col: number;
            }[] = [];
            let word = '';
            let letterCount = 0;
            while (r < rows && board[r][c].kind !== 'empty') {
                if (board[r][c].kind === 'surfboard') {
                    word += '-';
                    positions.push({ row: r, col: c });
                    r++;
                    continue;
                }
                const letters = cellLetters(board[r][c]);
                word += letters;
                letterCount += letters.length;
                positions.push({ row: r, col: c });
                r++;
            }
            if (positions.length >= 2 && letterCount >= 2) {
                words.push({ word, positions, valid: isValidWord(word), letterCount });
            }
        }
    }
    return words;
}
export function scoreWord(board: BoardCell[][], w: ExtractedWord, withLengthBonus = true): number {
    let total = 0;
    for (const pos of w.positions) {
        total += cellValue(board[pos.row][pos.col]);
    }
    if (withLengthBonus)
        total += lengthPoints(w.letterCount);
    return total;
}
