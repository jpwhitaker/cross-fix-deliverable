import type { CellKey } from '@/lib/modes/move-policy';
export type { CellKey };
export type CellAnnotation = {
    isBlockedAdjacency: boolean;
    isValidWord: boolean;
    isSelected: boolean;
    isInspected: boolean;
    isFloatInvalid: boolean;
    isSurfFixPrePostHint: boolean;
};
export type CellAnnotationChannels = {
    blockedKeys: Set<CellKey>;
    validWordKeys: Set<CellKey>;
    selectedKeys: Set<CellKey>;
    inspectedKeys?: Set<CellKey>;
    floatInvalidKeys: Set<CellKey>;
    surfFixPrePostHintKeys?: Set<CellKey>;
};
export const EMPTY_ANNOTATION: CellAnnotation = {
    isBlockedAdjacency: false,
    isValidWord: false,
    isSelected: false,
    isInspected: false,
    isFloatInvalid: false,
    isSurfFixPrePostHint: false,
};
function ensureAnnotation(map: Map<CellKey, CellAnnotation>, key: CellKey): CellAnnotation {
    const existing = map.get(key);
    if (existing)
        return existing;
    const created = { ...EMPTY_ANNOTATION };
    map.set(key, created);
    return created;
}
export function composeCellAnnotations({ blockedKeys, validWordKeys, selectedKeys, inspectedKeys = new Set<CellKey>(), floatInvalidKeys, surfFixPrePostHintKeys = new Set<CellKey>(), }: CellAnnotationChannels): Map<CellKey, CellAnnotation> {
    const annotations = new Map<CellKey, CellAnnotation>();
    for (const key of blockedKeys) {
        ensureAnnotation(annotations, key).isBlockedAdjacency = true;
    }
    for (const key of validWordKeys) {
        ensureAnnotation(annotations, key).isValidWord = true;
    }
    for (const key of selectedKeys) {
        ensureAnnotation(annotations, key).isSelected = true;
    }
    for (const key of inspectedKeys) {
        ensureAnnotation(annotations, key).isInspected = true;
    }
    for (const key of floatInvalidKeys) {
        ensureAnnotation(annotations, key).isFloatInvalid = true;
    }
    for (const key of surfFixPrePostHintKeys) {
        ensureAnnotation(annotations, key).isSurfFixPrePostHint = true;
    }
    return annotations;
}
