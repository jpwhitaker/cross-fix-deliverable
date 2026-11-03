export function sideContactValue(letterCount: number, tileValues: readonly number[]): number {
    return letterCount > 2 ? tileValues.reduce((sum, value) => sum + value, 0) : 0;
}
