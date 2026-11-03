import type { SurfFixWord, SurfFixWordLedgerKind, SurfFixWordSnapshot } from './word-ledger-types';
export function surfFixWordLedgerKind(word: Pick<SurfFixWordSnapshot, 'ledgerKind'>): SurfFixWordLedgerKind {
    return word.ledgerKind ?? 'word';
}
export function activeWordLedgerWords(words: readonly SurfFixWord[]): SurfFixWord[] {
    const referencedAncestorIds = new Set(words.flatMap((word) => word.ancestors));
    return words.filter((word) => !referencedAncestorIds.has(word.id));
}
export function activeFullWordLedgerWords(words: readonly SurfFixWord[]): SurfFixWord[] {
    return activeWordLedgerWords(words).filter((word) => surfFixWordLedgerKind(word) === 'word');
}
export function replaceWordLedgerTileId(words: readonly SurfFixWord[], oldTileId: string, newTileId: string): SurfFixWord[] {
    if (oldTileId === newTileId)
        return [...words];
    let changed = false;
    const replaceIds = (ids: readonly string[]): string[] => {
        let idsChanged = false;
        const nextIds = ids.map((id) => {
            if (id !== oldTileId)
                return id;
            idsChanged = true;
            return newTileId;
        });
        changed ||= idsChanged;
        return idsChanged ? nextIds : [...ids];
    };
    const nextWords = words.map((word) => ({
        ...word,
        orderedTileIds: replaceIds(word.orderedTileIds),
        history: word.history.map((snapshot) => ({
            ...snapshot,
            orderedTileIds: replaceIds(snapshot.orderedTileIds),
        })),
    }));
    return changed ? nextWords : [...words];
}
