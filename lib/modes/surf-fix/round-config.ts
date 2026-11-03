import type { Letter, RoundConfig } from '@/lib/tiles';
export function surfFixRoundConfig(round: number): RoundConfig {
    return {
        vowels: 4,
        consonants: 5,
        pickTiles: round >= 13 ? 3 : 1,
        totalRounds: 16,
    };
}
export const SURF_FIX_PICK_TILE_POOL: readonly Letter[] = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];
