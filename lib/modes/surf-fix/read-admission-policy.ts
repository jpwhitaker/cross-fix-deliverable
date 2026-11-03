import { readAdmission } from '@/lib/predicates/reads/read-admission';
import { surfFixReadingAcceptance } from './reading-acceptance';
type Read = {
    text: string;
    tileIds: readonly string[];
    cells: readonly {
        row: number;
        col: number;
    }[];
    requiresAcceptedConsumption?: boolean;
    consumedContactCells?: readonly {
        row: number;
        col: number;
    }[];
};
export function surfFixReadAdmission(read: Read, requiredPathKeys: ReadonlySet<string>, coversAllNewTiles: boolean) {
    return readAdmission({
        required: requiredPathKeys.has(read.tileIds.join('|')),
        requiresAcceptedConsumption: read.requiresAcceptedConsumption,
        accepted: surfFixReadingAcceptance(read) !== null,
        coversAllNewTiles,
        hasConsumedContacts: !!read.consumedContactCells?.length,
    });
}
