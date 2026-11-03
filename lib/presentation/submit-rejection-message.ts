import type { GameModeId, SubmitResult } from '@/lib/modes/types';
const PLACEMENT_MESSAGE = 'This placement isn’t valid. Check the spaces around your words.';
export function submitRejectionMessage(result: Extract<SubmitResult, {
    ok: false;
}>, modeId?: GameModeId): string {
    const spelling = result.meta?.rejectedSpelling;
    const ride = result.meta?.words?.[0]?.word;
    const rejectedCompanion = result.code === 'not-accepted' && spelling && ride
        && spelling.toUpperCase() !== ride.toUpperCase();
    if (modeId === 'surf-fix' && (rejectedCompanion || result.code === 'invalid-sbs'
        || result.code === 'multiple-word-groups'))
        return PLACEMENT_MESSAGE;
    return spelling ? `${spelling} is not in the dictionary or approved SBS list.` : result.message;
}
