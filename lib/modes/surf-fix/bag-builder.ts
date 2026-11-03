import { buildStandardBagsWithBackups } from '@/lib/modes/shared/bag-builder';
import type { ModeBags } from '@/lib/modes/types';
export function buildSurfFixBags(): ModeBags {
    return buildStandardBagsWithBackups();
}
