'use client';
import { useState, useSyncExternalStore, useEffect, useLayoutEffect, useCallback, useRef, useMemo, memo, createContext, useContext, Fragment, type MutableRefObject, type ReactNode } from 'react';
import { DndContext, DragOverlay, useDroppable, useDraggable, } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'motion/react';
import Board, { type BoardHandle } from '@/components/Board';
import Dock, { DockTileFace, isDockWildcardHintEligible, type DockHandle } from '@/components/Dock';
import { RegularTileFace } from '@/components/RegularTileFace';
import SpringTile, { FlipTile } from '@/components/SpringTile';
import { useGameStore, selectCell, selectIsSubmittedPosition, selectAnimDelay, selectGameOver, selectRound, selectTimerEnabled, selectRoundTimerEndsAt, selectTimerStatus, type BoardCell, } from '@/lib/game-store';
import RulesModal from '@/components/RulesModal';
import GameOverModal from '@/components/GameOverModal';
import WildcardLetterModal, { type WildcardLetterTarget } from '@/components/WildcardLetterModal';
import HudBar from './HudBar2';
import GameControls from '@/components/GameControls';
import { loadDictionary } from '@/lib/dictionary';
import { positionKey } from '@/lib/modes/move-policy';
import { getBlockedAdjacentEmptyKeys } from '@/lib/predicates/board/getBlockedAdjacentEmptyKeys';
import { getSelectedPositionKeys } from '@/lib/predicates/board/getSelectedPositionKeys';
import { type ProjectedFloatMember } from '@/lib/predicates/float/getFloatProjection';
import { composeCellAnnotations, type CellAnnotation, EMPTY_ANNOTATION } from '@/lib/validation/composeCellAnnotations';
import { LETTER_VALUES, DOUBLE_TILE_BY_ID } from '@/lib/tiles';
import { mergeHiddenTileIds } from '@/lib/ui/mergeHiddenTileIds';
import { isAcceptedCrosswordsWord } from '@/lib/modes/crosswords/sbs-rules';
import { isAcceptedSurfFixWord } from '@/lib/modes/surf-fix/acceptance';
import { getSurfFixPrePostHintKeys } from '@/lib/modes/surf-fix/pre-post-hints';
import { getSurfFixWordHighlightCellKeys } from '@/lib/modes/surf-fix/word-highlight';
import { canChooseWildcardLetters, canDragSubmittedBoardTiles, shouldShowBlockedAdjacentOverlay } from '@/lib/modes/ui-capabilities';
import { playedWordEntryIdentity, type PlayedWordEntry } from '@/lib/presentation/round-word-pills';
import { useUIStore, selectLeftTool, selectAddSelectedTile, selectRemoveSelectedTile, selectFloatGroup, selectSetLeftTool, selectClearSelectedTiles, selectPruneSelectedTiles, selectToggleSelectedTile, } from '@/lib/ui-store';
import { TbHandFinger } from 'react-icons/tb';
import { LuMove } from 'react-icons/lu';
import { PiHandGrabbingBold } from 'react-icons/pi';
import { FaRotateRight } from 'react-icons/fa6';
import { IoBrushOutline } from 'react-icons/io5';
import { useRideBrush } from '@/hooks/useRideBrush';
import { surfFixTileIdForCell } from '@/lib/modes/surf-fix/adapter';
import { useSwapPickOverlay } from '@/hooks/useSwapPickOverlay';
import { useToolPill } from '@/hooks/useToolPill';
import { useWordValidation } from '@/hooks/useWordValidation';
import { useFloatSync } from '@/hooks/useFloatSync';
import { useDragHandlers, type ActiveDrag } from '@/hooks/useDragHandlers';
import useSound from 'use-sound';
import SurfboardSVG from '@/public/surf-board5.svg';
const WildcardPickerContext = createContext<(row: number, col: number) => void>(() => { });
type SelectSweepHandlers = {
    onTilePointerDown: (payload: {
        tileId: string;
        pointerId: number;
        clientX: number;
        clientY: number;
    }) => void;
    consumeSuppressedClick: () => boolean;
    toggleTile: (tileId: string) => void;
};
const selectSweepNoopHandlers: SelectSweepHandlers = {
    onTilePointerDown: () => { },
    consumeSuppressedClick: () => false,
    toggleTile: () => { },
};
const selectSweepNoopHandlersRef: MutableRefObject<SelectSweepHandlers> = { current: selectSweepNoopHandlers };
const SelectSweepContext = createContext<MutableRefObject<SelectSweepHandlers>>(selectSweepNoopHandlersRef);
const OVERLAY_TILE = 44;
const SELECT_SWEEP_MOVE_SQ = 6 * 6;
type SelectSweepSession = {
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
    mode: 'add' | 'remove';
    seenTileIds: Set<string>;
};
type PlacedBoardCell = Exclude<BoardCell, {
    kind: 'empty';
}>;
function isFixedPlacedCell(cell: PlacedBoardCell): boolean {
    return cell.origin === 'fixed';
}
function SurfboardOverlayTile() {
    return (<div className="relative w-full h-full">
      <RegularTileFace letter="" value={0} isPickTile={false}/>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <SurfboardSVG style={{
            width: '70%',
            transform: 'rotate(-45deg)',
            transformOrigin: 'center',
        }}/>
      </div>
    </div>);
}
function BoardTileOverlay({ cell }: {
    cell: BoardCell;
}) {
    if (cell.kind === 'empty')
        return null;
    return (<motion.div layoutId={cell.handTileId} transition={{ layout: { duration: 0 } }} className="relative w-11 h-11 select-none">
      {cell.kind === 'regular' ? (<RegularTileFace letter={cell.letter} value={LETTER_VALUES[cell.letter]} isPickTile={!!cell.isPickTile}/>) : cell.kind === 'double' ? (<RegularTileFace letter={cell.id} value={cell.value} isPickTile={false} small/>) : cell.kind === 'switch' ? (<FlipTile data={{ sideA: cell.sideA, sideB: cell.sideB }} activeSide={'activeSide' in cell ? cell.activeSide : undefined}/>) : cell.kind === 'surfboard' ? (<SurfboardOverlayTile />) : (<RegularTileFace letter={cell.representsLetter ?? 'X'} value={LETTER_VALUES['X']} isPickTile={false}/>)}
    </motion.div>);
}
function GroupOutlineBorder({ hasTop, hasRight, hasBottom, hasLeft }: {
    hasTop: boolean;
    hasRight: boolean;
    hasBottom: boolean;
    hasLeft: boolean;
}) {
    const edge = (has: boolean) => (has ? 'none' : '3px dashed');
    return (<>
      <div className="absolute inset-0 pointer-events-none" style={{
            transform: 'translate(1px, 1px)', zIndex: 19,
            borderTop: `${edge(hasTop)} #111`, borderRight: `${edge(hasRight)} #111`,
            borderBottom: `${edge(hasBottom)} #111`, borderLeft: `${edge(hasLeft)} #111`,
        }}/>
      <div className="absolute inset-0 pointer-events-none" style={{
            zIndex: 20,
            borderTop: `${edge(hasTop)} #ffb73f`, borderRight: `${edge(hasRight)} #ffb73f`,
            borderBottom: `${edge(hasBottom)} #ffb73f`, borderLeft: `${edge(hasLeft)} #ffb73f`,
        }}/>
    </>);
}
function GroupDragOverlay({ members, scale }: {
    members: Extract<ActiveDrag, {
        source: 'board-group';
    }>['members'];
    scale: number;
}) {
    const minRow = Math.min(...members.map(m => m.row));
    const maxRow = Math.max(...members.map(m => m.row));
    const minCol = Math.min(...members.map(m => m.col));
    const maxCol = Math.max(...members.map(m => m.col));
    const spanRows = maxRow - minRow + 1;
    const spanCols = maxCol - minCol + 1;
    const step = OVERLAY_TILE * scale;
    const tileOffset = (step - OVERLAY_TILE) / 2;
    const keys = new Set(members.map(m => positionKey(m.row, m.col)));
    return (<div style={{ position: 'relative', width: spanCols * step, height: spanRows * step }}>
      {members.map((m) => {
            const hasTop = keys.has(positionKey(m.row - 1, m.col));
            const hasRight = keys.has(positionKey(m.row, m.col + 1));
            const hasBottom = keys.has(positionKey(m.row + 1, m.col));
            const hasLeft = keys.has(positionKey(m.row, m.col - 1));
            return (<div key={m.tileId} style={{
                    position: 'absolute',
                    left: (m.col - minCol) * step,
                    top: (m.row - minRow) * step,
                    width: step,
                    height: step,
                    border: '2px dashed rgba(0,110,134,0.4)',
                    borderRadius: '0.375rem',
                }}>
            <div style={{
                    position: 'absolute',
                    width: OVERLAY_TILE,
                    height: OVERLAY_TILE,
                    left: tileOffset,
                    top: tileOffset,
                    transform: `scale(${scale * 0.8})`,
                    transformOrigin: 'center',
                }}>
              {m.cell.kind === 'regular' ? (<RegularTileFace letter={m.cell.letter} value={LETTER_VALUES[m.cell.letter]} isPickTile={!!m.cell.isPickTile}/>) : m.cell.kind === 'double' ? (<RegularTileFace letter={m.cell.id} value={m.cell.value} isPickTile={false} small/>) : m.cell.kind === 'switch' ? (<FlipTile data={{ sideA: m.cell.sideA, sideB: m.cell.sideB }} activeSide={'activeSide' in m.cell ? m.cell.activeSide : undefined}/>) : m.cell.kind === 'surfboard' ? (<SurfboardOverlayTile />) : (<RegularTileFace letter={m.cell.representsLetter ?? 'X'} value={LETTER_VALUES['X']} isPickTile={false}/>)}
            </div>
            <GroupOutlineBorder hasTop={hasTop} hasRight={hasRight} hasBottom={hasBottom} hasLeft={hasLeft}/>
          </div>);
        })}
    </div>);
}
const FloatPreviewTile = memo(function FloatPreviewTile({ member, minRow, minCol, hasTop, hasRight, hasBottom, hasLeft, invalid, }: {
    member: ProjectedFloatMember;
    minRow: number;
    minCol: number;
    hasTop: boolean;
    hasRight: boolean;
    hasBottom: boolean;
    hasLeft: boolean;
    invalid: boolean;
}) {
    const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
        id: `float-${member.tileId}`,
        data: { type: 'float-preview', tileId: member.tileId },
    });
    return (<div ref={setNodeRef} {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing" style={{
            opacity: isDragging ? 0 : 1,
            position: 'absolute',
            left: (member.col - minCol) * OVERLAY_TILE,
            top: (member.row - minRow) * OVERLAY_TILE,
            width: OVERLAY_TILE,
            height: OVERLAY_TILE,
            border: '2px dashed rgba(0,110,134,0.4)',
            borderRadius: '0.375rem',
        }}>
      {member.cell.kind === 'regular' ? (<RegularTileFace letter={member.cell.letter} value={LETTER_VALUES[member.cell.letter]} isPickTile={!!member.cell.isPickTile}/>) : member.cell.kind === 'double' ? (<RegularTileFace letter={member.cell.id} value={member.cell.value} isPickTile={false} small/>) : member.cell.kind === 'switch' ? (<FlipTile data={{ sideA: member.cell.sideA, sideB: member.cell.sideB }} activeSide={'activeSide' in member.cell ? member.cell.activeSide : undefined}/>) : member.cell.kind === 'surfboard' ? (<SurfboardOverlayTile />) : (<RegularTileFace letter={member.cell.representsLetter ?? 'X'} value={LETTER_VALUES['X']} isPickTile={false}/>)}
      {invalid && (<div className="absolute inset-0 pointer-events-none" style={{
                zIndex: 18,
                background: 'rgba(239,68,68,0.5)',
                borderRadius: '0.25rem',
            }}/>)}
      <GroupOutlineBorder hasTop={hasTop} hasRight={hasRight} hasBottom={hasBottom} hasLeft={hasLeft}/>
    </div>);
});
function FloatGroupOverlay({ members, invalidMemberIds, }: {
    members: ProjectedFloatMember[];
    invalidMemberIds: Set<string>;
}) {
    const minRow = Math.min(...members.map((m) => m.row));
    const maxRow = Math.max(...members.map((m) => m.row));
    const minCol = Math.min(...members.map((m) => m.col));
    const maxCol = Math.max(...members.map((m) => m.col));
    const spanRows = maxRow - minRow + 1;
    const spanCols = maxCol - minCol + 1;
    const keys = new Set(members.map((m) => positionKey(m.row, m.col)));
    return (<div style={{ position: 'relative', width: spanCols * OVERLAY_TILE, height: spanRows * OVERLAY_TILE }}>
      {members.map((m) => {
            const hasTop = keys.has(positionKey(m.row - 1, m.col));
            const hasRight = keys.has(positionKey(m.row, m.col + 1));
            const hasBottom = keys.has(positionKey(m.row + 1, m.col));
            const hasLeft = keys.has(positionKey(m.row, m.col - 1));
            return (<FloatPreviewTile key={m.tileId} member={m} minRow={minRow} minCol={minCol} hasTop={hasTop} hasRight={hasRight} hasBottom={hasBottom} hasLeft={hasLeft} invalid={invalidMemberIds.has(m.tileId)}/>);
        })}
    </div>);
}
const PlacedTileCell = memo(function PlacedTileCell({ row, col, cell, isSelected, hasSelectedNeighbor, inValidWord, hiddenByGroupDrag, }: {
    row: number;
    col: number;
    cell: PlacedBoardCell;
    isSelected: boolean;
    hasSelectedNeighbor: {
        top: boolean;
        right: boolean;
        bottom: boolean;
        left: boolean;
    };
    inValidWord: boolean;
    hiddenByGroupDrag?: boolean;
}) {
    const isSubmitted = useGameStore(selectIsSubmittedPosition(row, col));
    const animDelay = useGameStore(selectAnimDelay(row, col));
    const boardTool = useUIStore(selectLeftTool);
    const toggleSelectedTile = useUIStore(selectToggleSelectedTile);
    const wildcardMustBeUsedAsXRound = useGameStore((s) => s.wildcardMustBeUsedAsXRound);
    const round = useGameStore(selectRound);
    const modeId = useGameStore((s) => s.modeId);
    const [playClick] = useSound('/sounds/ui-click.wav');
    const openWildcardPicker = useContext(WildcardPickerContext);
    const selectSweepHandlersRef = useContext(SelectSweepContext);
    const isFixed = isFixedPlacedCell(cell);
    const isPlaced = !isFixed;
    const isSwitchTile = cell.kind === 'switch';
    const isSelectable = boardTool === 'ride' || (isPlaced && !!cell.handTileId);
    const selectionTileId = boardTool === 'ride' ? surfFixTileIdForCell(cell, { row, col }) : cell.handTileId;
    const isForceUseXRound = wildcardMustBeUsedAsXRound === round;
    const isEditableRegularX = !isFixed && cell.kind === 'regular' && cell.letter === 'X' && !cell.isPickTile && !isForceUseXRound;
    const canOpenWildcardPicker = !isFixed && (cell.kind === 'wildcard' || isEditableRegularX);
    const canChooseWildcardLetter = canChooseWildcardLetters(modeId);
    const showWildcardHint = canChooseWildcardLetter && !isSubmitted && isEditableRegularX;
    const canDragSubmittedTile = canDragSubmittedBoardTiles(modeId);
    const canDrag = isPlaced && ((boardTool === 'hand' && (!isSubmitted || canDragSubmittedTile)) ||
        (boardTool === 'move' && isSelected)) && !hiddenByGroupDrag;
    const tileCursorClass = canDrag
        ? 'cursor-grab'
        : (boardTool === 'select' || boardTool === 'ride') && isSelectable
            ? 'cursor-pointer'
            : boardTool === 'inspect'
                ? 'cursor-zoom-in'
                : 'cursor-default';
    const sharedLayoutId = isPlaced && (!isSubmitted || canDragSubmittedTile) ? cell.handTileId : undefined;
    const { setNodeRef, isDragging, attributes, listeners } = useDraggable({
        id: `board-${row}-${col}`,
        data: { type: 'board', row, col, cell },
        disabled: !canDrag,
    });
    const onRotate = useMemo(() => (isSwitchTile ? () => useGameStore.getState().rotateSwitchTile(row, col) : undefined), [isSwitchTile, row, col]);
    const activeSide = isSwitchTile && 'activeSide' in cell ? cell.activeSide : undefined;
    const handlePointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((boardTool !== 'select' && boardTool !== 'ride') || !isSelectable || !selectionTileId)
            return;
        if (e.pointerType === 'mouse' && e.button !== 0)
            return;
        e.stopPropagation();
        selectSweepHandlersRef.current.onTilePointerDown({
            tileId: selectionTileId,
            pointerId: e.pointerId,
            clientX: e.clientX,
            clientY: e.clientY,
        });
    };
    const handleSelectCapture = (e: React.MouseEvent<HTMLDivElement>) => {
        if (canChooseWildcardLetter && boardTool === 'hand' && !isSubmitted && canOpenWildcardPicker) {
            e.stopPropagation();
            openWildcardPicker(row, col);
            return;
        }
        if ((boardTool === 'select' || boardTool === 'ride') && selectSweepHandlersRef.current.consumeSuppressedClick()) {
            e.stopPropagation();
            return;
        }
        if ((boardTool !== 'select' && boardTool !== 'ride') || !isSelectable || !selectionTileId)
            return;
        e.stopPropagation();
        playClick();
        if (boardTool === 'ride')
            selectSweepHandlersRef.current.toggleTile(selectionTileId);
        else
            toggleSelectedTile(selectionTileId);
    };
    const handleSwitchDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isSwitchTile)
            return;
        e.stopPropagation();
        e.preventDefault();
    };
    return (<div ref={setNodeRef} {...attributes} {...listeners} data-ride-tile-id={surfFixTileIdForCell(cell, { row, col })} aria-disabled={boardTool === 'ride' ? false : attributes['aria-disabled']} aria-pressed={boardTool === 'ride' ? isSelected : undefined} onKeyDownCapture={(event) => {
            if (boardTool !== 'ride' || !selectionTileId || (event.key !== 'Enter' && event.key !== ' '))
                return;
            event.preventDefault();
            event.stopPropagation();
            selectSweepHandlersRef.current.toggleTile(selectionTileId);
        }} onPointerDownCapture={handlePointerDownCapture} onClickCapture={handleSelectCapture} onDoubleClick={handleSwitchDoubleClick} data-board-draggable={canDrag || undefined} data-board-gesture-blocker={isSwitchTile || undefined} className={`absolute inset-0 ${canDrag
            ? `touch-none ${isDragging ? 'cursor-grabbing' : tileCursorClass}`
            : `${boardTool === 'ride' ? 'touch-none ' : ''}${tileCursorClass}`}`} style={(isDragging || hiddenByGroupDrag) ? { opacity: 0 } : undefined}>
      <SpringTile key={sharedLayoutId ?? `static-${row}-${col}-${cell.handTileId ?? ''}`} cell={cell} sharedLayoutId={sharedLayoutId} cursorClass={tileCursorClass} activeSide={activeSide} onRotate={onRotate} inValidWord={inValidWord} animDelay={animDelay} isFixed={isFixed} wildcardHint={showWildcardHint}/>
      {isSelected && (<>
          <GroupOutlineBorder hasTop={hasSelectedNeighbor.top} hasRight={hasSelectedNeighbor.right} hasBottom={hasSelectedNeighbor.bottom} hasLeft={hasSelectedNeighbor.left}/>
        </>)}
    </div>);
});
function BlockedCellOverlay() {
    return (<div className="absolute inset-0 rounded-[0.25rem] pointer-events-none" style={{ background: 'rgba(0, 110, 134, 0.08)' }}/>);
}
function SurfFixPrePostHintOverlay() {
    return (<div className="absolute inset-0 rounded-[0.25rem] pointer-events-none flex items-center justify-center" style={{
            color: '#111',
            fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 20,
            fontWeight: 900,
            opacity: 0.55,
        }}>
      @
    </div>);
}
function InspectionOutlineOverlay({ hasTop, hasRight, hasBottom, hasLeft, }: {
    hasTop: boolean;
    hasRight: boolean;
    hasBottom: boolean;
    hasLeft: boolean;
}) {
    return (<div className="absolute inset-0 pointer-events-none">
      <GroupOutlineBorder hasTop={hasTop} hasRight={hasRight} hasBottom={hasBottom} hasLeft={hasLeft}/>
    </div>);
}
const DroppableCell = memo(function DroppableCell({ row, col, isDragging, cellAnnotations, hiddenTileIds, }: {
    row: number;
    col: number;
    isDragging: boolean;
    cellAnnotations: Map<string, CellAnnotation>;
    hiddenTileIds: Set<string> | null;
}) {
    const cell = useGameStore(selectCell(row, col));
    const tileId = cell && cell.kind !== 'empty' ? cell.handTileId : undefined;
    const hiddenByGroupDrag = !!tileId && !!hiddenTileIds?.has(tileId);
    const key = positionKey(row, col);
    const annotation = cellAnnotations.get(key) ?? EMPTY_ANNOTATION;
    const isBlocked = annotation.isBlockedAdjacency;
    const isSurfFixPrePostHint = annotation.isSurfFixPrePostHint;
    const isInspected = annotation.isInspected;
    const inspectedNeighborAt = (r: number, c: number) => (cellAnnotations.get(positionKey(r, c)) ?? EMPTY_ANNOTATION).isInspected;
    const inspectedNeighbors = {
        top: inspectedNeighborAt(row - 1, col),
        right: inspectedNeighborAt(row, col + 1),
        bottom: inspectedNeighborAt(row + 1, col),
        left: inspectedNeighborAt(row, col - 1),
    };
    if (hiddenByGroupDrag) {
        return (<>
        {isDragging && isBlocked ? <BlockedCellOverlay /> : null}
        {isSurfFixPrePostHint ? <SurfFixPrePostHintOverlay /> : null}
        {isInspected ? <InspectionOutlineOverlay hasTop={inspectedNeighbors.top} hasRight={inspectedNeighbors.right} hasBottom={inspectedNeighbors.bottom} hasLeft={inspectedNeighbors.left}/> : null}
      </>);
    }
    if (!cell || cell.kind === 'empty') {
        return (<>
        {isDragging && isBlocked ? <BlockedCellOverlay /> : null}
        {isSurfFixPrePostHint ? <SurfFixPrePostHintOverlay /> : null}
        {isInspected ? <InspectionOutlineOverlay hasTop={inspectedNeighbors.top} hasRight={inspectedNeighbors.right} hasBottom={inspectedNeighbors.bottom} hasLeft={inspectedNeighbors.left}/> : null}
      </>);
    }
    const isSelected = annotation.isSelected;
    const isOutlinedAt = (r: number, c: number) => {
        const next = cellAnnotations.get(positionKey(r, c)) ?? EMPTY_ANNOTATION;
        return isInspected ? next.isInspected : next.isSelected;
    };
    const hasSelectedNeighbor = {
        top: isOutlinedAt(row - 1, col),
        right: isOutlinedAt(row, col + 1),
        bottom: isOutlinedAt(row + 1, col),
        left: isOutlinedAt(row, col - 1),
    };
    return (<>
      <PlacedTileCell row={row} col={col} cell={cell} isSelected={isSelected || isInspected} hasSelectedNeighbor={hasSelectedNeighbor} inValidWord={annotation.isValidWord} hiddenByGroupDrag={hiddenByGroupDrag}/>
    </>);
}, (prev, next) => {
    if (prev.isDragging !== next.isDragging)
        return false;
    if (prev.hiddenTileIds !== next.hiddenTileIds)
        return false;
    const key = positionKey(prev.row, prev.col);
    const pa = prev.cellAnnotations.get(key) ?? EMPTY_ANNOTATION;
    const na = next.cellAnnotations.get(key) ?? EMPTY_ANNOTATION;
    if (pa !== na &&
        (pa.isBlockedAdjacency !== na.isBlockedAdjacency ||
            pa.isValidWord !== na.isValidWord ||
            pa.isSelected !== na.isSelected ||
            pa.isInspected !== na.isInspected ||
            pa.isFloatInvalid !== na.isFloatInvalid ||
            pa.isSurfFixPrePostHint !== na.isSurfFixPrePostHint))
        return false;
    for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]] as const) {
        const prevNeighbor = prev.cellAnnotations.get(positionKey(prev.row + dr, prev.col + dc)) ?? EMPTY_ANNOTATION;
        const nextNeighbor = next.cellAnnotations.get(positionKey(next.row + dr, next.col + dc)) ?? EMPTY_ANNOTATION;
        const prevOutlined = pa.isInspected ? prevNeighbor.isInspected : prevNeighbor.isSelected;
        const nextOutlined = na.isInspected ? nextNeighbor.isInspected : nextNeighbor.isSelected;
        if (prevOutlined !== nextOutlined)
            return false;
    }
    return true;
});
const BoardDropZone = memo(function BoardDropZone({ boardRef, rows, cols, renderCell, gesturesEnabled, resetViewEnabled, onTransformChange, }: {
    boardRef: React.RefObject<BoardHandle | null>;
    rows: number;
    cols: number;
    renderCell: (row: number, col: number) => ReactNode;
    gesturesEnabled: boolean;
    resetViewEnabled: boolean;
    onTransformChange?: (x: number, y: number, scale: number) => void;
}) {
    const { setNodeRef } = useDroppable({ id: 'board-zone' });
    return (<div ref={setNodeRef} className="h-full w-full">
      <Board ref={boardRef} rows={rows} cols={cols} cellSize={44} renderCell={renderCell} gesturesEnabled={gesturesEnabled} resetViewEnabled={resetViewEnabled} onTransformChange={onTransformChange}/>
    </div>);
});
const subscribeToMount = () => () => {};
const clientMounted = () => true;
const serverMounted = () => false;

