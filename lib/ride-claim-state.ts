import type { StateCreator, StoreApi } from 'zustand';
import type { RideClaim } from './predicates/reads/ride-claim';
type ClaimState = {
    rideClaim?: RideClaim | null;
    board: unknown;
    chainWords: unknown;
    submittedPositions: unknown;
    round: number;
    modeId: string;
};
export function withRideClaimLifetime<T extends ClaimState>(creator: StateCreator<T>): StateCreator<T> {
    return (set, get, api) => {
        const normalize = (partial: T | Partial<T> | ((state: T) => T | Partial<T>)) => {
            const before = get();
            const patch = typeof partial === 'function' ? partial(before) : partial;
            if (!before.rideClaim || Object.hasOwn(patch, 'rideClaim'))
                return patch;
            const changed = (['board', 'chainWords', 'submittedPositions', 'round', 'modeId'] as const)
                .some(field => Object.hasOwn(patch, field) && patch[field] !== before[field]);
            return changed ? { ...patch, rideClaim: null } : patch;
        };
        const wrap = (setter: StoreApi<T>['setState']): StoreApi<T>['setState'] => (partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean) => {
            const patch = normalize(partial);
            if (replace)
                setter(patch as T, true);
            else
                setter(patch);
        };
        api.setState = wrap(api.setState);
        return creator(wrap(set), get, api);
    };
}
