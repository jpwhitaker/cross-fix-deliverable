import { pointerWithin, type CollisionDetection } from '@dnd-kit/core';
export const DOCK_SURFACE_ID = 'dock-surface-zone';
export const LETTER_BANK_RETURN_ID = 'letter-bank-return-zone';
export function isDockReturnZone(id: string | undefined): boolean {
    return id === LETTER_BANK_RETURN_ID || id === DOCK_SURFACE_ID
        || id === 'pick-drawer-zone' || id === 'double-return-zone';
}
export const dockCollisionDetection: CollisionDetection = (args) => {
    const collisions = pointerWithin(args);
    const dockHits = collisions.filter((hit) => !String(hit.id).startsWith('board-'));
    const specificHits = dockHits.filter((hit) => hit.id !== DOCK_SURFACE_ID);
    return specificHits.length > 0 ? specificHits : dockHits.length > 0 ? dockHits : collisions;
};
