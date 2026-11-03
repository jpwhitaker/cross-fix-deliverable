import type { ExtractedWord } from '@/lib/dictionary';
import { wordKey } from '@/lib/predicates/submit/identify-ride';
export function submittedRide(words: readonly ExtractedWord[], rideKey: string | null): ExtractedWord | null {
    return rideKey ? words.find(word => wordKey(word) === rideKey) ?? null : null;
}
