import type { PortAffordance, PortEffect, WordPort } from '@/lib/surf-fix-rules/frontier/word-frontier';
import type { Pos } from '@/lib/surf-fix-rules/game/types';
type SharedTileTrace = {
    wordId: string;
    wordText: string;
    tileIndex: number;
    tileId: string;
    bridgeCell: Pos;
    entryCell: Pos;
    exitCell: Pos;
};
export type SurfFixReadTrace = {
    text: string;
    cells: Pos[];
    tileIds: string[];
    steps: SurfFixTraceStep[];
    sideContacts: SurfFixSideContactTrace[];
};
export type SurfFixTraceStep = {
    kind: 'frontier-port';
    wordId: string;
    wordText: string;
    tileIndex: number;
    affordance: PortAffordance;
    effect: PortEffect;
    anchorCell: Pos;
    neighborCell: Pos;
    consumedCells: Pos[];
} | ({
    kind: 'straight-through-interior-bridge';
} & SharedTileTrace) | ({
    kind: 'shared-interior-endpoint';
} & SharedTileTrace) | {
    kind: 'submitted-word-edge';
    wordId: string;
    wordText: string;
    fromTileIndex: number;
    toTileIndex: number;
    fromCell: Pos;
    toCell: Pos;
} | {
    kind: 'loose-adjacency';
    fromTileId: string;
    toTileId: string;
    fromCell: Pos;
    toCell: Pos;
} | {
    kind: 'submitted-sbs-extension';
    contactText: string;
    cells: Pos[];
    tileIds: string[];
    direction: 'horizontal' | 'vertical';
    slot: 'pre' | 'post';
    preCell: Pos;
    postCell: Pos;
    consumedCell: Pos;
} | {
    kind: 'draft-submitted-hybrid';
    submittedWordId: string;
    submittedWordText: string;
    submittedTileIndex: number;
    submittedTileId: string;
    submittedCell: Pos;
    draftPortAffordance: PortAffordance;
    draftPortEffect: PortEffect;
    draftAnchorCell: Pos;
    draftNeighborCell: Pos;
    contactCell: Pos;
};
export type SurfFixSideContactTrace = {
    text: string;
    cells: Pos[];
    tileIds: string[];
    accepted: boolean;
    reason?: 'accepted-sbs' | 'not-in-sbs-list' | 'sbs-pre-space-occupied' | 'sbs-post-space-occupied';
};
export type SurfFixProjectionRejectionTrace = {
    kind: 'draft-read';
    reason: string;
    transientCells: Pos[];
    transientTileIds: string[];
} | {
    kind: 'bridged-structural';
    reason: string;
    transientCells: Pos[];
    transientTileIds: string[];
    candidateTexts: string[];
    coveredLooseTileIds: string[];
} | {
    kind: 'blocked-contact';
    reason: string;
    blockedContacts: Array<{
        cell: Pos;
        reason: string;
    }>;
    rejectedRead?: {
        text: string;
        cells: Pos[];
        tileIds: string[];
    };
    rejectedSbsContact?: SurfFixSideContactTrace;
};
export type SurfFixMoveValidationTrace = {
    kind: 'read-preservation';
    reason: string;
    wordId: string;
    wordText: string;
    portAffordance: 'pre' | 'post';
    anchorCell: Pos;
    neighborCell: Pos;
    occupyingWordIds: string[];
} | {
    kind: 'submitted-sbs-contact';
    reason: 'not-in-sbs-list' | 'sbs-pre-space-occupied' | 'sbs-post-space-occupied';
    submittedWordIds: string[];
    contact: SurfFixSideContactTrace;
};
export function buildSurfFixReadTraceFromPort(input: {
    text: string;
    cells: readonly Pos[];
    tileIds: readonly string[];
    port: WordPort;
    consumedCells?: readonly Pos[];
}): SurfFixReadTrace {
    return buildSurfFixReadTrace({
        text: input.text,
        cells: input.cells,
        tileIds: input.tileIds,
        steps: [surfFixTraceStepFromPort(input.port, input.consumedCells ?? [])],
    });
}
export function buildSurfFixLooseReadTrace(input: {
    text: string;
    cells: readonly Pos[];
    tileIds: readonly string[];
}): SurfFixReadTrace {
    return buildSurfFixReadTrace({
        text: input.text,
        cells: input.cells,
        tileIds: input.tileIds,
        steps: looseAdjacencySteps(input.cells, input.tileIds),
    });
}
export function buildSurfFixReadTrace(input: {
    text: string;
    cells: readonly Pos[];
    tileIds: readonly string[];
    steps?: readonly SurfFixTraceStep[];
    sideContacts?: readonly SurfFixSideContactTrace[];
}): SurfFixReadTrace {
    return {
        text: input.text,
        cells: input.cells.map(cloneCell),
        tileIds: [...input.tileIds],
        steps: (input.steps ?? []).map(cloneTraceStep),
        sideContacts: (input.sideContacts ?? []).map(cloneSideContactTrace),
    };
}
function looseAdjacencySteps(cells: readonly Pos[], tileIds: readonly string[]): SurfFixTraceStep[] {
    const steps: SurfFixTraceStep[] = [];
    for (let index = 0; index < cells.length - 1; index += 1) {
        const fromCell = cells[index];
        const toCell = cells[index + 1];
        const fromTileId = tileIds[index];
        const toTileId = tileIds[index + 1];
        if (!fromCell || !toCell || !fromTileId || !toTileId)
            continue;
        steps.push({
            kind: 'loose-adjacency',
            fromTileId,
            toTileId,
            fromCell: cloneCell(fromCell),
            toCell: cloneCell(toCell),
        });
    }
    return steps;
}
export function appendSurfFixReadTracePortStep(input: {
    trace: SurfFixReadTrace;
    text: string;
    cells: readonly Pos[];
    tileIds: readonly string[];
    port: WordPort;
    consumedCells?: readonly Pos[];
}): SurfFixReadTrace {
    const trace = cloneSurfFixReadTrace(input.trace);
    return {
        ...trace,
        text: input.text,
        cells: input.cells.map(cloneCell),
        tileIds: [...input.tileIds],
        steps: [
            ...trace.steps,
            surfFixTraceStepFromPort(input.port, input.consumedCells ?? []),
        ],
    };
}
export function cloneSurfFixReadTrace(trace: SurfFixReadTrace): SurfFixReadTrace {
    return {
        text: trace.text,
        cells: trace.cells.map(cloneCell),
        tileIds: [...trace.tileIds],
        steps: trace.steps.map(cloneTraceStep),
        sideContacts: trace.sideContacts.map((contact) => ({
            ...contact,
            cells: contact.cells.map(cloneCell),
            tileIds: [...contact.tileIds],
        })),
    };
}
export function surfFixTraceStepFromPort(port: WordPort, consumedCells: readonly Pos[] = []): SurfFixTraceStep {
    return {
        kind: 'frontier-port',
        wordId: port.wordId,
        wordText: port.wordText,
        tileIndex: port.tileIndex,
        affordance: port.affordance,
        effect: port.effect,
        anchorCell: cloneCell(port.anchorCell),
        neighborCell: cloneCell(port.neighborCell),
        consumedCells: consumedCells.map(cloneCell),
    };
}
function cloneTraceStep(step: SurfFixTraceStep): SurfFixTraceStep {
    if (step.kind === 'frontier-port') {
        return {
            ...step,
            anchorCell: cloneCell(step.anchorCell),
            neighborCell: cloneCell(step.neighborCell),
            consumedCells: step.consumedCells.map(cloneCell),
        };
    }
    if (step.kind === 'straight-through-interior-bridge' || step.kind === 'shared-interior-endpoint') {
        return {
            ...step,
            bridgeCell: cloneCell(step.bridgeCell),
            entryCell: cloneCell(step.entryCell),
            exitCell: cloneCell(step.exitCell),
        };
    }
    if (step.kind === 'submitted-word-edge') {
        return {
            ...step,
            fromCell: cloneCell(step.fromCell),
            toCell: cloneCell(step.toCell),
        };
    }
    if (step.kind === 'loose-adjacency') {
        return {
            ...step,
            fromCell: cloneCell(step.fromCell),
            toCell: cloneCell(step.toCell),
        };
    }
    if (step.kind === 'submitted-sbs-extension') {
        return {
            ...step,
            cells: step.cells.map(cloneCell),
            tileIds: [...step.tileIds],
            preCell: cloneCell(step.preCell),
            postCell: cloneCell(step.postCell),
            consumedCell: cloneCell(step.consumedCell),
        };
    }
    return {
        ...step,
        submittedCell: cloneCell(step.submittedCell),
        draftAnchorCell: cloneCell(step.draftAnchorCell),
        draftNeighborCell: cloneCell(step.draftNeighborCell),
        contactCell: cloneCell(step.contactCell),
    };
}
function cloneSideContactTrace(contact: SurfFixSideContactTrace): SurfFixSideContactTrace {
    return {
        ...contact,
        cells: contact.cells.map(cloneCell),
        tileIds: [...contact.tileIds],
    };
}
function cloneCell(cell: Pos): Pos {
    return { row: cell.row, col: cell.col };
}
