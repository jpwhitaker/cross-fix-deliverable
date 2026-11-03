export type CandidateSource = 'transient-only' | 'submitted-contact';
export type CandidatePriorityInput = {
    cells: readonly unknown[];
    source: CandidateSource;
};
export type CandidateTileOrderInput = {
    tileIds: readonly string[];
};
export function candidateSourceRank(source: CandidateSource): number {
    return source === 'submitted-contact' ? 1 : 0;
}
export function compareCandidatePriority(a: CandidatePriorityInput, b: CandidatePriorityInput): number {
    return b.cells.length - a.cells.length || candidateSourceRank(b.source) - candidateSourceRank(a.source);
}
export function candidateTileOrderKey(candidate: CandidateTileOrderInput): string {
    return candidate.tileIds.join('|');
}
export function uniqueCandidatesByTileOrder<T extends CandidateTileOrderInput>(candidates: readonly T[]): T[] {
    const seen = new Set<string>();
    const unique: T[] = [];
    for (const candidate of candidates) {
        const key = candidateTileOrderKey(candidate);
        if (seen.has(key))
            continue;
        seen.add(key);
        unique.push(candidate);
    }
    return unique;
}
