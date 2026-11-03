export function positionKey(row: number, col: number): string {
    return `${row}-${col}`;
}
export function parsePositionKey(key: string): {
    row: number;
    col: number;
} | null {
    const [rowText, colText] = key.split('-');
    const row = Number(rowText);
    const col = Number(colText);
    if (!Number.isInteger(row) || !Number.isInteger(col))
        return null;
    return { row, col };
}
