import type { Letter, LetterCategory } from './tiles';
import { getSwitchTileCategory, getSwitchTileLowerSide } from './tiles';
export type RerunReason = 'RIPPLES' | 'ANKLE_BITERS' | 'CHOPPY_WATERS';
export interface RerunResult {
    shouldRerun: boolean;
    reason?: RerunReason;
    replaceIds: string[];
    keepVowels?: boolean;
    message?: string;
}
interface RerunComparableTile {
    id: string;
    letter: Letter;
    value: number;
    category: LetterCategory;
}
export type RerunCheckTile = {
    kind: 'regular';
    id: string;
    letter: Letter;
    value: number;
    category: LetterCategory;
} | {
    kind: 'switch';
    id: string;
    tileId: string;
} | {
    kind: 'double' | 'surfboard';
    id: string;
};
export interface CheckRerunsOptions {
    ripplesBonusLetters?: Partial<Record<Letter, number>>;
}
function toComparableTile(tile: RerunCheckTile): RerunComparableTile | null {
    if (tile.kind === 'regular') {
        return {
            id: tile.id,
            letter: tile.letter,
            value: tile.value,
            category: tile.category,
        };
    }
    if (tile.kind === 'switch') {
        const lowerSide = getSwitchTileLowerSide(tile.tileId);
        return {
            id: tile.id,
            letter: lowerSide.letter,
            value: lowerSide.value,
            category: getSwitchTileCategory(tile.tileId),
        };
    }
    return null;
}
export function checkReruns(hand: readonly RerunCheckTile[], options?: CheckRerunsOptions): RerunResult {
    const comparableTiles = hand
        .map(toComparableTile)
        .filter((tile): tile is RerunComparableTile => tile !== null);
    const letterCounts: Record<string, string[]> = {};
    comparableTiles.forEach(t => {
        if (!letterCounts[t.letter])
            letterCounts[t.letter] = [];
        letterCounts[t.letter].push(t.id);
    });
    const ripplesLetterCounts: Record<string, string[]> = Object.fromEntries(Object.entries(letterCounts).map(([letter, ids]) => [letter, [...ids]]));
    const ripplesBonusLetters = options?.ripplesBonusLetters;
    if (ripplesBonusLetters) {
        for (const [letter, rawCount] of Object.entries(ripplesBonusLetters) as Array<[
            Letter,
            number
        ]>) {
            const count = Math.max(0, Math.floor(rawCount));
            if (count <= 0)
                continue;
            if (!ripplesLetterCounts[letter])
                ripplesLetterCounts[letter] = [];
            const virtualIds = Array.from({ length: count }, (_, i) => `__virtual-${letter}-${i}`);
            ripplesLetterCounts[letter].unshift(...virtualIds);
        }
    }
    const ripplesToReplace: string[] = [];
    Object.values(ripplesLetterCounts).forEach(ids => {
        if (ids.length >= 3) {
            ripplesToReplace.push(...ids.slice(2).filter((id) => !id.startsWith('__virtual-')));
        }
    });
    if (ripplesToReplace.length > 0) {
        return {
            shouldRerun: true,
            reason: 'RIPPLES',
            replaceIds: ripplesToReplace,
            message: 'RIPPLES: 3+ same letters.',
        };
    }
    let pairCount = 0;
    Object.values(letterCounts).forEach(ids => {
        if (ids.length === 2)
            pairCount++;
    });
    if (pairCount >= 4) {
        return {
            shouldRerun: true,
            reason: 'ANKLE_BITERS',
            replaceIds: comparableTiles.map(t => t.id),
            message: 'ANKLE BITERS: 4 pairs.',
        };
    }
    const choppyPoints = comparableTiles.reduce((sum, t) => {
        if (t.letter === 'X' || t.value < 2)
            return sum;
        return sum + t.value;
    }, 0);
    if (choppyPoints >= 10) {
        const vowels = comparableTiles.filter(t => t.category === 'vowel');
        const allVowelsOnePt = vowels.every(v => v.value === 1);
        if (allVowelsOnePt && vowels.length > 0) {
            const vowelIds = new Set(vowels.map(v => v.id));
            return {
                shouldRerun: true,
                reason: 'CHOPPY_WATERS',
                replaceIds: comparableTiles.filter(t => !vowelIds.has(t.id)).map(t => t.id),
                keepVowels: true,
                message: 'CHOPPY WATERS: High value hand!',
            };
        }
        else {
            return {
                shouldRerun: true,
                reason: 'CHOPPY_WATERS',
                replaceIds: comparableTiles.map(t => t.id),
                message: 'CHOPPY WATERS: High value hand!',
            };
        }
    }
    return { shouldRerun: false, replaceIds: [] };
}
