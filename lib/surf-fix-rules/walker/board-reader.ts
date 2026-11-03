import { buildReadingGraph, walkReadingGraph, type ReadingScope, type ReadingTile, type WalkPath } from '@/lib/predicates/reads/board-traversal';
import type { SubmittedWord, TileRegistry, TransientPlacement } from '../game/types';
import { deriveWordFrontier } from '../frontier/word-frontier';
import { buildSurfFixReadTrace, surfFixTraceStepFromPort, type SurfFixTraceStep } from '../trace/read-trace';
export function discoverBoardReads(input: {
    words: readonly SubmittedWord[];
    tiles: TileRegistry;
    transientPlacements: readonly TransientPlacement[];
    scope?: ReadingScope;
}) {
    const positions = new Map<string, ReadingTile>();
    let identityError: string | undefined;
    for (const word of input.words)
        word.orderedTileIds.forEach((id, index) => {
            const cell = word.shape.cells[index];
            const text = input.tiles[id]?.letter ?? word.tileTexts[index];
            const existing = positions.get(id);
            if (existing && cell && (existing.row !== cell.row || existing.col !== cell.col || existing.text !== text))
                identityError = 'conflicting-tile-identity';
            if (cell && text)
                positions.set(id, { ...cell, id, text, isNew: false });
        });
    for (const placement of input.transientPlacements) {
        const tile = input.tiles[placement.tileId];
        if (tile)
            positions.set(tile.id, { ...placement.pos, id: tile.id, text: tile.letter, isNew: true });
    }
    const graph = buildReadingGraph([...positions.values()], input.words.map((word) => ({ id: word.id, text: word.text, tileIds: word.orderedTileIds })));
    if (identityError)
        graph.error = identityError;
    const walk = walkReadingGraph(graph, { scope: input.scope });
    const ports = input.words.flatMap((word) => deriveWordFrontier(word).ports);
    const read = (path: WalkPath) => {
        const nodes = path.tileIds.map((id) => graph.nodes.get(id)!);
        const cells = nodes.map(({ row, col }) => ({ row, col }));
        const text = nodes.map((node) => node.text).join('');
        const steps: SurfFixTraceStep[] = [];
        let endpointSideTurn = false;
        let requiresAcceptedConsumption = false;
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i], before = nodes[i - 1], after = nodes[i + 1];
            if (node.isNew)
                continue;
            const neighbor = before ?? after;
            if (!neighbor)
                continue;
            const nextNew = i === 0 ? nodes[2] : i === nodes.length - 1 ? nodes.at(-3) : undefined;
            if ((i === 0 || i === nodes.length - 1) && neighbor.isNew && nextNew
                && node.memberships.every((owner) => owner.length > 1 && (owner.index === 0 || owner.index === owner.length - 1))
                && (node.row === neighbor.row) !== (neighbor.row === nextNew.row))
                endpointSideTurn = true;
            for (const owner of node.memberships) {
                const wordBefore = graph.nodes.get(owner.before ?? ''), wordAfter = graph.nodes.get(owner.after ?? '');
                const wordNeighbor = wordBefore ?? wordAfter;
                if (!wordNeighbor || owner.bend)
                    continue;
                const perpendicular = (wordNeighbor.row === node.row) !== (neighbor.row === node.row);
                if (!perpendicular)
                    continue;
                const endpoint = !before || !after;
                if (endpoint && (!wordBefore || !wordAfter))
                    continue;
                if (endpoint && node.text !== '-')
                    requiresAcceptedConsumption = true;
                steps.push({ kind: endpoint ? 'shared-interior-endpoint' : 'straight-through-interior-bridge',
                    wordId: owner.wordId, wordText: owner.word, tileIndex: owner.index, tileId: node.id, bridgeCell: cells[i],
                    entryCell: before ? cells[i - 1] : { row: 2 * node.row - after.row, col: 2 * node.col - after.col },
                    exitCell: after ? cells[i + 1] : { row: 2 * node.row - before.row, col: 2 * node.col - before.col } });
            }
        }
        for (let i = 0; i < nodes.length - 1; i++) {
            const a = nodes[i], b = nodes[i + 1];
            if (a.isNew && b.isNew) {
                steps.push({ kind: 'loose-adjacency', fromTileId: a.id, toTileId: b.id, fromCell: cells[i], toCell: cells[i + 1] });
                continue;
            }
            if (!a.isNew && !b.isNew)
                continue;
            const anchor = a.isNew ? b : a, neighbor = a.isNew ? a : b;
            const contactPorts = ports.filter((port) => port.anchorCell.row === anchor.row && port.anchorCell.col === anchor.col
                && port.neighborCell.row === neighbor.row && port.neighborCell.col === neighbor.col);
            for (const port of contactPorts) {
                if (port.effect !== 'invalidate' && !((port.affordance === 'start-border' || port.affordance === 'end-border')
                    && contactPorts.some((other) => other.wordId === port.wordId && (other.affordance === 'pre' || other.affordance === 'post')))) {
                    steps.push(surfFixTraceStepFromPort(port, [neighbor]));
                }
            }
        }
        const structuralSteps = steps.filter((step) => step.kind !== 'loose-adjacency');
        const contactOnlyWordIds = nodes.flatMap((node, i) => {
            const neighbor = i === 0 ? nodes[1] : i === nodes.length - 1 ? nodes.at(-2) : undefined;
            const inner = i === 0 ? nodes[2] : i === nodes.length - 1 ? nodes.at(-3) : undefined;
            return neighbor && inner && (node.row === neighbor.row) !== (neighbor.row === inner.row)
                ? node.memberships.filter((owner) => owner.length === 1).map((owner) => owner.wordId) : [];
        });
        return { ...path, text, cells, endpointSideTurn, requiresAcceptedConsumption,
            contactOnlyWordIds,
            letters: nodes.map((node) => node.text), looseTileIds: nodes.filter((node) => node.isNew).map((node) => node.id),
            trace: buildSurfFixReadTrace({ text, cells, tileIds: path.tileIds, steps: structuralSteps.length ? structuralSteps : steps }) };
    };
    return { graph, walk, reads: walk.paths.map(read) };
}
