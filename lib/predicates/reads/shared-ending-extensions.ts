import type { ReadingTile, ReadingWord } from './board-traversal';
export type EndingOwner = ReadingWord & {
    ledgerKind?: 'word' | 'sbs';
};
export type SharedEndingExtension = {
    wordId: string;
    tileIds: string[];
};
export function sharedEndingExtensions(selected: readonly string[], words: readonly EndingOwner[], tiles: ReadonlyMap<string, ReadingTile>): SharedEndingExtension[] {
    const endings = words.flatMap(word => {
        if (word.ledgerKind === 'sbs' || word.tileIds.length < 2)
            return [];
        const end = tiles.get(word.tileIds.at(-1)!), before = tiles.get(word.tileIds.at(-2)!);
        if (!end || !before)
            return [];
        return [{ word, end: end.id, post: `${2 * end.row - before.row},${2 * end.col - before.col}` }];
    });
    const required = new Map<string, SharedEndingExtension>();
    for (const owner of endings) {
        const start = selected.indexOf(owner.word.tileIds[0]);
        const suffixStart = start + owner.word.tileIds.length;
        if (start < 0 || suffixStart >= selected.length
            || !owner.word.tileIds.every((id, i) => selected[start + i] === id && tiles.get(id)?.isNew === false)
            || !tiles.get(selected[suffixStart])?.isNew)
            continue;
        const suffix = selected.slice(suffixStart);
        for (const peer of endings) {
            if (peer.word.id === owner.word.id || peer.end !== owner.end || peer.post !== owner.post)
                continue;
            const tileIds = [...peer.word.tileIds, ...suffix];
            if (tileIds.length === selected.length && tileIds.every((id, i) => selected[i] === id))
                continue;
            required.set(tileIds.join('|'), { wordId: peer.word.id, tileIds });
        }
    }
    return [...required.values()];
}
