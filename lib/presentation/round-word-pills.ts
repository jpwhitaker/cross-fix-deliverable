import { lengthPoints } from '@/lib/tiles';
export type PlayedWordRole = 'ride' | 'extra' | 'sbs';
export type PlayedWordHighlightPosition = {
    row: number;
    col: number;
};
export type PlayedWordEntry = {
    word: string;
    points: number;
    round: number;
    scoreParts?: PlayedWordScoreParts;
    role?: PlayedWordRole;
    highlightTileIds?: string[];
    highlightPositions?: PlayedWordHighlightPosition[];
};
export type RoundWordPill = {
    round: number;
    ride: PlayedWordEntry;
    extras: PlayedWordEntry[];
    totalPoints: number;
};
export type PlayedWordScoreParts = {
    value: number;
    length: number;
};
export function scorePartsForPlayedWord(entry: PlayedWordEntry, options: {
    withLengthBonus: boolean;
}): PlayedWordScoreParts {
    if (entry.scoreParts)
        return entry.scoreParts;
    const length = options.withLengthBonus ? lengthPoints(playedWordLetterCount(entry.word)) : 0;
    return {
        value: entry.points - length,
        length,
    };
}
function pickRide(entries: readonly PlayedWordEntry[]): PlayedWordEntry {
    const explicit = entries.find((entry) => entry.role === 'ride');
    if (explicit)
        return explicit;
    const candidates = entries.some((entry) => entry.role !== 'sbs')
        ? entries.filter((entry) => entry.role !== 'sbs')
        : entries;
    return candidates.reduce((best, entry) => {
        if (entry.points > best.points)
            return entry;
        if (entry.points === best.points && entry.word.length > best.word.length)
            return entry;
        return best;
    });
}
export function buildRoundWordPills(playedWords: readonly PlayedWordEntry[]): RoundWordPill[] {
    const byRound = new Map<number, PlayedWordEntry[]>();
    const orderedRounds: number[] = [];
    for (const entry of playedWords) {
        if (entry.points <= 0 && entry.role !== 'sbs')
            continue;
        if (!byRound.has(entry.round)) {
            byRound.set(entry.round, []);
            orderedRounds.push(entry.round);
        }
        byRound.get(entry.round)!.push(entry);
    }
    const pills: RoundWordPill[] = [];
    for (const round of orderedRounds) {
        const entries = byRound.get(round)!;
        if (entries.length === 0)
            continue;
        const ride = pickRide(entries);
        const extras = entries.filter((entry) => entry !== ride);
        const totalPoints = entries.reduce((sum, entry) => sum + entry.points, 0);
        pills.push({ round, ride, extras, totalPoints });
    }
    return pills;
}
function playedWordLetterCount(word: string): number {
    return word.replace(/-/g, '').length;
}
export function playedWordEntryIdentity(entry: Pick<PlayedWordEntry, 'word' | 'round' | 'role' | 'highlightTileIds' | 'highlightPositions'>): string {
    const tileKey = entry.highlightTileIds?.join('|') ?? '';
    const positionKey = entry.highlightPositions?.map((pos) => `${pos.row}-${pos.col}`).join('|') ?? '';
    const detailKey = tileKey || positionKey;
    return `${entry.round}:${entry.role ?? 'word'}:${entry.word.toUpperCase()}:${detailKey}`;
}
