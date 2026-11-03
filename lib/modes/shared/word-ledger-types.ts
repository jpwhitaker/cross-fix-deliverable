export type Pos = {
    row: number;
    col: number;
};
export type Direction = 'up' | 'right' | 'down' | 'left';
export type ShapePath = {
    cells: Pos[];
};
export type SurfFixWordLedgerKind = 'word' | 'sbs';
export type SurfFixWordSnapshot = {
    id: string;
    text: string;
    ledgerKind?: SurfFixWordLedgerKind;
    orderedTileIds: string[];
    shape: ShapePath;
    ancestors: string[];
    roundCreated: number;
};
export type SurfFixWord = SurfFixWordSnapshot & {
    history: SurfFixWordSnapshot[];
};
export type SurfFixWordDraft = Omit<SurfFixWordSnapshot, 'id'> & {
    revisionOfWordId?: string | null;
};
