import { LETTER_VALUES, REGULAR_TILES, SWITCH_TILE_BY_ID, SWITCH_TILES } from '@/lib/tiles';
import type { Letter, LetterCategory } from '@/lib/tiles';
import type { BagTile } from '@/lib/game-store';
import type { ModeBags } from '@/lib/modes/types';
function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
function buildCategoryBag(category: LetterCategory): BagTile[] {
    const tiles: BagTile[] = [];
    for (const entry of REGULAR_TILES) {
        if (entry.category !== category)
            continue;
        for (let i = 0; i < entry.count; i++) {
            tiles.push({ kind: 'regular', letter: entry.letter as Letter, value: entry.value, category });
        }
    }
    for (const t of SWITCH_TILES) {
        if (t.category !== category)
            continue;
        for (let i = 0; i < t.count; i++) {
            tiles.push({ kind: 'switch', tileId: t.id, sideA: t.sideA, sideB: t.sideB, category });
        }
    }
    return shuffle(tiles);
}
export function buildStandardBags(): {
    vowelBag: BagTile[];
    consonantBag: BagTile[];
} {
    return {
        vowelBag: buildCategoryBag('vowel'),
        consonantBag: buildCategoryBag('consonant'),
    };
}
function buildBackupVowelBag(): BagTile[] {
    const ay = SWITCH_TILE_BY_ID.get('A/Y');
    if (!ay)
        throw new Error('Missing switch tile definition: A/Y');
    return shuffle([
        { kind: 'regular', letter: 'A', value: LETTER_VALUES.A, category: 'vowel' },
        { kind: 'switch', tileId: ay.id, sideA: ay.sideA, sideB: ay.sideB, category: 'vowel' },
        { kind: 'regular', letter: 'E', value: LETTER_VALUES.E, category: 'vowel' },
        { kind: 'regular', letter: 'E', value: LETTER_VALUES.E, category: 'vowel' },
        { kind: 'regular', letter: 'I', value: LETTER_VALUES.I, category: 'vowel' },
        { kind: 'regular', letter: 'I', value: LETTER_VALUES.I, category: 'vowel' },
        { kind: 'regular', letter: 'O', value: LETTER_VALUES.O, category: 'vowel' },
        { kind: 'regular', letter: 'U', value: LETTER_VALUES.U, category: 'vowel' },
    ]);
}
function buildBackupConsonantBag(): BagTile[] {
    return shuffle([
        { kind: 'regular', letter: 'C', value: LETTER_VALUES.C, category: 'consonant' },
        { kind: 'regular', letter: 'D', value: LETTER_VALUES.D, category: 'consonant' },
        { kind: 'regular', letter: 'L', value: LETTER_VALUES.L, category: 'consonant' },
        { kind: 'regular', letter: 'M', value: LETTER_VALUES.M, category: 'consonant' },
        { kind: 'regular', letter: 'N', value: LETTER_VALUES.N, category: 'consonant' },
        { kind: 'regular', letter: 'R', value: LETTER_VALUES.R, category: 'consonant' },
        { kind: 'regular', letter: 'S', value: LETTER_VALUES.S, category: 'consonant' },
        { kind: 'regular', letter: 'T', value: LETTER_VALUES.T, category: 'consonant' },
    ]);
}
export function buildStandardBagsWithBackups(): ModeBags {
    const { vowelBag, consonantBag } = buildStandardBags();
    return {
        vowelBag,
        consonantBag,
        backupVowelBag: buildBackupVowelBag(),
        backupConsonantBag: buildBackupConsonantBag(),
    };
}
