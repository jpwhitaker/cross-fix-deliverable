import type { RoundConfig, Letter } from '@/lib/tiles';
export function keikiPlayRoundConfig(): RoundConfig {
    return { vowels: 4, consonants: 5, pickTiles: 1, totalRounds: 12 };
}
export const KEIKI_PICK_TILE_POOL: readonly Letter[] = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];
