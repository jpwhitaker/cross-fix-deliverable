export function mergeHiddenTileIds(activeGroupHiddenTileIds: Set<string> | null, floatHiddenTileIds: Set<string> | null): Set<string> | null {
    if (!activeGroupHiddenTileIds && !floatHiddenTileIds)
        return null;
    const merged = new Set<string>();
    if (activeGroupHiddenTileIds)
        for (const id of activeGroupHiddenTileIds)
            merged.add(id);
    if (floatHiddenTileIds)
        for (const id of floatHiddenTileIds)
            merged.add(id);
    return merged;
}
