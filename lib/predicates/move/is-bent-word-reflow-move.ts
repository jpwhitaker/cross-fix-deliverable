export function isBentWordReflowMove(movingSubmittedKeys: Set<string>, submittedBentWordPositions: Set<string> | null | undefined): boolean {
    if (movingSubmittedKeys.size === 0)
        return false;
    if (!submittedBentWordPositions || submittedBentWordPositions.size === 0)
        return false;
    for (const key of movingSubmittedKeys) {
        if (!submittedBentWordPositions.has(key))
            return false;
    }
    return true;
}
