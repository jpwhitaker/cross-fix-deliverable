import type { Letter } from '@/lib/tiles';
export type HandWildcardChoiceCandidate = {
    kind: string;
    letter?: Letter;
    isPickTile?: boolean;
    wildcardRepresentsLetter?: Letter;
};
type HandWildcardChoiceTile = HandWildcardChoiceCandidate & {
    kind: 'regular';
    letter: 'X';
};
export function isHandWildcardChoiceTile(tile: HandWildcardChoiceCandidate | null | undefined): tile is HandWildcardChoiceTile {
    return tile?.kind === 'regular' && tile.letter === 'X' && !tile.isPickTile;
}
export function normalizeWildcardLetterChoice(letter: Letter | null | undefined): Letter | undefined {
    return letter && letter !== 'X' ? letter : undefined;
}
export function canSetHandWildcardLetter(input: {
    tile: HandWildcardChoiceCandidate | null | undefined;
    modeAllowsWildcardLetters: boolean;
    forceUseXActive: boolean;
    letter: Letter | null;
}): boolean {
    if (!input.modeAllowsWildcardLetters)
        return false;
    if (!isHandWildcardChoiceTile(input.tile))
        return false;
    if (input.forceUseXActive && normalizeWildcardLetterChoice(input.letter))
        return false;
    return true;
}
export function getHandWildcardRepresentedLetter(input: {
    tile: HandWildcardChoiceCandidate | null | undefined;
    modeAllowsWildcardLetters: boolean;
    forceUseXActive: boolean;
}): Letter | undefined {
    if (!input.modeAllowsWildcardLetters)
        return undefined;
    if (input.forceUseXActive)
        return undefined;
    if (!isHandWildcardChoiceTile(input.tile))
        return undefined;
    return normalizeWildcardLetterChoice(input.tile.wildcardRepresentsLetter);
}
