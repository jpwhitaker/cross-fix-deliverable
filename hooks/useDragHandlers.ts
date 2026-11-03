'use client';
import { useRef, useCallback, useMemo } from 'react';
import type { RefObject, MutableRefObject } from 'react';
import { useSensor, useSensors, PointerSensor, type DragStartEvent, type DragEndEvent, type DragMoveEvent, type ClientRect, } from '@dnd-kit/core';
import type { Transform } from '@dnd-kit/utilities';
import useSound from 'use-sound';
import { useGameStore, selectHand } from '@/lib/game-store';
import type { BoardCell, HandTile } from '@/lib/game-store';
import { useUIStore, selectLeftTool, type FloatGroupMember } from '@/lib/ui-store';
import { positionKey, snapshotBaselineNeighbors, buildBatchMoveContext, evaluateMove, type CellKey, type BatchMove, type EvaluationResult, } from '@/lib/modes/move-policy';
import { getProjectedFloatMembers } from '@/lib/predicates/float/getFloatProjection';
import type { BoardHandle } from '@/components/Board';
import type { DockHandle } from '@/components/Dock';
import { LETTER_VALUES, type Letter } from '@/lib/tiles';
import { getMode } from '@/lib/modes/registry';
import type { GameModeId } from '@/lib/modes/types';
import { canChooseWildcardLetters, canExchangeEquivalentTiles, shouldValidateHandPlacementWithMovePolicy } from '@/lib/modes/ui-capabilities';
import { getActiveSwitchLetter } from '@/lib/predicates/tiles/switch-equivalence';
import { canRegularTileReclaimEquivalent } from '@/lib/predicates/tiles/equivalent-reclaim';
import { getHandWildcardRepresentedLetter } from '@/lib/predicates/tiles/wildcard-choice';
import { dockCollisionDetection, isDockReturnZone } from '@/lib/dock-drop-targets';
export type ActiveDrag = {
    source: 'hand';
    tileId: string;
} | {
    source: 'board';
    row: number;
    col: number;
    cell: BoardCell;
} | {
    source: 'board-group';
    isFloat: boolean;
    anchorRow: number;
    anchorCol: number;
    buttonOffsetRow: number;
    buttonOffsetCol: number;
    cell: BoardCell;
    members: Array<{
        tileId: string;
        row: number;
        col: number;
        fromRow: number;
        fromCol: number;
        cell: Exclude<BoardCell, {
            kind: 'empty';
        }>;
    }>;
} | {
    source: 'pick-drawer';
    letter: Letter;
} | {
    source: 'double-drawer';
    tileId: string;
} | {
    source: 'surfboard-drawer';
};
const OVERLAY_TILE = 44;
type BoardGroupDrag = Extract<ActiveDrag, {
    source: 'board-group';
}>;
type BoardTileDragData = {
    row: number;
    col: number;
    cell: BoardCell;
};
type UiStoreState = ReturnType<typeof useUIStore.getState>;
type BoardDropTarget = {
    row: number;
    col: number;
};
type BoardDragOrigin = {
    fromRow: number;
    fromCol: number;
};
type TargetCellResolver = () => BoardDropTarget | null;
type BoardTileSwapAction = (row: number, col: number, handTileId: string) => 'ok' | 'blocked';
type HandTileBoardDropAction = 'reclaim-switch' | 'reclaim-wildcard' | 'place-switch-over-regular' | 'swap-pick-with-regular' | 'place';
function showMoveRejection(message: string | undefined): void {
    if (message)
        useGameStore.setState({ toastMessage: message, toastTheme: 'default' });
}
function isDockDropTarget(overId: string, hand: readonly HandTile[]): boolean {
    return overId === 'dock-zone' || hand.some((t) => t.id === overId);
}
function handIdSet(hand: readonly HandTile[]): Set<string> {
    return new Set(hand.map((t) => t.id));
}
function findNewHandTile(previousIds: ReadonlySet<string>): HandTile | undefined {
    return useGameStore.getState().hand.find((t) => !previousIds.has(t.id));
}
function dragEndCenter(event: DragEndEvent): {
    x: number;
    y: number;
} | null {
    const rect = event.active.rect.current.translated;
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
}
function parseBoardDragOrigin(activeId: string): BoardDragOrigin | null {
    if (!activeId.startsWith('board-'))
        return null;
    const [, row, col] = activeId.split('-');
    return { fromRow: parseInt(row, 10), fromCol: parseInt(col, 10) };
}
function pickTopLeftMember<T extends {
    row: number;
    col: number;
}>(members: T[]): T | null {
    if (members.length === 0)
        return null;
    let best = members[0];
    for (let i = 1; i < members.length; i++) {
        const m = members[i];
        if (m.row < best.row || (m.row === best.row && m.col < best.col))
            best = m;
    }
    return best;
}
function isDrawerSourceDrag(activeId: string): boolean {
    return (activeId.startsWith('pick-drawer-') ||
        activeId.startsWith('double-drawer-'));
}
function shouldSuppressBoardPreviewForDrawer(activeId: string, pickDrawerOpen: boolean, viewportWidth: number): boolean {
    return viewportWidth < 640 && pickDrawerOpen && !isDrawerSourceDrag(activeId);
}
function boardSwitchLetter(cell: Extract<BoardCell, {
    kind: 'switch';
}>): Letter {
    return getActiveSwitchLetter(cell);
}
function handSwitchLetter(tile: Extract<HandTile, {
    kind: 'switch';
}>): Letter {
    return (tile.activeSide === 'A' ? tile.sideA : tile.sideB).letter;
}
function isUnsubmittedPickOccupant(occupant: BoardCell | undefined, submittedPositions: ReadonlySet<string> | null | undefined, target: BoardDropTarget): boolean {
    return (occupant?.kind === 'regular' &&
        occupant.origin === 'placed' &&
        !!occupant.isPickTile &&
        !submittedPositions?.has(positionKey(target.row, target.col)));
}
function isMatchingSwitchOccupant(occupant: BoardCell | undefined, handTile: HandTile): boolean {
    return (occupant?.kind === 'switch' &&
        occupant.origin === 'placed' &&
        canRegularTileReclaimEquivalent(handTile, boardSwitchLetter(occupant)));
}
function isMatchingWildcardOccupant(occupant: BoardCell | undefined, handTile: HandTile): boolean {
    return (occupant?.kind === 'wildcard' &&
        occupant.origin === 'placed' &&
        occupant.representsLetter !== undefined &&
        canRegularTileReclaimEquivalent(handTile, occupant.representsLetter));
}
function isRegularOccupantForSwitch(occupant: BoardCell | undefined, handTile: HandTile): boolean {
    return (occupant?.kind === 'regular' &&
        occupant.origin === 'placed' &&
        !occupant.isPickTile &&
        handTile.kind === 'switch' &&
        handSwitchLetter(handTile) === occupant.letter);
}
function classifyHandTileBoardDrop(occupant: BoardCell | undefined, handTile: HandTile, submittedPositions: ReadonlySet<string> | null | undefined, target: BoardDropTarget): HandTileBoardDropAction {
    if (isMatchingSwitchOccupant(occupant, handTile))
        return 'reclaim-switch';
    if (isMatchingWildcardOccupant(occupant, handTile))
        return 'reclaim-wildcard';
    if (isRegularOccupantForSwitch(occupant, handTile))
        return 'place-switch-over-regular';
    if (isUnsubmittedPickOccupant(occupant, submittedPositions, target))
        return 'swap-pick-with-regular';
    return 'place';
}
function canHoverRegularOverSwitch(activeId: string, cell: Extract<BoardCell, {
    kind: 'switch';
}>, hand: readonly HandTile[], modeId: GameModeId): boolean {
    const handTile = hand.find((t) => t.id === activeId);
    return (canExchangeEquivalentTiles(modeId) &&
        canRegularTileReclaimEquivalent(handTile, boardSwitchLetter(cell)));
}
function canHoverRegularOverWildcard(activeId: string, cell: Extract<BoardCell, {
    kind: 'wildcard';
}>, hand: readonly HandTile[]): boolean {
    const handTile = hand.find((t) => t.id === activeId);
    return (cell.representsLetter !== undefined &&
        canRegularTileReclaimEquivalent(handTile, cell.representsLetter));
}
function canHoverSwitchOverRegular(activeId: string, cell: Extract<BoardCell, {
    kind: 'regular';
}>, hand: readonly HandTile[], modeId: GameModeId): boolean {
    const handTile = hand.find((t) => t.id === activeId);
    return (canExchangeEquivalentTiles(modeId) &&
        handTile?.kind === 'switch' &&
        handSwitchLetter(handTile) === cell.letter);
}
export function useDragHandlers({ boardRef, dockRef, activeDrag, setActiveDrag, pickDrawerOpen, syncRotateButtonPosition, syncRotateButtonToViewport, collectSelectedMembers, validateProjectedBatchMove, dragAnchorPosRef, triggerSwapOverlay, }: {
    boardRef: RefObject<BoardHandle | null>;
    dockRef: RefObject<DockHandle | null>;
    activeDrag: ActiveDrag | null;
    setActiveDrag: (drag: ActiveDrag | null) => void;
    pickDrawerOpen: boolean;
    syncRotateButtonPosition: (pos?: {
        row: number;
        col: number;
    } | null) => void;
    syncRotateButtonToViewport: (anchorX: number, anchorY: number, tileSize: number) => void;
    collectSelectedMembers: (selected: Set<string>) => FloatGroupMember[];
    validateProjectedBatchMove: (moves: BatchMove[], baselineNeighbors?: Map<CellKey, Set<CellKey>> | null) => EvaluationResult;
    dragAnchorPosRef: MutableRefObject<{
        row: number;
        col: number;
    } | null>;
    triggerSwapOverlay: (letter: Letter, row: number, col: number, rect: {
        left: number;
        top: number;
        width: number;
    } | null) => void;
}) {
    const activeDragRef = useRef<ActiveDrag | null>(null);
    const groupDragMetricsRef = useRef<{
        anchorX: number;
        anchorY: number;
        baseDelta: {
            x: number;
            y: number;
        } | null;
        minRow: number;
        minCol: number;
        sourceKeys: Set<string>;
    } | null>(null);
    const baselineNeighborsRef = useRef<Map<CellKey, Set<CellKey>> | null>(null);
    const hand = useGameStore(selectHand);
    const leftTool = useUIStore(selectLeftTool);
    const boardRows = useGameStore((s) => s.board.length);
    const boardCols = useGameStore((s) => s.board[0]?.length ?? 0);
    const placeTile = useGameStore((s) => s.placeTile);
    const moveTile = useGameStore((s) => s.moveTile);
    const moveTilesBatch = useGameStore((s) => s.moveTilesBatch);
    const returnTileToHand = useGameStore((s) => s.returnTileToHand);
    const addPickTile = useGameStore((s) => s.addPickTile);
    const swapBoardTileWithPick = useGameStore((s) => s.swapBoardTileWithPick);
    const swapPickTileWithRegular = useGameStore((s) => s.swapPickTileWithRegular);
    const reclaimSwitchTile = useGameStore((s) => s.reclaimSwitchTile);
    const reclaimWildcardTile = useGameStore((s) => s.reclaimWildcardTile);
    const placeHandSwitchOverRegular = useGameStore((s) => s.placeHandSwitchOverRegular);
    const returnTileToSupply = useGameStore((s) => s.returnTileToSupply);
    const addDoubleTile = useGameStore((s) => s.addDoubleTile);
    const addSurfboardTile = useGameStore((s) => s.addSurfboardTile);
    const [playPickUp] = useSound('/sounds/pop_up.mp3');
    const [playPlace] = useSound('/sounds/pop_down.wav');
    const projectGroupMove = useCallback((drag: Extract<ActiveDrag, {
        source: 'board-group';
    }>, targetRow: number, targetCol: number) => {
        const dRow = targetRow - drag.anchorRow;
        const dCol = targetCol - drag.anchorCol;
        const moves = drag.members.map((m) => ({
            fromRow: m.fromRow,
            fromCol: m.fromCol,
            toRow: m.row + dRow,
            toCol: m.col + dCol,
        }));
        const sourceKeys = groupDragMetricsRef.current?.sourceKeys
            ?? new Set(drag.members.map((m) => `${m.fromRow}-${m.fromCol}`));
        const { board } = useGameStore.getState();
        for (const move of moves) {
            if (move.toRow < 0 || move.toRow >= boardRows || move.toCol < 0 || move.toCol >= boardCols)
                return { valid: false, moves };
            const toCell = board[move.toRow]?.[move.toCol];
            if (!toCell)
                return { valid: false, moves };
            if (toCell.kind !== 'empty' && !sourceKeys.has(positionKey(move.toRow, move.toCol)))
                return { valid: false, moves };
        }
        const validation = validateProjectedBatchMove(moves, baselineNeighborsRef.current);
        return { valid: validation.ok, moves, message: validation.message };
    }, [boardRows, boardCols, validateProjectedBatchMove]);
    const validateHandPlacementPreview = useCallback((row: number, col: number, previewCell: Exclude<BoardCell, {
        kind: 'empty';
    }>): EvaluationResult => {
        const { board, submittedPositions, submittedBentWordPositions, modeId, playedWords, chainWords } = useGameStore.getState();
        const context = buildBatchMoveContext(board, submittedPositions, playedWords.map((entry) => entry.word), [{ fromRow: -1, fromCol: -1, toRow: row, toCol: col }], null, submittedBentWordPositions, chainWords);
        const nextBoard = context.nextBoard.map((boardRow) => boardRow.slice());
        if (!nextBoard[row] || nextBoard[row][col]?.kind !== 'empty')
            return { ok: false };
        nextBoard[row][col] = previewCell;
        if (!shouldValidateHandPlacementWithMovePolicy(modeId))
            return { ok: true };
        return evaluateMove(getMode(modeId).validateBatchMove, { ...context, nextBoard });
    }, []);
    const previewBoardCellForHandTile = useCallback((tile: NonNullable<typeof hand[number]>): Exclude<BoardCell, {
        kind: 'empty';
    }> => {
        if (tile.kind === 'regular') {
            const { modeId, wildcardMustBeUsedAsXRound, round } = useGameStore.getState();
            const representsLetter = getHandWildcardRepresentedLetter({
                tile,
                modeAllowsWildcardLetters: canChooseWildcardLetters(modeId),
                forceUseXActive: wildcardMustBeUsedAsXRound === round,
            });
            if (representsLetter) {
                return {
                    kind: 'wildcard',
                    representsLetter,
                    origin: 'placed',
                    handTileId: tile.id,
                };
            }
            return {
                kind: 'regular',
                letter: tile.letter,
                value: tile.value,
                isPickTile: tile.isPickTile || undefined,
                origin: 'placed',
                handTileId: tile.id,
            };
        }
        if (tile.kind === 'double') {
            return {
                kind: 'double',
                id: tile.tileId,
                letters: tile.letters,
                value: tile.value,
                origin: 'placed',
                handTileId: tile.id,
            };
        }
        if (tile.kind === 'surfboard') {
            return {
                kind: 'surfboard',
                tileId: tile.tileId,
                origin: 'placed',
                handTileId: tile.id,
            };
        }
        return {
            kind: 'switch',
            id: tile.tileId,
            sideA: tile.sideA,
            sideB: tile.sideB,
            activeSide: tile.activeSide,
            origin: 'placed',
            handTileId: tile.id,
        };
    }, []);
    const getGroupAnchorViewportPoint = useCallback((delta: {
        x: number;
        y: number;
    }) => {
        const metrics = groupDragMetricsRef.current;
        if (!metrics)
            return null;
        if (!metrics.baseDelta)
            metrics.baseDelta = { x: delta.x, y: delta.y };
        return {
            x: metrics.anchorX + (delta.x - metrics.baseDelta.x),
            y: metrics.anchorY + (delta.y - metrics.baseDelta.y),
        };
    }, []);
    const universalModifier = useCallback(({ activatorEvent, transform, activeNodeRect, draggingNodeRect, }: {
        activatorEvent: Event | null;
        transform: Transform;
        activeNodeRect: ClientRect | null;
        draggingNodeRect: ClientRect | null;
        [key: string]: unknown;
    }): Transform => {
        if (!activeNodeRect || !activatorEvent)
            return transform;
        const event = activatorEvent as PointerEvent;
        const drag = activeDragRef.current;
        if (drag?.source === 'board-group') {
            const minCol = groupDragMetricsRef.current?.minCol ?? Math.min(...drag.members.map((m) => m.col));
            const minRow = groupDragMetricsRef.current?.minRow ?? Math.min(...drag.members.map((m) => m.row));
            const boardScale = boardRef.current?.getTransform().scale ?? 1;
            return {
                ...transform,
                x: event.clientX + transform.x - activeNodeRect.left - (drag.anchorCol - minCol + 0.5) * OVERLAY_TILE * boardScale,
                y: event.clientY + transform.y - activeNodeRect.top - (drag.anchorRow - minRow + 0.5) * OVERLAY_TILE * boardScale,
            };
        }
        const w = draggingNodeRect?.width ?? activeNodeRect.width;
        const h = draggingNodeRect?.height ?? activeNodeRect.height;
        return {
            ...transform,
            x: event.clientX + transform.x - activeNodeRect.left - w / 2,
            y: event.clientY + transform.y - activeNodeRect.top - h / 2,
        };
    }, [boardRef]);
    const buildFloatGroupDrag = useCallback((ui: UiStoreState, grabbedTileId?: string): BoardGroupDrag | null => {
        if (leftTool !== 'move' || !ui.floatGroup)
            return null;
        const projected = getProjectedFloatMembers(ui.floatGroup);
        const live = collectSelectedMembers(ui.selectedTileIds);
        const liveById = new Map(live.map((m) => [m.tileId, m] as const));
        const members = projected
            .map((m) => {
            const from = liveById.get(m.tileId);
            if (!from)
                return null;
            return { tileId: m.tileId, row: m.row, col: m.col, fromRow: from.row, fromCol: from.col, cell: from.cell };
        })
            .filter((m): m is NonNullable<typeof m> => !!m);
        if (members.length === 0)
            return null;
        const buttonAnchor = pickTopLeftMember(members);
        const dragAnchor = grabbedTileId ? members.find((m) => m.tileId === grabbedTileId) : buttonAnchor;
        if (!buttonAnchor || !dragAnchor)
            return null;
        return {
            source: 'board-group',
            isFloat: true,
            anchorRow: dragAnchor.row,
            anchorCol: dragAnchor.col,
            buttonOffsetRow: buttonAnchor.row - dragAnchor.row,
            buttonOffsetCol: buttonAnchor.col - dragAnchor.col,
            cell: dragAnchor.cell,
            members,
        };
    }, [collectSelectedMembers, leftTool]);
    const collectBoardGroupDragMembers = useCallback((selectedTileIds: ReadonlySet<string>): BoardGroupDrag['members'] => {
        const { board } = useGameStore.getState();
        const members: BoardGroupDrag['members'] = [];
        for (let r = 0; r < board.length; r++) {
            for (let c = 0; c < board[r].length; c++) {
                const cell = board[r][c];
                if (cell.kind === 'empty')
                    continue;
                if (!cell.handTileId || !selectedTileIds.has(cell.handTileId))
                    continue;
                if ('origin' in cell && cell.origin !== 'placed')
                    continue;
                members.push({ tileId: cell.handTileId, row: r, col: c, fromRow: r, fromCol: c, cell });
            }
        }
        return members;
    }, []);
    const buildSelectedBoardGroupDrag = useCallback((data: BoardTileDragData, selectedTileIds: ReadonlySet<string>): BoardGroupDrag | null => {
        const members = collectBoardGroupDragMembers(selectedTileIds);
        const anchorTileId = data.cell.kind === 'empty' ? undefined : data.cell.handTileId;
        if (!anchorTileId || !members.some((m) => m.tileId === anchorTileId))
            return null;
        const buttonAnchor = pickTopLeftMember(members);
        const dragAnchor = members.find((m) => m.tileId === anchorTileId);
        return {
            source: 'board-group',
            isFloat: false,
            anchorRow: data.row,
            anchorCol: data.col,
            buttonOffsetRow: (buttonAnchor?.row ?? data.row) - (dragAnchor?.row ?? data.row),
            buttonOffsetCol: (buttonAnchor?.col ?? data.col) - (dragAnchor?.col ?? data.col),
            cell: data.cell,
            members,
        };
    }, [collectBoardGroupDragMembers]);
    const resolveBoardDragStart = useCallback((event: DragStartEvent, ui: UiStoreState): ActiveDrag => {
        const data = event.active.data.current as BoardTileDragData;
        if (leftTool !== 'move')
            return { source: 'board', row: data.row, col: data.col, cell: data.cell };
        return (buildFloatGroupDrag(ui) ??
            buildSelectedBoardGroupDrag(data, ui.selectedTileIds) ??
            { source: 'board', row: data.row, col: data.col, cell: data.cell });
    }, [buildFloatGroupDrag, buildSelectedBoardGroupDrag, leftTool]);
    const resolveDragStart = useCallback((event: DragStartEvent): ActiveDrag | null => {
        const id = event.active.id as string;
        const ui = useUIStore.getState();
        if (id.startsWith('float-'))
            return buildFloatGroupDrag(ui, id.slice('float-'.length));
        if (id.startsWith('board-'))
            return resolveBoardDragStart(event, ui);
        if (id.startsWith('pick-drawer-')) {
            return { source: 'pick-drawer', letter: (event.active.data.current as {
                    letter: Letter;
                }).letter };
        }
        if (id.startsWith('double-drawer-')) {
            return { source: 'double-drawer', tileId: (event.active.data.current as {
                    tileId: string;
                }).tileId };
        }
        if (id === 'surfboard-drawer')
            return { source: 'surfboard-drawer' };
        return { source: 'hand', tileId: id };
    }, [buildFloatGroupDrag, resolveBoardDragStart]);
    const syncDragStartState = useCallback((newDrag: ActiveDrag) => {
        if (newDrag.source === 'board-group') {
            boardRef.current?.clearHoverCell();
            const { submittedPositions } = useGameStore.getState();
            const movingFromKeys = new Set(newDrag.members.map((m) => positionKey(m.fromRow, m.fromCol)));
            baselineNeighborsRef.current = snapshotBaselineNeighbors(submittedPositions, movingFromKeys);
            const anchorRect = boardRef.current?.cellRectAt(newDrag.anchorRow, newDrag.anchorCol);
            const minRow = Math.min(...newDrag.members.map((m) => m.row));
            const minCol = Math.min(...newDrag.members.map((m) => m.col));
            groupDragMetricsRef.current = anchorRect
                ? {
                    anchorX: anchorRect.left + anchorRect.width / 2,
                    anchorY: anchorRect.top + anchorRect.height / 2,
                    baseDelta: null,
                    minRow,
                    minCol,
                    sourceKeys: new Set(newDrag.members.map((m) => `${m.fromRow}-${m.fromCol}`)),
                }
                : null;
            dragAnchorPosRef.current = {
                row: newDrag.anchorRow + newDrag.buttonOffsetRow,
                col: newDrag.anchorCol + newDrag.buttonOffsetCol,
            };
            syncRotateButtonPosition(dragAnchorPosRef.current);
        }
        else {
            baselineNeighborsRef.current = null;
            groupDragMetricsRef.current = null;
            dragAnchorPosRef.current = null;
            syncRotateButtonPosition();
        }
    }, [boardRef, dragAnchorPosRef, syncRotateButtonPosition]);
    const handleDragStart = useCallback((event: DragStartEvent) => {
        const newDrag = resolveDragStart(event);
        if (!newDrag)
            return;
        syncDragStartState(newDrag);
        activeDragRef.current = newDrag;
        setActiveDrag(newDrag);
        playPickUp();
    }, [playPickUp, resolveDragStart, setActiveDrag, syncDragStartState]);
    const syncBoardGroupButtonFromDelta = useCallback((delta: {
        x: number;
        y: number;
    }) => {
        const drag = activeDragRef.current;
        if (drag?.source !== 'board-group')
            return;
        const anchorPoint = getGroupAnchorViewportPoint(delta);
        const scale = boardRef.current?.getTransform().scale ?? 1;
        if (!anchorPoint)
            return;
        syncRotateButtonToViewport(anchorPoint.x + drag.buttonOffsetCol * OVERLAY_TILE * scale, anchorPoint.y + drag.buttonOffsetRow * OVERLAY_TILE * scale, OVERLAY_TILE * scale);
    }, [boardRef, getGroupAnchorViewportPoint, syncRotateButtonToViewport]);
    const handleDrawerReturnHover = useCallback((event: DragMoveEvent, overId: string | undefined): boolean => {
        if (!isDockReturnZone(overId))
            return false;
        boardRef.current?.clearHoverCell();
        dockRef.current?.setDragHover(null);
        syncBoardGroupButtonFromDelta(event.delta);
        return true;
    }, [boardRef, dockRef, syncBoardGroupButtonFromDelta]);
    const handleDockHover = useCallback((event: DragMoveEvent, activeId: string, overId: string | undefined, rect: ClientRect | null): boolean => {
        if (!isDockDropTarget(overId ?? '', hand))
            return false;
        boardRef.current?.clearHoverCell();
        if (activeDragRef.current?.source === 'board-group') {
            syncBoardGroupButtonFromDelta(event.delta);
            dockRef.current?.setDragHover(null);
            return true;
        }
        if (rect && dockRef.current) {
            dockRef.current.setDragHover(activeId, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
        return true;
    }, [boardRef, dockRef, hand, syncBoardGroupButtonFromDelta]);
    const handleBoardGroupHover = useCallback((event: DragMoveEvent, drag: Extract<ActiveDrag, {
        source: 'board-group';
    }>) => {
        const boardApi = boardRef.current;
        if (!boardApi)
            return;
        const anchorPoint = getGroupAnchorViewportPoint(event.delta);
        if (!anchorPoint) {
            boardApi.clearHoverCell();
            return;
        }
        const anchorHit = boardApi.cellAtPair(anchorPoint.x, anchorPoint.y);
        const anchorUnclamped = boardApi.cellAtUnclamped(anchorPoint.x, anchorPoint.y);
        const anchorTarget = drag.isFloat && anchorUnclamped ? anchorUnclamped : anchorHit.clamped;
        dragAnchorPosRef.current = {
            row: anchorTarget.row + drag.buttonOffsetRow,
            col: anchorTarget.col + drag.buttonOffsetCol,
        };
        const scale = boardApi.getTransform().scale;
        syncRotateButtonToViewport(anchorPoint.x + drag.buttonOffsetCol * OVERLAY_TILE * scale, anchorPoint.y + drag.buttonOffsetRow * OVERLAY_TILE * scale, OVERLAY_TILE * scale);
        const rawProjection = projectGroupMove(drag, anchorTarget.row, anchorTarget.col);
        const projection = drag.isFloat || anchorHit.logical !== null ? rawProjection : { ...rawProjection, valid: false };
        const bRows = useGameStore.getState().board.length;
        const bCols = useGameStore.getState().board[0]?.length ?? 0;
        const cells = projection.moves
            .filter((m) => m.toRow >= 0 && m.toRow < bRows && m.toCol >= 0 && m.toCol < bCols)
            .map((m) => ({ row: m.toRow, col: m.toCol, valid: projection.valid }));
        if (cells.length > 0)
            boardApi.setHoverCells(cells);
        else
            boardApi.clearHoverCell();
    }, [
        boardRef,
        dragAnchorPosRef,
        getGroupAnchorViewportPoint,
        projectGroupMove,
        syncRotateButtonToViewport,
    ]);
    const canShowSwitchSwapHover = useCallback((activeId: string, cell: BoardCell | undefined, result: EvaluationResult): boolean => {
        if (!result.ok)
            return false;
        const { modeId } = useGameStore.getState();
        if (cell?.kind === 'switch' && cell.origin === 'placed') {
            return canHoverRegularOverSwitch(activeId, cell, hand, modeId);
        }
        if (cell?.kind === 'wildcard' && cell.origin === 'placed') {
            return canHoverRegularOverWildcard(activeId, cell, hand);
        }
        if (cell?.kind === 'regular' && cell.origin === 'placed' && !cell.isPickTile) {
            return canHoverSwitchOverRegular(activeId, cell, hand, modeId);
        }
        return false;
    }, [hand]);
    const handleSingleTileHover = useCallback((event: DragMoveEvent, activeId: string, rect: ClientRect | null, drag: ActiveDrag | null) => {
        const boardApi = boardRef.current;
        if (!boardApi)
            return;
        if (!rect) {
            boardApi.clearHoverCell();
            return;
        }
        const target = boardApi.cellAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
        if (!target) {
            boardApi.clearHoverCell();
            return;
        }
        const { board } = useGameStore.getState();
        const cell = board[target.row]?.[target.col];
        const isDragOrigin = activeId === `board-${target.row}-${target.col}`;
        const singleMove: BatchMove = drag?.source === 'board'
            ? { fromRow: drag.row, fromCol: drag.col, toRow: target.row, toCol: target.col }
            : { fromRow: -1, fromCol: -1, toRow: target.row, toCol: target.col };
        const result = validateProjectedBatchMove([singleMove], null);
        const isSwitchSwapHover = canShowSwitchSwapHover(activeId, cell, result);
        if ((isDragOrigin || !cell || cell.kind === 'empty' || isSwitchSwapHover) && result.ok) {
            boardApi.setHoverCell(target.row, target.col);
        }
        else {
            boardApi.clearHoverCell();
        }
    }, [boardRef, canShowSwitchSwapHover, validateProjectedBatchMove]);
    const handleDragMove = useCallback((event: DragMoveEvent) => {
        const activeIdStr = event.active.id as string;
        const rect = event.active.rect.current.translated;
        const overId = event.over?.id as string | undefined;
        if (handleDrawerReturnHover(event, overId))
            return;
        if (handleDockHover(event, activeIdStr, overId, rect))
            return;
        dockRef.current?.setDragHover(null);
        if (shouldSuppressBoardPreviewForDrawer(activeIdStr, pickDrawerOpen, window.innerWidth)) {
            boardRef.current?.clearHoverCell();
            return;
        }
        const drag = activeDragRef.current;
        if (drag?.source === 'board-group') {
            handleBoardGroupHover(event, drag);
            return;
        }
        handleSingleTileHover(event, activeIdStr, rect, drag);
    }, [
        boardRef,
        dockRef,
        handleBoardGroupHover,
        handleDockHover,
        handleDrawerReturnHover,
        handleSingleTileHover,
        pickDrawerOpen,
    ]);
    const dropNewHandTileIntoDock = useCallback((previousHandIds: ReadonlySet<string>, event: DragEndEvent) => {
        const center = dragEndCenter(event);
        const newTile = findNewHandTile(previousHandIds);
        if (center && newTile)
            dockRef.current?.handleTileDrop(newTile.id, center.x, center.y);
    }, [dockRef]);
    const addDrawerTileToDock = useCallback((event: DragEndEvent, addTile: () => unknown) => {
        playPlace();
        const previousHandIds = handIdSet(hand);
        addTile();
        dropNewHandTileIntoDock(previousHandIds, event);
    }, [dropNewHandTileIntoDock, hand, playPlace]);
    const addDrawerTileToBoard = useCallback((target: BoardDropTarget, addTile: () => unknown) => {
        playPlace();
        const previousHandIds = handIdSet(hand);
        addTile();
        const newTile = findNewHandTile(previousHandIds);
        if (newTile)
            placeTile(target.row, target.col, newTile.id);
    }, [hand, placeTile, playPlace]);
    const handlePickDrawerDrop = useCallback((event: DragEndEvent, overId: string, getTargetCell: TargetCellResolver) => {
        const data = event.active.data.current as {
            letter: Letter;
        };
        if (isDockDropTarget(overId, hand)) {
            addDrawerTileToDock(event, () => addPickTile(data.letter));
            return;
        }
        if (overId !== 'board-zone')
            return;
        const target = getTargetCell();
        if (!target)
            return;
        const { board, submittedPositions } = useGameStore.getState();
        const occupant = board[target.row]?.[target.col];
        const posKey = `${target.row}-${target.col}`;
        const isSubmittedTarget = submittedPositions?.has(posKey);
        const isSwappable = (occupant?.kind === 'regular' &&
            occupant.origin === 'placed' &&
            !occupant.isPickTile &&
            !isSubmittedTarget &&
            occupant.letter === data.letter);
        if (isSwappable) {
            playPlace();
            swapBoardTileWithPick(target.row, target.col, data.letter);
            const cellRect = boardRef.current?.cellRect(target.row, target.col);
            const dropRect = event.active.rect.current.translated;
            triggerSwapOverlay(data.letter, target.row, target.col, cellRect ?? dropRect);
            return;
        }
        const previewCell: Exclude<BoardCell, {
            kind: 'empty';
        }> = {
            kind: 'regular',
            letter: data.letter,
            value: LETTER_VALUES[data.letter],
            isPickTile: true,
            origin: 'placed',
            handTileId: `preview-pick:${data.letter}:${target.row},${target.col}`,
        };
        if (validateHandPlacementPreview(target.row, target.col, previewCell).ok) {
            addDrawerTileToBoard(target, () => addPickTile(data.letter));
        }
    }, [
        addDrawerTileToBoard,
        addDrawerTileToDock,
        addPickTile,
        boardRef,
        hand,
        playPlace,
        swapBoardTileWithPick,
        triggerSwapOverlay,
        validateHandPlacementPreview,
    ]);
    const handleDoubleDrawerDrop = useCallback((event: DragEndEvent, overId: string, getTargetCell: TargetCellResolver) => {
        const data = event.active.data.current as {
            tileId: string;
        };
        if (isDockDropTarget(overId, hand)) {
            addDrawerTileToDock(event, () => addDoubleTile(data.tileId));
            return;
        }
        if (overId !== 'board-zone')
            return;
        const target = getTargetCell();
        if (!target)
            return;
        const previewCell: Exclude<BoardCell, {
            kind: 'empty';
        }> = {
            kind: 'double',
            id: data.tileId,
            letters: data.tileId.split('') as [
                Letter,
                Letter
            ],
            value: LETTER_VALUES[data.tileId[0] as Letter] + LETTER_VALUES[data.tileId[1] as Letter],
            origin: 'placed',
            handTileId: `preview-double:${data.tileId}:${target.row},${target.col}`,
        };
        if (validateHandPlacementPreview(target.row, target.col, previewCell).ok) {
            addDrawerTileToBoard(target, () => addDoubleTile(data.tileId));
        }
    }, [
        addDoubleTile,
        addDrawerTileToBoard,
        addDrawerTileToDock,
        hand,
        validateHandPlacementPreview,
    ]);
    const handleSurfboardDrawerDrop = useCallback((event: DragEndEvent, overId: string, getTargetCell: TargetCellResolver) => {
        if (isDockDropTarget(overId, hand)) {
            addDrawerTileToDock(event, addSurfboardTile);
            return;
        }
        if (overId !== 'board-zone')
            return;
        const target = getTargetCell();
        if (!target)
            return;
        const previewCell: Exclude<BoardCell, {
            kind: 'empty';
        }> = {
            kind: 'surfboard',
            tileId: 'SURF',
            origin: 'placed',
            handTileId: `preview-surf:${target.row},${target.col}`,
        };
        if (validateHandPlacementPreview(target.row, target.col, previewCell).ok) {
            addDrawerTileToBoard(target, addSurfboardTile);
        }
    }, [
        addDrawerTileToBoard,
        addDrawerTileToDock,
        addSurfboardTile,
        hand,
        validateHandPlacementPreview,
    ]);
    const returnBoardTileToDock = useCallback((origin: BoardDragOrigin, event: DragEndEvent) => {
        const previousHandIds = handIdSet(hand);
        returnTileToHand(origin.fromRow, origin.fromCol);
        playPlace();
        dropNewHandTileIntoDock(previousHandIds, event);
    }, [dropNewHandTileIntoDock, hand, playPlace, returnTileToHand]);
    const handleReturnZoneDrop = useCallback((activeId: string, dragSnapshot: ActiveDrag | null) => {
        if (dragSnapshot?.source === 'board-group')
            return;
        const origin = parseBoardDragOrigin(activeId);
        const source = origin
            ? { row: origin.fromRow, col: origin.fromCol }
            : { tileId: activeId };
        if (returnTileToSupply(source))
            playPlace();
    }, [playPlace, returnTileToSupply]);
    const handleBoardTileDrop = useCallback((event: DragEndEvent, activeId: string, overId: string, getTargetCell: TargetCellResolver) => {
        const origin = parseBoardDragOrigin(activeId);
        if (!origin)
            return;
        if (overId === 'board-zone') {
            const target = getTargetCell();
            if (!target || (target.row === origin.fromRow && target.col === origin.fromCol))
                return;
            const validation = validateProjectedBatchMove([
                { fromRow: origin.fromRow, fromCol: origin.fromCol, toRow: target.row, toCol: target.col },
            ], null);
            if (!validation.ok) {
                showMoveRejection(validation.message);
                return;
            }
            moveTile(origin.fromRow, origin.fromCol, target.row, target.col);
            playPlace();
            return;
        }
        returnBoardTileToDock(origin, event);
    }, [moveTile, playPlace, returnBoardTileToDock, validateProjectedBatchMove]);
    const handleBoardGroupDrop = useCallback((event: DragEndEvent, overId: string, drag: Extract<ActiveDrag, {
        source: 'board-group';
    }>) => {
        if (overId !== 'board-zone')
            return;
        const anchorPoint = getGroupAnchorViewportPoint(event.delta);
        if (!anchorPoint || !boardRef.current)
            return;
        const anchorHit = boardRef.current.cellAtPair(anchorPoint.x, anchorPoint.y);
        const anchorUnclamped = boardRef.current.cellAtUnclamped(anchorPoint.x, anchorPoint.y);
        const target = drag.isFloat && anchorUnclamped ? anchorUnclamped : anchorHit.clamped;
        if (!drag.isFloat && anchorHit.logical === null)
            return;
        const projection = projectGroupMove(drag, target.row, target.col);
        if (!projection.valid) {
            showMoveRejection(projection.message);
            return;
        }
        if (!projection.moves.some((m) => m.fromRow !== m.toRow || m.fromCol !== m.toCol))
            return;
        moveTilesBatch(projection.moves);
        playPlace();
        if (!drag.isFloat)
            return;
        const liveFloat = useUIStore.getState().floatGroup;
        if (!liveFloat)
            return;
        const dRow = target.row - drag.anchorRow;
        const dCol = target.col - drag.anchorCol;
        useUIStore.setState({
            floatGroup: {
                ...liveFloat,
                baseMembers: liveFloat.baseMembers.map((m) => ({ ...m, row: m.row + dRow, col: m.col + dCol })),
                anchorRow: liveFloat.anchorRow + dRow,
                anchorCol: liveFloat.anchorCol + dCol,
                floatRow: liveFloat.floatRow + dRow,
                floatCol: liveFloat.floatCol + dCol,
            },
        });
    }, [
        boardRef,
        getGroupAnchorViewportPoint,
        moveTilesBatch,
        playPlace,
        projectGroupMove,
    ]);
    const swapReturnedTileIntoDockSlot = useCallback((activeId: string, previousHandIds: ReadonlySet<string>) => {
        const newTile = findNewHandTile(previousHandIds);
        if (newTile)
            dockRef.current?.swapTileSlot(activeId, newTile.id);
    }, [dockRef]);
    const runBoardTileSwapIntoDock = useCallback((activeId: string, target: BoardDropTarget, action: BoardTileSwapAction) => {
        const previousHandIds = handIdSet(hand);
        const result = action(target.row, target.col, activeId);
        if (result !== 'ok')
            return;
        playPlace();
        swapReturnedTileIntoDockSlot(activeId, previousHandIds);
    }, [hand, playPlace, swapReturnedTileIntoDockSlot]);
    const handleHandTileBoardDrop = useCallback((activeId: string, target: BoardDropTarget) => {
        const handTile = hand.find((t) => t.id === activeId);
        if (!handTile)
            return;
        const { board, submittedPositions } = useGameStore.getState();
        const occupant = board[target.row]?.[target.col];
        const action = classifyHandTileBoardDrop(occupant, handTile, submittedPositions, target);
        switch (action) {
            case 'reclaim-switch':
                runBoardTileSwapIntoDock(activeId, target, reclaimSwitchTile);
                return;
            case 'reclaim-wildcard':
                runBoardTileSwapIntoDock(activeId, target, reclaimWildcardTile);
                return;
            case 'place-switch-over-regular':
                runBoardTileSwapIntoDock(activeId, target, placeHandSwitchOverRegular);
                return;
            case 'swap-pick-with-regular':
                if (swapPickTileWithRegular(target.row, target.col, activeId) === 'ok')
                    playPlace();
                return;
            case 'place':
                if (!validateHandPlacementPreview(target.row, target.col, previewBoardCellForHandTile(handTile)).ok)
                    return;
                placeTile(target.row, target.col, activeId);
                playPlace();
        }
    }, [
        hand,
        placeHandSwitchOverRegular,
        placeTile,
        playPlace,
        previewBoardCellForHandTile,
        reclaimSwitchTile,
        reclaimWildcardTile,
        runBoardTileSwapIntoDock,
        swapPickTileWithRegular,
        validateHandPlacementPreview,
    ]);
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        boardRef.current?.clearHoverCell();
        dockRef.current?.setDragHover(null);
        const dragSnapshot = activeDragRef.current ?? activeDrag;
        activeDragRef.current = null;
        setActiveDrag(null);
        const { active, over } = event;
        try {
            if (!over)
                return;
            const activeId = active.id as string;
            const overId = over.id as string;
            const isTabletPlus = window.innerWidth >= 640;
            const getTargetCell = () => {
                const r = event.active.rect.current.translated;
                if (dragSnapshot?.source === 'board-group') {
                    const anchorPoint = getGroupAnchorViewportPoint(event.delta);
                    if (!anchorPoint || !boardRef.current)
                        return null;
                    return boardRef.current.cellAt(anchorPoint.x, anchorPoint.y);
                }
                if (!r || !boardRef.current)
                    return null;
                return boardRef.current.cellAt(r.left + r.width / 2, r.top + r.height / 2);
            };
            if (activeId.startsWith('pick-drawer-')) {
                handlePickDrawerDrop(event, overId, getTargetCell);
                return;
            }
            if (activeId.startsWith('double-drawer-')) {
                handleDoubleDrawerDrop(event, overId, getTargetCell);
                return;
            }
            if (isDockReturnZone(overId)) {
                handleReturnZoneDrop(activeId, dragSnapshot);
                return;
            }
            if (activeId === 'surfboard-drawer') {
                handleSurfboardDrawerDrop(event, overId, getTargetCell);
                return;
            }
            if (dragSnapshot?.source === 'board-group') {
                handleBoardGroupDrop(event, overId, dragSnapshot);
                return;
            }
            if (activeId.startsWith('board-')) {
                handleBoardTileDrop(event, activeId, overId, getTargetCell);
                return;
            }
            if (overId === 'board-zone') {
                if (isTabletPlus || !pickDrawerOpen) {
                    const target = getTargetCell();
                    if (target)
                        handleHandTileBoardDrop(activeId, target);
                }
                return;
            }
            if (overId === 'dock-zone' || hand.some((t) => t.id === overId)) {
                const rr = event.active.rect.current.translated;
                if (rr && dockRef.current) {
                    dockRef.current.handleTileDrop(activeId, rr.left + rr.width / 2, rr.top + rr.height / 2);
                }
            }
        }
        finally {
            baselineNeighborsRef.current = null;
            groupDragMetricsRef.current = null;
            dragAnchorPosRef.current = null;
            syncRotateButtonPosition();
        }
    }, [
        activeDrag,
        handlePickDrawerDrop, handleDoubleDrawerDrop, handleSurfboardDrawerDrop, handleReturnZoneDrop, handleBoardTileDrop, handleBoardGroupDrop, handleHandTileBoardDrop,
        hand, pickDrawerOpen, getGroupAnchorViewportPoint,
        boardRef, dockRef, dragAnchorPosRef, setActiveDrag,
        syncRotateButtonPosition,
    ]);
    const handleDragCancel = useCallback(() => {
        boardRef.current?.clearHoverCell();
        dockRef.current?.setDragHover(null);
        activeDragRef.current = null;
        baselineNeighborsRef.current = null;
        groupDragMetricsRef.current = null;
        dragAnchorPosRef.current = null;
        syncRotateButtonPosition();
        setActiveDrag(null);
    }, [boardRef, dockRef, dragAnchorPosRef, setActiveDrag, syncRotateButtonPosition]);
    const activeTile = useMemo(() => (activeDrag?.source === 'hand' ? hand.find((t) => t.id === activeDrag.tileId) : undefined), [activeDrag, hand]);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    return {
        activeTile,
        sensors,
        collisionDetection: dockCollisionDetection,
        universalModifier,
        handleDragStart,
        handleDragMove,
        handleDragEnd,
        handleDragCancel,
    };
}
