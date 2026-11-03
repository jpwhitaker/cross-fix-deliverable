export type SwitchSide = "A" | "B";
export type TileKind = "regular" | "double" | "switch" | "pick" | "backup" | "wildcard" | "surfboard";
export type LetterCategory = "vowel" | "consonant";
export type Letter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";
export const LETTER_VALUES: Record<Letter, number> = {
    A: 1,
    B: 2,
    C: 2,
    D: 2,
    E: 1,
    F: 3,
    G: 2,
    H: 3,
    I: 1,
    J: 4,
    K: 3,
    L: 1,
    M: 2,
    N: 1,
    O: 1,
    P: 2,
    Q: 5,
    R: 1,
    S: 1,
    T: 1,
    U: 2,
    V: 3,
    W: 3,
    X: 4,
    Y: 3,
    Z: 5,
};
export interface DoubleTile {
    kind: "double";
    id: string;
    letters: [
        Letter,
        Letter
    ];
    value: number;
}
export const DOUBLE_TILES: DoubleTile[] = [
    { kind: "double", id: "CH", letters: ["C", "H"], value: 5 },
    { kind: "double", id: "PH", letters: ["P", "H"], value: 5 },
    { kind: "double", id: "SH", letters: ["S", "H"], value: 4 },
    { kind: "double", id: "TH", letters: ["T", "H"], value: 4 },
    { kind: "double", id: "CK", letters: ["C", "K"], value: 5 },
];
export interface SwitchOption {
    letter: Letter;
    value: number;
}
export interface SwitchTile {
    kind: "switch";
    id: string;
    category: LetterCategory;
    count: number;
    sideA: SwitchOption;
    sideB: SwitchOption;
}
export type SwitchTileId = SwitchTile["id"];
export const SWITCH_TILES: SwitchTile[] = [
    {
        kind: "switch",
        id: "A/Y",
        category: "vowel",
        count: 1,
        sideA: { letter: "A", value: 1 },
        sideB: { letter: "Y", value: 3 },
    },
    {
        kind: "switch",
        id: "I/J",
        category: "vowel",
        count: 1,
        sideA: { letter: "I", value: 1 },
        sideB: { letter: "J", value: 4 },
    },
    {
        kind: "switch",
        id: "M/W",
        category: "consonant",
        count: 2,
        sideA: { letter: "M", value: 2 },
        sideB: { letter: "W", value: 3 },
    },
    {
        kind: "switch",
        id: "O/Q",
        category: "vowel",
        count: 1,
        sideA: { letter: "O", value: 1 },
        sideB: { letter: "Q", value: 5 },
    },
    {
        kind: "switch",
        id: "N/Z",
        category: "consonant",
        count: 1,
        sideA: { letter: "N", value: 1 },
        sideB: { letter: "Z", value: 5 },
    },
];
export const SWITCH_TILE_BY_ID: ReadonlyMap<string, SwitchTile> = new Map(SWITCH_TILES.map((t) => [t.id, t]));
function getSwitchTileOrThrow(tileId: string): SwitchTile {
    const tile = SWITCH_TILE_BY_ID.get(tileId);
    if (!tile) {
        throw new Error(`Unknown switch tile id: ${tileId}`);
    }
    return tile;
}
export function getSwitchTileCategory(tileId: string): LetterCategory {
    return getSwitchTileOrThrow(tileId).category;
}
export function isVowelSwitchTile(tileId: string): boolean {
    return getSwitchTileCategory(tileId) === "vowel";
}
export function getSwitchTileLowerSide(tileId: string): SwitchOption {
    const tile = getSwitchTileOrThrow(tileId);
    return tile.sideA.value <= tile.sideB.value ? tile.sideA : tile.sideB;
}
export function getSwitchTileLowerLetter(tileId: string): Letter {
    return getSwitchTileLowerSide(tileId).letter;
}
export function getSwitchTileLowerValue(tileId: string): number {
    return getSwitchTileLowerSide(tileId).value;
}
export const DOUBLE_TILE_BY_ID: ReadonlyMap<string, DoubleTile> = new Map(DOUBLE_TILES.map((t) => [t.id, t]));
export interface WildcardTile {
    kind: "wildcard";
    id: "X";
    baseValue: number;
    representsValue: (letter: Letter) => number;
}
export const WILDCARD_TILE: WildcardTile = {
    kind: "wildcard",
    id: "X",
    baseValue: 4,
    representsValue: (letter: Letter) => LETTER_VALUES[letter],
};
export interface RegularTileEntry {
    letter: Letter;
    category: LetterCategory;
    value: number;
    count: number;
}
export const REGULAR_TILES: RegularTileEntry[] = [
    { letter: "A", category: "vowel", value: 1, count: 10 },
    { letter: "E", category: "vowel", value: 1, count: 14 },
    { letter: "I", category: "vowel", value: 1, count: 10 },
    { letter: "O", category: "vowel", value: 1, count: 8 },
    { letter: "U", category: "vowel", value: 2, count: 4 },
    { letter: "Y", category: "vowel", value: 3, count: 1 },
    { letter: "B", category: "consonant", value: 2, count: 2 },
    { letter: "C", category: "consonant", value: 2, count: 5 },
    { letter: "D", category: "consonant", value: 2, count: 4 },
    { letter: "F", category: "consonant", value: 3, count: 2 },
    { letter: "G", category: "consonant", value: 2, count: 3 },
    { letter: "H", category: "consonant", value: 3, count: 1 },
    { letter: "K", category: "consonant", value: 3, count: 1 },
    { letter: "L", category: "consonant", value: 1, count: 7 },
    { letter: "M", category: "consonant", value: 2, count: 2 },
    { letter: "N", category: "consonant", value: 1, count: 8 },
    { letter: "P", category: "consonant", value: 2, count: 4 },
    { letter: "R", category: "consonant", value: 1, count: 9 },
    { letter: "S", category: "consonant", value: 1, count: 8 },
    { letter: "T", category: "consonant", value: 1, count: 8 },
    { letter: "V", category: "consonant", value: 3, count: 1 },
    { letter: "W", category: "consonant", value: 3, count: 1 },
    { letter: "X", category: "consonant", value: 4, count: 1 },
];
export interface RoundConfig {
    vowels: number;
    consonants: number;
    pickTiles: number;
    totalRounds: number;
}
export function lengthPoints(letterCount: number): number {
    if (letterCount < 7)
        return 0;
    return (letterCount - 6) * 10;
}
export type CellDescriptor = {
    kind: "empty";
} | {
    kind: "regular";
    letter: Letter;
    value: number;
    isPickTile?: boolean;
} | {
    kind: "double";
    id: string;
    letters: [
        Letter,
        Letter
    ];
    value: number;
} | {
    kind: "switch";
    id: string;
    sideA: SwitchOption;
    sideB: SwitchOption;
} | {
    kind: "wildcard";
    representsLetter?: Letter;
} | {
    kind: "surfboard";
    tileId: string;
};
const EMPTY_CELL: CellDescriptor = { kind: "empty" };
export function classifyCell(raw: string): CellDescriptor {
    if (!raw)
        return EMPTY_CELL;
    if (raw === 'SURF')
        return { kind: 'surfboard', tileId: 'SURF' };
    const switchTile = SWITCH_TILE_BY_ID.get(raw);
    if (switchTile) {
        return { kind: "switch", id: switchTile.id, sideA: switchTile.sideA, sideB: switchTile.sideB };
    }
    const doubleTile = DOUBLE_TILE_BY_ID.get(raw);
    if (doubleTile) {
        return { kind: "double", id: doubleTile.id, letters: doubleTile.letters, value: doubleTile.value };
    }
    const letter = raw as Letter;
    if (letter in LETTER_VALUES) {
        return { kind: "regular", letter, value: LETTER_VALUES[letter] };
    }
    return { kind: "regular", letter, value: 0 };
}
