import { positionKey } from '@/lib/util/position-key';
export function isContiguousPositionKeys(keys: Set<string>): boolean {
    if (keys.size <= 1)
        return true;
    const parse = (key: string): [
        number,
        number
    ] | null => {
        const [rowText, colText] = key.split('-');
        const row = Number(rowText);
        const col = Number(colText);
        if (!Number.isFinite(row) || !Number.isFinite(col))
            return null;
        return [row, col];
    };
    const start = keys.values().next().value as string | undefined;
    if (!start)
        return true;
    const seen = new Set<string>();
    const queue: string[] = [start];
    seen.add(start);
    while (queue.length > 0) {
        const current = queue.shift()!;
        const parsed = parse(current);
        if (!parsed)
            continue;
        const [row, col] = parsed;
        const neighbors = [
            positionKey(row - 1, col),
            positionKey(row + 1, col),
            positionKey(row, col - 1),
            positionKey(row, col + 1),
        ];
        for (const n of neighbors) {
            if (!keys.has(n) || seen.has(n))
                continue;
            seen.add(n);
            queue.push(n);
        }
    }
    return seen.size === keys.size;
}