export default function GameBoardClient() {
    const mounted = useSyncExternalStore(subscribeToMount, clientMounted, serverMounted);
    const [activeDrag, updateActiveDrag] = useState<ActiveDrag | null>(null);
    const [dragScale, setDragScale] = useState(1);
    const setActiveDrag = useCallback((drag: ActiveDrag | null) => {
        if (drag) setDragScale(boardRef.current?.getTransform().scale ?? 1);
        updateActiveDrag(drag);
    }, []);
    const [pickDrawerOpen, setPickDrawerOpen] = useState(false);
    const [showGameOver, setShowGameOver] = useState(false);
    const [rulesDismissed, setRulesDismissed] = useState(false);
    const [rulesModalKey, setRulesModalKey] = useState(0);
    const [wildcardPickerTarget, setWildcardPickerTarget] = useState<WildcardLetterTarget | null>(null);
    const [hoveredPlayedWord, setHoveredPlayedWord] = useState<PlayedWordEntry | null>(null);
    const [pinnedPlayedWord, setPinnedPlayedWord] = useState<PlayedWordEntry | null>(null);
    const boardRef = useRef<BoardHandle>(null);
    const dockRef = useRef<DockHandle>(null);
    const rotateButtonRef = useRef<HTMLButtonElement>(null);
    const floatOverlayRef = useRef<HTMLDivElement>(null);
    const drawHand = useGameStore((s) => s.drawHand);
    const gameOver = useGameStore(selectGameOver);
    const round = useGameStore(selectRound);
    const modeId = useGameStore((s) => s.modeId);
    const regularRideControls = useGameStore((s) => s.modeId === 'surf-fix'
        && s.authoring?.source === 'surf-fix-game' && s.authoring.rideSelection === 'brush');
    const rideSelection = regularRideControls;
    const rideOnlyFeedback = regularRideControls;
    const chainWords = useGameStore((s) => s.chainWords);
    const wildcardMustBeUsedAsXRound = useGameStore((s) => s.wildcardMustBeUsedAsXRound);
    const timerEnabled = useGameStore(selectTimerEnabled);
    const roundTimerEndsAt = useGameStore(selectRoundTimerEndsAt);
    const timerStatus = useGameStore(selectTimerStatus);
    const startRoundTimer = useGameStore((s) => s.startRoundTimer);
    const expireRoundTimer = useGameStore((s) => s.expireRoundTimer);
    const clearRoundTimer = useGameStore((s) => s.clearRoundTimer);
    const [playClick] = useSound('/sounds/ui-click.wav');
    const [playTimerWarning] = useSound('/sounds/timer-warning-ukulele-strum.mp3');
    const [playTimerEnd] = useSound('/sounds/timer-end-ukulele.mp3');
    const board = useGameStore((s) => s.board);
    const boardRows = useGameStore((s) => s.board.length);
    const boardCols = useGameStore((s) => s.board[0]?.length ?? 0);
    const validPositions = useGameStore((s) => s.validPositions);
    const submittedPositions = useGameStore((s) => s.submittedPositions);
    const leftTool = useUIStore(selectLeftTool);
    const floatGroup = useUIStore(selectFloatGroup);
    const setLeftTool = useUIStore(selectSetLeftTool);
    const addSelectedTile = useUIStore(selectAddSelectedTile);
    const removeSelectedTile = useUIStore(selectRemoveSelectedTile);
    const selectedTileIds = useUIStore((s) => s.selectedTileIds);
    const clearSelectedTiles = useUIStore(selectClearSelectedTiles);
    const pruneSelectedTiles = useUIStore(selectPruneSelectedTiles);
    const hintsEnabled = useGameStore((s) => s.hintsEnabled);
    const startedTimerRoundRef = useRef<number | null>(null);
    const selectSweepRef = useRef<SelectSweepSession | null>(null);
    const suppressNextSelectClickRef = useRef(false);
    const suppressClearTokenRef = useRef(0);
    const selectSweepHandlersRef = useRef<SelectSweepHandlers>(selectSweepNoopHandlers);
    const rideBrush = useRideBrush(rideSelection, rideOnlyFeedback);
    const { swapPickOverlay, swapOverlayRenderInValidWord, triggerSwapOverlay } = useSwapPickOverlay();
    const { showActiveToolLabel, revealActiveToolLabel, toolExpandedWidths, handToolRef, selectToolRef, moveToolRef, rideToolRef, } = useToolPill();
    const isHighlightWordValid = useCallback((word: {
        valid: boolean;
        word: string;
    }) => {
        if (modeId === 'crosswords')
            return isAcceptedCrosswordsWord(word);
        if (modeId === 'surf-fix')
            return isAcceptedSurfFixWord(word);
        return word.valid && word.word.length >= 2;
    }, [modeId]);
    useWordValidation(isHighlightWordValid);
    const floatSync = useFloatSync({ boardRef, rotateButtonRef, floatOverlayRef, activeDrag });
    const { floatProjection, floatLayout, handleBoardTransformChange, commitFloatIfValid, handleRotateToggle, dragAnchorPosRef, } = floatSync;
    const { activeTile, sensors, collisionDetection, universalModifier, handleDragStart, handleDragMove, handleDragEnd, handleDragCancel } = useDragHandlers({
        boardRef,
        dockRef,
        activeDrag,
        setActiveDrag,
        pickDrawerOpen,
        syncRotateButtonPosition: floatSync.syncRotateButtonPosition,
        syncRotateButtonToViewport: floatSync.syncRotateButtonToViewport,
        collectSelectedMembers: floatSync.collectSelectedMembers,
        validateProjectedBatchMove: floatSync.validateProjectedBatchMove,
        dragAnchorPosRef,
        triggerSwapOverlay,
    });
    const activeHandTileWildcardHint = !!activeTile && isDockWildcardHintEligible({
        modeId,
        wildcardMustBeUsedAsXRound,
        round,
        tile: activeTile,
    });
    const scheduleSuppressedClickClear = useCallback(() => {
        const token = ++suppressClearTokenRef.current;
        window.setTimeout(() => {
            if (suppressClearTokenRef.current !== token)
                return;
            if (selectSweepRef.current)
                return;
            suppressNextSelectClickRef.current = false;
        }, 0);
    }, []);
    const sweepSelectAtPoint = useCallback((clientX: number, clientY: number, seenTileIds: Set<string>, mode: 'add' | 'remove') => {
        const hit = boardRef.current?.cellAt(clientX, clientY);
        if (!hit)
            return;
        const liveBoard = useGameStore.getState().board;
        const cell = liveBoard[hit.row]?.[hit.col];
        if (!cell || cell.kind === 'empty' || !cell.handTileId)
            return;
        if (isFixedPlacedCell(cell))
            return;
        if (seenTileIds.has(cell.handTileId))
            return;
        seenTileIds.add(cell.handTileId);
        if (mode === 'add')
            addSelectedTile(cell.handTileId);
        else
            removeSelectedTile(cell.handTileId);
    }, [addSelectedTile, removeSelectedTile]);
    const handleSelectSweepStart = useCallback((payload: {
        tileId: string;
        pointerId: number;
        clientX: number;
        clientY: number;
    }) => {
        if (leftTool !== 'select')
            return;
        suppressClearTokenRef.current += 1;
        const wasSelected = useUIStore.getState().selectedTileIds.has(payload.tileId);
        const mode: 'add' | 'remove' = wasSelected ? 'remove' : 'add';
        if (mode === 'add')
            addSelectedTile(payload.tileId);
        else
            removeSelectedTile(payload.tileId);
        selectSweepRef.current = {
            pointerId: payload.pointerId,
            startX: payload.clientX,
            startY: payload.clientY,
            moved: false,
            mode,
            seenTileIds: new Set([payload.tileId]),
        };
        suppressNextSelectClickRef.current = true;
    }, [addSelectedTile, leftTool, removeSelectedTile]);
    const consumeSuppressedSelectClick = useCallback(() => {
        if (!suppressNextSelectClickRef.current)
            return false;
        suppressNextSelectClickRef.current = false;
        return true;
    }, []);
    useLayoutEffect(() => {
    selectSweepHandlersRef.current.onTilePointerDown = leftTool === 'ride' ? rideBrush.start : handleSelectSweepStart;
    selectSweepHandlersRef.current.consumeSuppressedClick = leftTool === 'ride' ? rideBrush.consumeClick : consumeSuppressedSelectClick;
    selectSweepHandlersRef.current.toggleTile = (tileId) => rideBrush.toggle(tileId);
    });
    useEffect(() => {
        if (leftTool !== 'select')
            return;
        const onPointerMove = (e: PointerEvent) => {
            const session = selectSweepRef.current;
            if (!session || session.pointerId !== e.pointerId)
                return;
            const dx = e.clientX - session.startX;
            const dy = e.clientY - session.startY;
            const moved = dx * dx + dy * dy >= SELECT_SWEEP_MOVE_SQ;
            if (!session.moved && moved) {
                session.moved = true;
                suppressNextSelectClickRef.current = true;
            }
            if (!session.moved)
                return;
            sweepSelectAtPoint(e.clientX, e.clientY, session.seenTileIds, session.mode);
        };
        const onPointerEnd = (e: PointerEvent) => {
            const session = selectSweepRef.current;
            if (!session || session.pointerId !== e.pointerId)
                return;
            if (session.moved)
                sweepSelectAtPoint(e.clientX, e.clientY, session.seenTileIds, session.mode);
            selectSweepRef.current = null;
            scheduleSuppressedClickClear();
        };
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        window.addEventListener('pointerup', onPointerEnd);
        window.addEventListener('pointercancel', onPointerEnd);
        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerEnd);
            window.removeEventListener('pointercancel', onPointerEnd);
            selectSweepRef.current = null;
            suppressNextSelectClickRef.current = false;
            suppressClearTokenRef.current += 1;
        };
    }, [leftTool, scheduleSuppressedClickClear, sweepSelectAtPoint]);
    useEffect(() => useGameStore.subscribe((state, previous) => {
        if (state.gameOver && !previous.gameOver) setShowGameOver(true);
    }), []);
    useEffect(() => {
        if (!gameOver)
            return;
        clearRoundTimer();
        startedTimerRoundRef.current = null;
    }, [gameOver, clearRoundTimer]);
    useEffect(() => {
        if (timerEnabled)
            return;
        clearRoundTimer();
        startedTimerRoundRef.current = null;
    }, [timerEnabled, clearRoundTimer]);
    useEffect(() => {
        if (!rulesDismissed || !timerEnabled || gameOver)
            return;
        if (startedTimerRoundRef.current === round)
            return;
        startRoundTimer(round);
        startedTimerRoundRef.current = round;
    }, [gameOver, round, rulesDismissed, startRoundTimer, timerEnabled]);
    useEffect(() => {
        if (!rulesDismissed || timerStatus !== 'running' || !roundTimerEndsAt)
            return;
        const timerId = setInterval(() => {
            if (Date.now() < roundTimerEndsAt)
                return;
            expireRoundTimer();
            playTimerEnd();
        }, 1000);
        return () => clearInterval(timerId);
    }, [expireRoundTimer, playTimerEnd, roundTimerEndsAt, rulesDismissed, timerStatus]);
    useEffect(() => {
        if (timerStatus !== 'running' || !roundTimerEndsAt)
            return;
        const warningDelay = roundTimerEndsAt - Date.now() - 60000;
        if (warningDelay < 0)
            return;
        const id = setTimeout(() => playTimerWarning(), warningDelay);
        return () => clearTimeout(id);
    }, [timerStatus, roundTimerEndsAt, playTimerWarning]);
    const openWildcardPicker = useCallback((row: number, col: number) => {
        setWildcardPickerTarget({ source: 'board', row, col });
    }, []);
    const openDockWildcardPicker = useCallback((tileId: string) => {
        setWildcardPickerTarget({ source: 'hand', tileId });
    }, []);
    const handleRulesDismiss = useCallback(() => {
        setTimeout(() => {
            drawHand();
            setRulesDismissed(true);
        }, 500);
    }, [drawHand]);
    const handlePlayAgain = useCallback(() => {
        useGameStore.getState().resetBoard();
        setShowGameOver(false);
        setRulesDismissed(false);
        setRulesModalKey((k) => k + 1);
    }, []);
    useEffect(() => {
        if (selectedTileIds.size === 0)
            return;
        const livingIds = new Set<string>();
        for (const row of board) {
            for (const cell of row) {
                if (cell.kind !== 'empty' && cell.handTileId)
                    livingIds.add(cell.handTileId);
            }
        }
        pruneSelectedTiles(livingIds);
    }, [board, pruneSelectedTiles, selectedTileIds.size]);
    useEffect(() => {
        useGameStore.temporal.getState().clear();
        loadDictionary().catch(() => { useGameStore.setState({ toastMessage: 'Could not load the word list. Please reload to try again.', toastTheme: 'error' }); });
    }, []);
    const isDragging = activeDrag !== null;
    const showBlockedCellHints = isDragging && hintsEnabled;
    const blockedHintIgnoreKeys = useMemo(() => (activeDrag?.source === 'board-group'
        ? new Set(activeDrag.members.map((m) => `${m.fromRow}-${m.fromCol}`))
        : null), [activeDrag]);
    const blockedHintState = useMemo(() => {
        if (!submittedPositions) {
            return { boardForBlocked: board, submittedForBlocked: null as Set<string> | null, ignoreForBlocked: blockedHintIgnoreKeys };
        }
        if (floatProjection &&
            activeDrag?.source !== 'board-group' &&
            floatProjection.moves.length > 0 &&
            floatProjection.moves.every((m) => m.toRow >= 0 && m.toRow < boardRows && m.toCol >= 0 && m.toCol < boardCols)) {
            const nextBoard = board.map((row) => row.slice());
            const nextSubmitted = new Set(submittedPositions);
            for (const move of floatProjection.moves) {
                const fromCell = board[move.fromRow]?.[move.fromCol];
                if (!fromCell || fromCell.kind === 'empty')
                    continue;
                nextBoard[move.fromRow][move.fromCol] = { kind: 'empty' };
            }
            for (const move of floatProjection.moves) {
                const fromCell = board[move.fromRow]?.[move.fromCol];
                if (!fromCell || fromCell.kind === 'empty')
                    continue;
                nextBoard[move.toRow][move.toCol] = fromCell;
                const fromKey = positionKey(move.fromRow, move.fromCol);
                if (!submittedPositions.has(fromKey))
                    continue;
                nextSubmitted.delete(fromKey);
                nextSubmitted.add(positionKey(move.toRow, move.toCol));
            }
            return { boardForBlocked: nextBoard, submittedForBlocked: nextSubmitted, ignoreForBlocked: null };
        }
        return { boardForBlocked: board, submittedForBlocked: submittedPositions, ignoreForBlocked: blockedHintIgnoreKeys };
    }, [activeDrag, blockedHintIgnoreKeys, board, boardCols, boardRows, floatProjection, submittedPositions]);
    const blockedKeys = useMemo(() => {
        if (!shouldShowBlockedAdjacentOverlay(modeId))
            return new Set<string>();
        if (!showBlockedCellHints || !blockedHintState.submittedForBlocked)
            return new Set<string>();
        return getBlockedAdjacentEmptyKeys(blockedHintState.boardForBlocked, blockedHintState.submittedForBlocked, blockedHintState.ignoreForBlocked);
    }, [blockedHintState, modeId, showBlockedCellHints]);
    const validWordKeys = useMemo(() => {
        const keys = new Set<string>();
        if (validPositions)
            for (const key of validPositions)
                keys.add(key);
        if (submittedPositions)
            for (const key of submittedPositions)
                keys.add(key);
        return keys;
    }, [validPositions, submittedPositions]);
    const selectedKeys = useMemo(() => getSelectedPositionKeys(board, selectedTileIds), [board, selectedTileIds]);
    const floatInvalidKeys = useMemo(() => {
        if (!floatProjection || floatProjection.invalidMemberIds.size === 0)
            return new Set<string>();
        return new Set(floatProjection.projected
            .filter((m) => floatProjection.invalidMemberIds.has(m.tileId))
            .map((m) => `${m.row}-${m.col}`));
    }, [floatProjection]);
    const surfFixPrePostHintKeys = useMemo(() => {
        if (rideBrush.endHintKeys)
            return rideBrush.endHintKeys;
        if (modeId !== 'surf-fix' || !hintsEnabled)
            return new Set<string>();
        return getSurfFixPrePostHintKeys({ words: chainWords, rows: boardRows, cols: boardCols });
    }, [boardCols, boardRows, chainWords, hintsEnabled, modeId, rideBrush.endHintKeys]);
    const highlightedPlayedWord = hoveredPlayedWord ?? pinnedPlayedWord;
    const hoveredWordCellKeys = useMemo(() => {
        if (!highlightedPlayedWord || modeId !== 'surf-fix')
            return null;
        const keys = getSurfFixWordHighlightCellKeys({ entry: highlightedPlayedWord, chainWords, board });
        return keys.size > 0 ? keys : null;
    }, [board, chainWords, highlightedPlayedWord, modeId]);
    const mergedInspectedCellKeys = useMemo(() => hoveredWordCellKeys ?? new Set<string>(), [hoveredWordCellKeys]);
    const cellAnnotations = useMemo(() => composeCellAnnotations({
        blockedKeys,
        validWordKeys,
        selectedKeys,
        inspectedKeys: rideSelection && rideBrush.highlightedKeys.size ? rideBrush.highlightedKeys : mergedInspectedCellKeys,
        floatInvalidKeys,
        surfFixPrePostHintKeys,
    }), [blockedKeys, validWordKeys, selectedKeys, mergedInspectedCellKeys, floatInvalidKeys, surfFixPrePostHintKeys, rideSelection, rideBrush.highlightedKeys]);
    const floatHiddenTileIds = useMemo(() => floatGroup
        ? new Set(floatGroup.baseMembers.map((m) => m.tileId))
        : null, [floatGroup]);
    const activeGroupHiddenTileIds = useMemo(() => activeDrag?.source === 'board-group' ? new Set(activeDrag.members.map((m) => m.tileId)) : null, [activeDrag]);
    const hiddenTileIds = useMemo(() => mergeHiddenTileIds(activeGroupHiddenTileIds, floatHiddenTileIds), [activeGroupHiddenTileIds, floatHiddenTileIds]);
    const renderCell = useCallback((row: number, col: number) => {
        return (<DroppableCell row={row} col={col} isDragging={showBlockedCellHints} cellAnnotations={cellAnnotations} hiddenTileIds={hiddenTileIds}/>);
    }, [showBlockedCellHints, cellAnnotations, hiddenTileIds]);
    const handlePlayedWordHover = useCallback((entry: PlayedWordEntry | null) => {
        setHoveredPlayedWord(entry);
    }, []);
    const handlePlayedWordToggle = useCallback((entry: PlayedWordEntry) => {
        setPinnedPlayedWord((current) => current && playedWordEntryIdentity(current) === playedWordEntryIdentity(entry) ? null : entry);
    }, []);
    const viewportPositionStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, height: '100dvh' };
    if (!mounted) {
        return (<div className="game-viewport bg-primary-container/20 h-dvh w-screen" style={viewportPositionStyle}/>);
    }
    return (<WildcardPickerContext.Provider value={openWildcardPicker}>
    <SelectSweepContext.Provider value={selectSweepHandlersRef}>
    <DndContext sensors={sensors} collisionDetection={collisionDetection} modifiers={[universalModifier]} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <div className="game-viewport bg-primary-container/20 flex flex-col relative overflow-hidden h-dvh w-screen" style={{
            ...viewportPositionStyle,
            '--e-tile-bg': '#ffffff',
            '--e-tile-border': '1.5px solid #111',
            '--e-tile-chin': '#111',
            '--e-tile-chin-valid': '#111',
            '--e-tile-letter-color': '#111',
            '--e-tile-letter-valid-color': '#111',
            '--e-pick-tile-bg': '#38bdf8',
            '--e-pick-tile-border': '1.5px solid #111',
            '--e-pick-tile-inset': 'transparent',
            '--e-pick-tile-chin': '#111',
            '--e-pick-tile-chin-valid': '#111',
            '--e-pick-tile-letter-color': '#fff',
            '--e-gloss': 'none',
            '--e-lip-color': '#111',
            '--e-lip-color-valid': '#111',
            '--e-pick-dots-bottom': '5px',
        } as React.CSSProperties}>
        <HudBar onPlayedWordHover={modeId === 'surf-fix' ? handlePlayedWordHover : undefined} onPlayedWordToggle={modeId === 'surf-fix' ? handlePlayedWordToggle : undefined} highlightedPlayedWord={modeId === 'surf-fix' ? highlightedPlayedWord : null}/>
        <GameControls onImport={() => { setShowGameOver(useGameStore.getState().gameOver); setHoveredPlayedWord(null); setPinnedPlayedWord(null); setRulesDismissed(true); startedTimerRoundRef.current = useGameStore.getState().round; }}/>


        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-3" role="radiogroup" aria-label="Board tool selector">
          {([
            { tool: 'select' as const, ref: selectToolRef, icon: <TbHandFinger size={20}/>, label: 'Select tiles', ariaLabel: 'Select tool' },
            { tool: 'move' as const, ref: moveToolRef, icon: <LuMove size={20}/>, label: rideSelection ? 'Move Tiles' : 'Move selection', ariaLabel: 'Move tool' },
            { tool: 'hand' as const, ref: handToolRef, icon: <PiHandGrabbingBold size={20}/>, label: 'Drag tiles', ariaLabel: 'Hand tool' },
            ...(rideSelection ? [{ tool: 'ride' as const, ref: rideToolRef, icon: <IoBrushOutline size={20}/>, label: 'Select Ride', ariaLabel: 'Select Ride' }] : []),
        ] as const).map(({ tool, ref, icon, label, ariaLabel }) => (<Fragment key={tool}>
            {tool === 'ride' && <hr className="w-11 border-0 border-t border-black/25 my-1"/>}
            <motion.button ref={ref} initial={false} animate={{ width: leftTool === tool && showActiveToolLabel ? toolExpandedWidths[tool] : 44 }} transition={{
                width: leftTool === tool && showActiveToolLabel ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                boxShadow: leftTool === tool && showActiveToolLabel ? { duration: 0 } : { duration: 0.15 },
                backgroundColor: leftTool === tool && showActiveToolLabel ? { duration: 0 } : { duration: 0.15 },
            }} type="button" disabled={tool === 'ride' && !rideBrush.available} title={tool === 'ride' ? (rideBrush.available ? 'Brush the complete Ride, including reused tiles' : 'Place new tiles on the board to select a Ride') : undefined} onClick={() => {
                playClick();
                revealActiveToolLabel();
                if (tool !== 'move')
                    commitFloatIfValid();
                const shouldClearSelection = tool === 'hand' ||
                    tool === 'ride' ||
                    (leftTool === 'select' && tool === 'select');
                if (shouldClearSelection)
                    clearSelectedTiles();
                setLeftTool(tool);
                boardRef.current?.resetDoubleTapDetector();
            }} role="radio" aria-checked={leftTool === tool} aria-label={ariaLabel} className="h-11 rounded-full overflow-hidden cursor-pointer active:scale-90 flex items-center disabled:opacity-35 disabled:cursor-not-allowed" style={{
                background: leftTool === tool ? '#fce49a' : '#fff',
                border: '3px solid #111',
                boxShadow: tool === 'ride' && !rideBrush.available ? 'none' : leftTool === tool ? '4px 4px 0 #111' : '3px 3px 0 #111',
                color: '#111',
            }}>
              <span className="w-[38px] h-full shrink-0 flex items-center justify-center pointer-events-none">
                {icon}
              </span>
              <span className="shrink-0 h-full flex items-center pointer-events-none">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wide whitespace-nowrap pr-6">
                  {label}
                </span>
              </span>
            </motion.button>
            </Fragment>))}
        </div>

        <button ref={rotateButtonRef} type="button" onClick={handleRotateToggle} aria-label="Rotate selected tiles" className="fixed z-[45] h-8 w-8 items-center justify-center rounded-full cursor-pointer transition-transform active:scale-90" style={{
            display: 'none',
            background: '#fce49a',
            border: '2px solid #111',
            boxShadow: '2px 2px 0 #111',
            color: '#111',
        }}>
          <FaRotateRight size={12}/>
        </button>

        {floatProjection && floatLayout && activeDrag?.source !== 'board-group' && (<div ref={floatOverlayRef} className="fixed z-[44]" style={{
                display: 'none',
                left: 0,
                top: 0,
                width: floatLayout.spanCols * OVERLAY_TILE,
                height: floatLayout.spanRows * OVERLAY_TILE,
                transformOrigin: 'top left',
                touchAction: 'none',
            }}>
            <FloatGroupOverlay members={floatProjection.projected} invalidMemberIds={floatProjection.invalidMemberIds}/>
          </div>)}

        <BoardDropZone boardRef={boardRef} rows={boardRows} cols={boardCols} renderCell={renderCell} gesturesEnabled={!activeDrag && leftTool !== 'select' && leftTool !== 'ride'} resetViewEnabled={leftTool !== 'select' && leftTool !== 'ride'} onTransformChange={handleBoardTransformChange}/>
        <Dock ref={dockRef} pickDrawerOpen={pickDrawerOpen} variant="editorial" dragDisabled={leftTool !== 'hand'} rideControls={rideSelection ? { hasSelection: rideBrush.hasSelection, applied: rideBrush.applied,
            rideOnlyFeedback,
            bestRideTrial: rideBrush.bestRideTrial, appliedPaths: rideBrush.appliedPaths,
            manualRequired: rideBrush.manualRequired, onDismiss: rideBrush.dismiss, onRestoreAutomatic: rideBrush.restoreAutomatic,
            onChooseRide: rideBrush.choosePrimary,
            selectedTileIds: rideBrush.selectedTileIds,
            onApply: rideBrush.apply, onClear: rideBrush.clear } : undefined} onGameOverClick={() => setShowGameOver(true)} onWildcardTileClick={openDockWildcardPicker}/>

        <AnimatePresence>
          {pickDrawerOpen && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`absolute inset-0 z-[35] sm:hidden ${activeDrag ? 'pointer-events-none' : 'cursor-pointer'}`} style={{ background: 'rgba(0, 0, 0, 0.4)' }} onClick={activeDrag ? undefined : () => setPickDrawerOpen(false)}/>)}
          {timerStatus === 'paused' && (<motion.div key="timer-pause-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[50] pointer-events-auto" style={{ background: 'rgba(0, 0, 0, 0.45)' }}/>)}
        </AnimatePresence>

        {swapPickOverlay && (<div className="pointer-events-none" style={{
                position: 'fixed',
                zIndex: 9998,
                left: swapPickOverlay.left,
                top: swapPickOverlay.top,
                width: 44,
                height: 44,
                transform: `scale(${swapPickOverlay.scale})`,
                transformOrigin: 'top left',
            }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[92%] h-[92%]">
                <RegularTileFace letter={swapPickOverlay.letter} value={LETTER_VALUES[swapPickOverlay.letter]} isPickTile={true} inValidWord={swapOverlayRenderInValidWord}/>
              </div>
            </div>
          </div>)}

        <DragOverlay dropAnimation={null} zIndex={9999}>
          {activeDrag?.source === 'hand' && activeTile ? <DockTileFace tile={activeTile} wildcardHint={activeHandTileWildcardHint}/> : null}
          {activeDrag?.source === 'board' ? <BoardTileOverlay cell={activeDrag.cell}/> : null}
          {activeDrag?.source === 'board-group' ? (<GroupDragOverlay members={activeDrag.members} scale={dragScale}/>) : null}
          {activeDrag?.source === 'pick-drawer' ? (<div className="relative w-11 h-11 select-none">
              <RegularTileFace letter={activeDrag.letter} value={LETTER_VALUES[activeDrag.letter]} isPickTile={true} showDots/>
            </div>) : null}
          {activeDrag?.source === 'double-drawer' ? (<div className="relative w-11 h-11 select-none">
              <RegularTileFace letter={activeDrag.tileId} value={DOUBLE_TILE_BY_ID.get(activeDrag.tileId)?.value ?? 0} isPickTile={false} showDots small/>
            </div>) : null}
          {activeDrag?.source === 'surfboard-drawer' ? (<div className="relative w-11 h-11 select-none">
              <SurfboardOverlayTile />
            </div>) : null}

        </DragOverlay>

        {!rulesDismissed && <RulesModal key={`${modeId}:${rulesModalKey}`} onDismiss={handleRulesDismiss}/>}
        <GameOverModal open={showGameOver} onClose={() => setShowGameOver(false)} onPlayAgain={handlePlayAgain}/>
        {wildcardPickerTarget && (<WildcardLetterModal open target={wildcardPickerTarget} onClose={() => setWildcardPickerTarget(null)}/>)}
    </div>
    </DndContext>
    </SelectSweepContext.Provider>
    </WildcardPickerContext.Provider>);
}
