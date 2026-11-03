'use client';
import { useRef, useCallback, useMemo, useEffect } from 'react';
import type { RefObject } from 'react';
import useSound from 'use-sound';
import { useGameStore } from '@/lib/game-store';
import { useUIStore, selectLeftTool, selectFloatGroup, selectEnterFloat, selectToggleFloatOrientation, selectExitFloat, type FloatGroupMember, type FloatGroupState, } from '@/lib/ui-store';
import { buildBatchMoveContext, evaluateMove, type CellKey, type BatchMove, type EvaluationResult, positionKey, } from '@/lib/modes/move-policy';
import { getFloatProjection, getProjectedFloatMembers, buildProjectedFloatMoves, getTopLeftProjectedAnchor, } from '@/lib/predicates/float/getFloatProjection';
import { getCompoundArmRotateAnchor } from '@/lib/predicates/move/get-compound-arm-rotate-anchor';
import { getMode } from '@/lib/modes/registry';
import type { BoardHandle } from '@/components/Board';
import type { ActiveDrag } from './useDragHandlers';
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
export function useFloatSync({ boardRef, rotateButtonRef, floatOverlayRef, activeDrag, }: {
    boardRef: RefObject<BoardHandle | null>;
    rotateButtonRef: RefObject<HTMLButtonElement | null>;
    floatOverlayRef: RefObject<HTMLDivElement | null>;
    activeDrag: ActiveDrag | null;
}) {
    const boardRows = useGameStore((s) => s.board.length);
    const boardCols = useGameStore((s) => s.board[0]?.length ?? 0);
    const board = useGameStore((s) => s.board);
    const modeId = useGameStore((s) => s.modeId);
    const moveTilesBatch = useGameStore((s) => s.moveTilesBatch);
    const leftTool = useUIStore(selectLeftTool);
    const selectedTileIds = useUIStore((s) => s.selectedTileIds);
    const floatGroup = useUIStore(selectFloatGroup);
    const enterFloat = useUIStore(selectEnterFloat);
    const toggleFloatOrientation = useUIStore(selectToggleFloatOrientation);
    const exitFloat = useUIStore(selectExitFloat);
    const [playPlace] = useSound('/sounds/pop_down.wav');
    const [playError] = useSound('/sounds/ui-error.wav');
    const dragAnchorPosRef = useRef<{
        row: number;
        col: number;
    } | null>(null);
    const collectSelectedMembers = useCallback((selected: Set<string>, liveBoard = useGameStore.getState().board): FloatGroupMember[] => {
        const members: FloatGroupMember[] = [];
        for (let r = 0; r < liveBoard.length; r++) {
            for (let c = 0; c < liveBoard[r].length; c++) {
                const cell = liveBoard[r][c];
                if (cell.kind === 'empty')
                    continue;
                if (!cell.handTileId || !selected.has(cell.handTileId))
                    continue;
                if ('origin' in cell && cell.origin !== 'placed')
                    continue;
                members.push({ tileId: cell.handTileId, row: r, col: c, cell });
            }
        }
        return members;
    }, []);
    const validateProjectedBatchMove = useCallback((moves: BatchMove[], baselineNeighbors?: Map<CellKey, Set<CellKey>> | null): EvaluationResult => {
        const { board: liveBoard, submittedPositions: liveSubmitted, submittedBentWordPositions, modeId, playedWords, chainWords } = useGameStore.getState();
        const context = buildBatchMoveContext(liveBoard, liveSubmitted, playedWords.map((e) => e.word), moves, baselineNeighbors ?? null, submittedBentWordPositions, chainWords);
        return evaluateMove(getMode(modeId).validateBatchMove, context);
    }, []);
    const projectFloatState = useCallback((fg: FloatGroupState) => {
        const { board: liveBoard } = useGameStore.getState();
        return getFloatProjection({
            floatState: fg,
            board: liveBoard,
            rows: boardRows,
            cols: boardCols,
            validateProjectedBatchMove,
        });
    }, [boardRows, boardCols, validateProjectedBatchMove]);
    const selectionAnchor = useMemo(() => {
        if (selectedTileIds.size === 0)
            return null;
        const members = collectSelectedMembers(selectedTileIds, board);
        return pickTopLeftMember(members);
    }, [collectSelectedMembers, selectedTileIds, board]);
    const floatProjection = useMemo(() => (floatGroup ? projectFloatState(floatGroup) : null), [floatGroup, projectFloatState]);
    const floatAnchorPos = useMemo(() => {
        if (!floatProjection || floatProjection.projected.length === 0)
            return null;
        return getTopLeftProjectedAnchor(floatProjection.projected);
    }, [floatProjection]);
    const anchorPos = useMemo(() => {
        if (floatGroup)
            return floatAnchorPos ?? { row: floatGroup.anchorRow, col: floatGroup.anchorCol };
        return selectionAnchor ? { row: selectionAnchor.row, col: selectionAnchor.col } : null;
    }, [floatGroup, floatAnchorPos, selectionAnchor]);
    const showRotateButton = leftTool === 'move' &&
        selectedTileIds.size >= 2 &&
        !!anchorPos &&
        (!activeDrag || activeDrag.source === 'board-group');
    const floatLayout = useMemo(() => {
        if (!floatProjection || floatProjection.projected.length === 0)
            return null;
        const rows = floatProjection.projected.map((m) => m.row);
        const cols = floatProjection.projected.map((m) => m.col);
        return {
            minRow: Math.min(...rows),
            minCol: Math.min(...cols),
            spanRows: Math.max(...rows) - Math.min(...rows) + 1,
            spanCols: Math.max(...cols) - Math.min(...cols) + 1,
        };
    }, [floatProjection]);
    const syncRotateButtonPosition = useCallback((overridePos?: {
        row: number;
        col: number;
    } | null) => {
        const el = rotateButtonRef.current;
        if (!el)
            return;
        const position = overridePos ?? dragAnchorPosRef.current ?? anchorPos;
        if (!showRotateButton || !position || !boardRef.current) {
            el.style.display = 'none';
            return;
        }
        const rect = boardRef.current.cellRectAt(position.row, position.col);
        if (!rect) {
            el.style.display = 'none';
            return;
        }
        el.style.display = 'flex';
        el.style.left = `${rect.left + rect.width / 2 - 16}px`;
        el.style.top = `${rect.top - 36}px`;
    }, [showRotateButton, anchorPos, boardRef, rotateButtonRef]);
    const syncRotateButtonToViewport = useCallback((anchorX: number, anchorY: number, tileSize: number) => {
        const el = rotateButtonRef.current;
        if (!el)
            return;
        if (!showRotateButton) {
            el.style.display = 'none';
            return;
        }
        el.style.display = 'flex';
        el.style.left = `${anchorX - 16}px`;
        el.style.top = `${anchorY - tileSize / 2 - 36}px`;
    }, [showRotateButton, rotateButtonRef]);
    const syncFloatOverlayPosition = useCallback(() => {
        const el = floatOverlayRef.current;
        if (!el)
            return;
        if (!floatLayout || !boardRef.current) {
            el.style.display = 'none';
            return;
        }
        const rect = boardRef.current.cellRectAt(floatLayout.minRow, floatLayout.minCol);
        const scale = boardRef.current.getTransform().scale;
        if (!rect) {
            el.style.display = 'none';
            return;
        }
        el.style.display = 'block';
        el.style.left = `${rect.left}px`;
        el.style.top = `${rect.top}px`;
        el.style.transform = `scale(${scale})`;
    }, [floatLayout, boardRef, floatOverlayRef]);
    const syncOverlayDomPositions = useCallback(() => {
        syncRotateButtonPosition();
        syncFloatOverlayPosition();
    }, [syncRotateButtonPosition, syncFloatOverlayPosition]);
    const commitFloatIfValid = useCallback(() => {
        const liveFloat = useUIStore.getState().floatGroup;
        if (!liveFloat)
            return;
        const { board: liveBoard } = useGameStore.getState();
        const projected = getProjectedFloatMembers(liveFloat);
        const { moves, foundAllSources } = buildProjectedFloatMoves(liveBoard, liveFloat, projected);
        if (!foundAllSources)
            return;
        if (!moves.some((m) => m.fromRow !== m.toRow || m.fromCol !== m.toCol))
            return;
        moveTilesBatch(moves);
    }, [moveTilesBatch]);
    const handleBoardTransformChange = useCallback(() => {
        syncOverlayDomPositions();
    }, [syncOverlayDomPositions]);
    const handleRotateToggle = useCallback(() => {
        const ui = useUIStore.getState();
        if (ui.floatGroup) {
            const nextFloat = {
                ...ui.floatGroup,
                orientation: ui.floatGroup.orientation === 'base' ? 'alternate' as const : 'base' as const,
            };
            const projection = projectFloatState(nextFloat);
            toggleFloatOrientation();
            if (projection.valid)
                playPlace();
            else
                playError();
            return;
        }
        if (ui.selectedTileIds.size < 2)
            return;
        const members = collectSelectedMembers(ui.selectedTileIds);
        if (members.length < 2)
            return;
        const anchor = pickTopLeftMember(members);
        if (!anchor)
            return;
        let anchorRow = anchor.row;
        let anchorCol = anchor.col;
        const liveState = useGameStore.getState();
        if (getMode(modeId).supportsCompoundArmRotatePivot) {
            const selectedPositionKeys = new Set(members.map((member) => positionKey(member.row, member.col)));
            const compoundAnchor = getCompoundArmRotateAnchor({
                board: liveState.board,
                selectedPositions: selectedPositionKeys,
                submittedCompoundPositions: liveState.submittedBentWordPositions,
            });
            if (compoundAnchor) {
                anchorRow = compoundAnchor.pivotRow;
                anchorCol = compoundAnchor.pivotCol;
            }
        }
        const initialFloat: FloatGroupState = {
            baseMembers: members,
            anchorRow,
            anchorCol,
            orientation: 'alternate',
            floatRow: anchorRow,
            floatCol: anchorCol,
        };
        const projection = projectFloatState(initialFloat);
        enterFloat(members, anchorRow, anchorCol);
        toggleFloatOrientation();
        if (projection.valid)
            playPlace();
        else
            playError();
    }, [collectSelectedMembers, enterFloat, toggleFloatOrientation, projectFloatState, playPlace, playError, modeId]);
    useEffect(() => {
        const rafId = requestAnimationFrame(() => syncOverlayDomPositions());
        return () => cancelAnimationFrame(rafId);
    }, [syncOverlayDomPositions, anchorPos, floatLayout, activeDrag]);
    useEffect(() => {
        if (!boardRef.current || !floatProjection)
            return;
        if (activeDrag?.source === 'board-group')
            return;
        const bRows = useGameStore.getState().board.length;
        const bCols = useGameStore.getState().board[0]?.length ?? 0;
        const cells = floatProjection.moves
            .filter((m) => m.toRow >= 0 && m.toRow < bRows && m.toCol >= 0 && m.toCol < bCols)
            .map((m) => ({ row: m.toRow, col: m.toCol, valid: floatProjection.valid }));
        boardRef.current.setHoverCells(cells);
    }, [floatProjection, activeDrag, boardRef]);
    useEffect(() => {
        if (floatGroup || activeDrag)
            return;
        boardRef.current?.clearHoverCell();
    }, [floatGroup, activeDrag, boardRef]);
    useEffect(() => {
        if (leftTool === 'move')
            return;
        if (useUIStore.getState().floatGroup)
            commitFloatIfValid();
        if (!useUIStore.getState().floatGroup)
            return;
        exitFloat();
        boardRef.current?.clearHoverCell();
        dragAnchorPosRef.current = null;
        syncRotateButtonPosition();
    }, [leftTool, boardRef, commitFloatIfValid, exitFloat, syncRotateButtonPosition]);
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || !useUIStore.getState().floatGroup)
                return;
            e.preventDefault();
            exitFloat();
            boardRef.current?.clearHoverCell();
            dragAnchorPosRef.current = null;
            syncRotateButtonPosition();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [boardRef, exitFloat, syncRotateButtonPosition]);
    return {
        floatProjection,
        floatLayout,
        anchorPos,
        showRotateButton,
        syncRotateButtonPosition,
        syncRotateButtonToViewport,
        syncOverlayDomPositions,
        handleBoardTransformChange,
        projectFloatState,
        collectSelectedMembers,
        validateProjectedBatchMove,
        commitFloatIfValid,
        handleRotateToggle,
        dragAnchorPosRef,
    };
}
