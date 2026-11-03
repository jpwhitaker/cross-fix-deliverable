import type { SwitchTileId } from '@/lib/tiles';
export const TILE_BG = 'var(--e-tile-bg, linear-gradient(145deg, #ffffff, #f0faff))';
export const TILE_BG_VALID = 'linear-gradient(145deg, #d4f5dc, #b8eec4)';
export const TILE_BORDER = 'var(--e-tile-border, 1px solid rgba(255,255,255,0.8))';
export const PICK_TILE_BG = 'var(--e-pick-tile-bg, linear-gradient(145deg, #38bdf8, #0284c7))';
export const PICK_TILE_BG_VALID = 'linear-gradient(145deg, #96dfe7, #6fc4c5)';
export const tileShadow = (c = 4) => `0 ${c}px 0 var(--e-tile-chin, #ADE8F4), 0 ${c * 2}px 15px -5px rgba(0, 119, 182, 0.2)`;
export const tileShadowValid = (c = 4) => `0 ${c}px 0 var(--e-tile-chin-valid, #7fe0a0), 0 ${c * 2}px 15px -5px rgba(9, 115, 66, 0.2)`;
export const pickTileShadow = (c = 4) => {
    const b = c >= 3 ? 2 : 1;
    return `inset 0 0 0 ${b}px var(--e-pick-tile-inset, var(--e-pick-tile-chin, #0369a1)), 0 ${c}px 0 var(--e-pick-tile-chin, #0369a1), 0 ${c * 2}px 15px -5px rgba(3, 105, 161, 0.3)`;
};
export const pickTileShadowValid = (c = 4) => {
    const b = c >= 3 ? 2 : 1;
    return `inset 0 0 0 ${b}px var(--e-pick-tile-chin-valid, #4db0a0), 0 ${c}px 0 var(--e-pick-tile-chin-valid, #4db0a0), 0 ${c * 2}px 15px -5px rgba(7, 111, 104, 0.24)`;
};
export const TILE_SHADOW = tileShadow();
export const TILE_SHADOW_VALID = tileShadowValid();
export const PICK_TILE_SHADOW = pickTileShadow();
export const PICK_TILE_SHADOW_VALID = pickTileShadowValid();
export const FIXED_TILE_BG = 'rgba(0, 110, 134, 0.18)';
export const FIXED_LETTER_COLOR = 'var(--e-tile-letter-color, #004c5e)';
export const GLOSS = 'var(--e-gloss, linear-gradient(to bottom, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 100%))';
export const LIP_COLOR = 'var(--e-lip-color, #ADE8F4)';
export const LIP_COLOR_VALID = 'var(--e-lip-color-valid, #7fe0a0)';
export type SwitchTint = {
    bg: string;
    dot: string;
};
export const SWITCH_TILE_TINTS = {
    'A/Y': { bg: 'var(--e-switch-ay-bg, #fecaca)', dot: 'var(--e-switch-ay-dot, #ef4444)' },
    'O/Q': { bg: 'var(--e-switch-oq-bg, #fed7aa)', dot: 'var(--e-switch-oq-dot, #f97316)' },
    'M/W': { bg: 'var(--e-switch-mw-bg, #fef08a)', dot: 'var(--e-switch-mw-dot, #eab308)' },
    'N/Z': { bg: 'var(--e-switch-nz-bg, #6ad09d)', dot: 'var(--e-switch-nz-dot, #065f46)' },
    'I/J': { bg: 'var(--e-switch-ij-bg, #c7d2fe)', dot: 'var(--e-switch-ij-dot, #6366f1)' },
} satisfies Record<SwitchTileId, SwitchTint>;
export function getSwitchTint(sideA: string, sideB: string): SwitchTint | null {
    const key = `${sideA}/${sideB}`;
    return (SWITCH_TILE_TINTS as Record<string, SwitchTint>)[key] ?? null;
}
