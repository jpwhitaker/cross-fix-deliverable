export type NewReuseLengthUnit = {
    letterCount: number;
    reused: boolean;
};
export function hasMoreNewLettersThanReused(units: readonly NewReuseLengthUnit[]): boolean {
    let newLetters = 0;
    let reusedLetters = 0;
    for (const unit of units) {
        const count = Math.max(0, unit.letterCount);
        if (unit.reused)
            reusedLetters += count;
        else
            newLetters += count;
    }
    return newLetters > reusedLetters;
}
