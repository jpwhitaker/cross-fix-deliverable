export const PALETTE = {
    teal: "#63c9cd",
    white: "#ffffff",
    green: "#a2c25f",
    sky: "#98d4ec",
    cream: "#fce49a",
    orange: "#ffb73f",
    rust: "#d5701e",
    ink: "#111111",
} as const;
export const TILE_COLORS = [
    PALETTE.cream, PALETTE.sky, PALETTE.green,
    PALETTE.orange, PALETTE.teal, PALETTE.cream,
    PALETTE.sky, PALETTE.green,
];
export const LETTER_VALUES: Record<string, number> = {
    A: 1, B: 2, C: 2, D: 2, E: 1, F: 3, G: 2, H: 3, I: 1, J: 4, K: 3, L: 1, M: 2,
    N: 1, O: 1, P: 2, Q: 5, R: 1, S: 1, T: 1, U: 2, V: 3, W: 3, X: 4, Y: 3, Z: 5,
};
