type RankedRide = {
    points: number;
    letterCount: number;
    text: string;
    cells: readonly {
        row: number;
        col: number;
    }[];
};
export function compareRideOptions(a: RankedRide, b: RankedRide): number {
    const score = b.points - a.points || b.letterCount - a.letterCount || a.text.localeCompare(b.text);
    if (score)
        return score;
    for (let i = 0; i < Math.min(a.cells.length, b.cells.length); i++) {
        const position = a.cells[i].row - b.cells[i].row || a.cells[i].col - b.cells[i].col;
        if (position)
            return position;
    }
    return a.cells.length - b.cells.length;
}
