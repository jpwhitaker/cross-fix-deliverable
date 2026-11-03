export type Pos = {
    row: number;
    col: number;
};
export type Direction = 'up' | 'right' | 'down' | 'left';
export type Tile = {
    id: string;
    letter: string;
    value: number;
};
export type HandTile = Tile;
export type TileRegistry = Record<string, Tile>;
export type TransientPlacement = {
    tileId: string;
    pos: Pos;
};
export type ShapePath = {
    cells: Pos[];
};
export type SurfFixWordLedgerKind = 'word' | 'sbs';
export type WordSnapshot = {
    text: string;
    ledgerKind?: SurfFixWordLedgerKind;
    tileTexts: string[];
    orderedTileIds: string[];
    shape: ShapePath;
    ancestors: string[];
    roundCreated: number;
    replacedAtRound: number;
};
export type SurfFixWord = {
    id: string;
    text: string;
    ledgerKind?: SurfFixWordLedgerKind;
    tileTexts: string[];
    orderedTileIds: string[];
    shape: ShapePath;
};
export type SubmittedWord = SurfFixWord & {
    ancestors: string[];
    roundCreated: number;
    history: WordSnapshot[];
};
export type ArchivedWordRegistry = Record<string, SubmittedWord>;
export type BoardCell = {
    kind: 'empty';
} | {
    kind: 'tile';
    tileId: string;
};
export type ActiveDrag = {
    source: 'hand';
    tileId: string;
} | {
    source: 'board';
    tileId: string;
    from: Pos;
} | {
    source: 'selection';
    tileId: string;
    from: Pos;
};
