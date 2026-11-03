import type { Letter } from '@/lib/tiles';
export type EquivalentReclaimReplacementTile = {
    kind: string;
    letter?: Letter;
    isPickTile?: boolean;
};
type RegularEquivalentReclaimReplacementTile = EquivalentReclaimReplacementTile & {
    kind: 'regular';
    letter: Letter;
};
export function canRegularTileReclaimEquivalent(tile: EquivalentReclaimReplacementTile | null | undefined, targetLetter: Letter): tile is RegularEquivalentReclaimReplacementTile {
    return tile?.kind === 'regular' && !tile.isPickTile && tile.letter === targetLetter;
}
