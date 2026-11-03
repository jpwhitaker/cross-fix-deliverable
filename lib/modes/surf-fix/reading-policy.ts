import type { GameAuthoring } from '@/lib/game-settings'
import type { TileRegistry } from '@/lib/surf-fix-rules/game/types';
import type { TransientProjection } from '@/lib/surf-fix-rules/game/transient-projection';
import { hasMoreNewLettersThanReused } from '@/lib/predicates/score/new-reuse-length-bonus';
import { sideContactValue } from '@/lib/predicates/score/side-contact-value';
import { lengthPoints } from '@/lib/tiles';
export type SurfFixReadingPolicy = 'best-ride-v1';
export function surfFixReadingPolicy(authoring?: GameAuthoring | null): SurfFixReadingPolicy | undefined {
    return authoring?.source === 'surf-fix-game'
        && authoring.rideSelection === 'brush'
        ? authoring.readingPolicy : undefined;
}
export function projectedSurfFixScore(projection: Extract<TransientProjection, {
    kind: 'stable';
}>, tiles: TileRegistry): number {
    const newIds = new Set(projection.transientTileIds);
    const value = (ids: readonly string[]) => ids.map(id => tiles[id]?.value ?? 0);
    const primaryKey = projection.tileIds.join('|');
    const words = projection.submitCandidates.reduce((total, read) => {
        const letters = read.text.length;
        if (letters === 2)
            return total;
        const earnsLength = read.tileIds.join('|') === primaryKey && hasMoreNewLettersThanReused(read.tileIds.map(id => ({ letterCount: tiles[id].letter.length, reused: !newIds.has(id) })));
        return total + value(read.tileIds).reduce((sum, points) => sum + points, 0)
            + (earnsLength ? lengthPoints(letters) : 0);
    }, 0);
    const contacts = new Map(projection.sbsContacts.map(contact => [
        `${contact.text}:${contact.tileIds.join('|')}`, contact,
    ]));
    return words + [...contacts.values()].reduce((sum, contact) => sum + sideContactValue(contact.text.length, value(contact.tileIds)), 0);
}
