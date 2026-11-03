export type GameAuthoring = {
    pickRules: 'standard';
    rideSelection?: 'brush';
    readingPolicy?: 'best-ride-v1';
    source: 'surf-fix-game';
    tileSupply: 'standard';
    randomDraws: true;
};
export const SURF_FIX_GAME = {
    source: 'surf-fix-game', tileSupply: 'standard', randomDraws: true, pickRules: 'standard',
    rideSelection: 'brush', readingPolicy: 'best-ride-v1',
} as const satisfies GameAuthoring;
