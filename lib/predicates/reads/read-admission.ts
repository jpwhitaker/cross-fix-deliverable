export type ReadAdmissionFacts = {
    required: boolean;
    requiresAcceptedConsumption?: boolean;
    accepted: boolean;
    coversAllNewTiles: boolean;
    hasConsumedContacts: boolean;
};
export function readAdmission(facts: ReadAdmissionFacts) {
    const selectable = facts.required || !facts.requiresAcceptedConsumption || facts.accepted;
    return {
        selectable,
        consumesContacts: selectable && (facts.required || facts.coversAllNewTiles
            || facts.hasConsumedContacts || facts.accepted),
    };
}
