import type { Letter, SwitchSide } from '@/lib/tiles';
export type SwitchLetterState = {
    sideA: {
        letter: Letter;
    };
    sideB: {
        letter: Letter;
    };
    activeSide?: SwitchSide;
};
export function getActiveSwitchLetter(tile: SwitchLetterState): Letter {
    return ((tile.activeSide ?? 'A') === 'A' ? tile.sideA : tile.sideB).letter;
}
export function matchesActiveSwitchLetter(tile: SwitchLetterState, letter: Letter): boolean {
    return getActiveSwitchLetter(tile) === letter;
}
