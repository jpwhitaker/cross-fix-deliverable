'use client';
import { memo, useRef, useState, useEffect, useEffectEvent, useLayoutEffect, useCallback, useMemo, forwardRef, useImperativeHandle, type MouseEvent, type PointerEvent, } from 'react';
import { motion } from 'motion/react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useGameStore, selectHand, selectRound, selectHandVersion, selectGameOver, selectPickTilesUsedForRound, selectDoubleTileUsedForRound, selectDoubleTileIdForRound, selectRemainingDoubleTiles, type BoardCell, type HandTile, } from '@/lib/game-store';
import { LETTER_VALUES, DOUBLE_TILES, lengthPoints } from '@/lib/tiles';
import type { Letter } from '@/lib/tiles';
import { FlipTile } from '@/components/SpringTile';
import { RegularTileFace } from '@/components/RegularTileFace';
import { getMode } from '@/lib/modes/registry';
import { canChooseWildcardLetters, canUseSurfboardTiles } from '@/lib/modes/ui-capabilities';
import type { GameModeId, LengthBonusContext, SubmitResult, SubmitSbsSideContact } from '@/lib/modes/types';
import { getSurfFixReaderPreview } from '@/lib/modes/surf-fix/reader-preview';
import { loadDictionary, extractWords, scoreWord, type ExtractedWord } from '@/lib/dictionary';
import { wordKey } from '@/lib/predicates/submit/identify-ride';
import { getHandWildcardRepresentedLetter, isHandWildcardChoiceTile } from '@/lib/predicates/tiles/wildcard-choice';
import { randomEncouragement } from '@/lib/encouragements';
import WordToast from '@/components/WordToast';
import { useUIStore } from '@/lib/ui-store';
import { FaEye, FaEyeSlash, FaRotateLeft, FaRotateRight } from 'react-icons/fa6';
import { IoBrushOutline } from 'react-icons/io5';
import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { useStore } from 'zustand';
import useSound from 'use-sound';
import SurfboardSVG from '@/public/surf-board5.svg';
import { playedWordEntryIdentity, type PlayedWordEntry } from '@/lib/presentation/round-word-pills';
import { submitRejectionMessage } from '@/lib/presentation/submit-rejection-message';
import { submittedRide } from '@/lib/presentation/submitted-ride';
import { DOCK_SURFACE_ID } from '@/lib/dock-drop-targets';
import { RidePicker } from '@/components/RidePicker';
import type { SurfFixRideOption } from '@/lib/surf-fix-rules/game/transient-projection';
const CELL_SIZE = 33;
const GAP = 4;
const PADDING_X = 12;
const PADDING_Y = 10;
const MAIN_TILE_SIZE = 44;
const MIN_TILE_SIZE = 20;
const DOUBLE_COL_HPAD = 24;
const DOUBLE_WIDEST = 3;
const DOCK_WILDCARD_TAP_DISTANCE_PX = 8;
const SUBMIT_BUTTON_SELECTION_STYLE = {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
} as const;
const PLAY_COLS_MAX = 13;
const DOCK_MAX_WIDTH = DOUBLE_COL_HPAD + DOUBLE_WIDEST * MAIN_TILE_SIZE + (DOUBLE_WIDEST - 1) * GAP
    + 1
    + PADDING_X * 2
    + PLAY_COLS_MAX * MAIN_TILE_SIZE + (PLAY_COLS_MAX - 1) * GAP;
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
type DockPos = {
    row: number;
    col: number;
};
type DockLayout = Map<string, DockPos>;
export type DockHandle = {
    handleTileDrop: (tileId: string, pointerX: number, pointerY: number) => void;
    setDragHover: (tileId: string | null, pointerX?: number, pointerY?: number) => void;
    appendTileToRow: (tileId: string, row: 0 | 1) => void;
    swapTileSlot: (oldTileId: string, newTileId: string) => void;
};
function SurfboardTileFace({ size }: {
    size: number;
}) {
    return (<div className="relative select-none" style={{ width: size, height: size }}>
      <RegularTileFace letter="" value={0} isPickTile={false} showDots={false} fontSize={tileFont(size)}/>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <SurfboardSVG style={{
            width: Math.round(size * 0.72),
            transform: 'rotate(-45deg)',
            transformOrigin: 'center',
        }}/>
      </div>
    </div>);
}
type RidePreviewControls = {
    rideOnlyFeedback?: boolean;
    bestRideTrial?: boolean;
    appliedPaths?: readonly {
        key: string;
        text: string;
    }[];
    manualRequired?: boolean;
    onDismiss?: (pathKey?: string) => void;
    onRestoreAutomatic?: () => void;
    onChooseRide?: (tileIds: readonly string[], boardKey: string) => void;
    rideOptions?: readonly SurfFixRideOption[];
    primaryPathKey?: string;
    hasSelection: boolean;
    applied: boolean;
    selectedTileIds: readonly string[];
    onApply: () => void;
    onClear: () => void;
};
export function ReaderPreviewPill({ text, variant, rideControls, hasAppliedRide }: {
    text: string | null;
    variant: 'default' | 'editorial';
    rideControls?: RidePreviewControls;
    hasAppliedRide: boolean;
}) {
    const needsApply = !!rideControls?.hasSelection && !rideControls.applied;
    if (rideControls?.bestRideTrial) {
        const paths = rideControls.appliedPaths ?? [];
        const removable = (label: string, remove: () => void, key: string, brushed: boolean, primary: boolean) => {
            const choice = rideControls.rideOptions?.find(option => option.key === key);
            return <div key={key} className="flex items-center gap-1">
        {primary && rideControls.onChooseRide
                    ? <RidePicker text={label} pathKey={key} options={rideControls.rideOptions ?? []} applied={brushed} disabled={needsApply} onChoose={rideControls.onChooseRide}/>
                    : !primary && rideControls.onChooseRide
                        ? <button type="button" aria-label={`Make ${label} the Ride`} disabled={needsApply || !choice} onClick={() => {
                                if (choice)
                                    rideControls.onChooseRide?.(choice.tileIds, choice.boardKey);
                            }} className="pointer-events-auto flex min-h-8 max-w-[min(62vw,360px)] items-center gap-1.5 rounded-lg border-2 border-[#111] bg-white px-2.5 font-headline text-xs font-semibold text-[#111] shadow-[2px_2px_0_#111] enabled:cursor-pointer disabled:opacity-60">
              <IoBrushOutline size={14} className="shrink-0" aria-hidden="true"/><span className="truncate">{label}</span>
            </button>
                        : <ReaderPreviewPill text={label} variant={variant} hasAppliedRide={brushed}/>}
        <button type="button" aria-label={`Dismiss ${label}`} onClick={remove} className="pointer-events-auto h-7 w-7 shrink-0 rounded-lg border-2 border-[#111] bg-white text-[#111] cursor-pointer shadow-[2px_2px_0_#111]">×</button>
      </div>;
        };
        return <div className="flex max-w-[min(62vw,360px)] flex-col items-end gap-1" aria-live="polite">
      {paths.map((path, index) => removable(path.text, () => rideControls.onDismiss?.(path.key), path.key, true, index === 0))}
      {needsApply
                ? <ReaderPreviewPill text={text} variant={variant} hasAppliedRide={false} rideControls={{ ...rideControls, bestRideTrial: false }}/>
                : !paths.length && !rideControls.manualRequired && text
                    ? removable(text, () => rideControls.onDismiss?.(), rideControls.primaryPathKey ?? 'automatic', false, true) : null}
      {!paths.length && rideControls.manualRequired && !needsApply && <button type="button" onClick={rideControls.onRestoreAutomatic} className="pointer-events-auto rounded-lg border-2 border-[#111] bg-white px-2.5 py-1 text-xs text-[#111] cursor-pointer">
        Use suggested Ride
      </button>}
    </div>;
    }
    if (!needsApply && !text)
        return null;
    const label = needsApply ? `Apply ${text ?? 'Ride'}` : text;
    const pillClass = 'h-7 max-w-[min(62vw,360px)] px-2.5 flex items-center justify-center gap-1.5 overflow-hidden font-headline text-xs font-semibold tracking-normal';
    const pillStyle = {
        ...(variant === 'editorial' ? {
            background: '#fff',
            border: '2px solid #111',
            borderRadius: 8,
            boxShadow: '2px 2px 0 #111',
            color: '#111',
        } : {
            background: 'rgba(239, 240, 209, 0.82)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(55, 57, 40, 0.22)',
            borderRadius: 8,
            color: 'rgba(55, 57, 40, 0.82)',
        }),
        ...(needsApply ? { background: '#fce49a' } : hasAppliedRide ? { background: '#fff' } : {}),
    };
    const content = <>
    {(needsApply || hasAppliedRide) && <IoBrushOutline size={14} className="shrink-0" aria-hidden="true"/>}
    <span className="truncate">{label}</span>
  </>;
    return (<div className="flex items-center gap-1">
      {needsApply ? <button type="button" onClick={rideControls?.onApply} title={label ?? undefined} className={`${pillClass} pointer-events-auto cursor-pointer`} style={pillStyle}>
        {content}
      </button> : <div aria-live="polite" title={hasAppliedRide ? `Applied Ride: ${text}` : undefined} className={pillClass} style={pillStyle}>{content}</div>}
      {rideControls?.hasSelection && <button type="button" aria-label="Clear Ride selection" title="Clear Ride selection" onClick={rideControls.onClear} className="pointer-events-auto h-7 w-7 shrink-0 rounded-lg border-2 border-[#111] bg-white text-[#111] cursor-pointer shadow-[2px_2px_0_#111]">×</button>}
    </div>);
}
function tileRow(tile: HandTile): 0 | 1 {
    if (tile.kind === 'regular')
        return tile.category === 'vowel' ? 0 : 1;
    if (tile.kind === 'switch')
        return VOWELS.has(tile.sideA.letter) ? 0 : 1;
    return 1;
}
function initLayout(hand: HandTile[], topCols: number, bottomCols: number): DockLayout {
    const layout: DockLayout = new Map();
    const vowels = hand.filter(t => tileRow(t) === 0);
    const consonants = hand.filter(t => tileRow(t) === 1);
    const placeRow = (tiles: HandTile[], row: 0 | 1, nCols: number) => {
        const start = Math.max(0, Math.floor((nCols - tiles.length) / 2));
        tiles.forEach((tile, i) => {
            layout.set(tile.id, { row, col: Math.min(start + i, nCols - 1) });
        });
    };
    placeRow(vowels, 0, topCols);
    placeRow(consonants, 1, bottomCols);
    return layout;
}
function slotIndex(row: number, col: number, topCols: number): number {
    return row === 0 ? col : topCols + col;
}
function cellOf(slot: number, topCols: number, bottomCols: number): DockPos {
    if (slot < topCols)
        return { row: 0, col: slot };
    return { row: 1, col: Math.min(slot - topCols, bottomCols - 1) };
}
export function pushLayout(layout: DockLayout, targetRow: number, targetCol: number, tileId: string, topCols: number, bottomCols: number, hand: HandTile[]): DockLayout {
    const totalSlots = topCols + bottomCols;
    const targetSlot = Math.min(slotIndex(targetRow, targetCol, topCols), totalSlots - 1);
    const slots = collectDockSlotOccupancy(layout, tileId, hand, topCols, bottomCols);
    if (!slots.has(targetSlot)) {
        const next = new Map(layout);
        next.set(tileId, cellOf(targetSlot, topCols, bottomCols));
        return next;
    }
    const emptySlot = chooseDockEmptySlot(slots, targetSlot, totalSlots, topCols);
    if (emptySlot === null) {
        const next = new Map(layout);
        next.set(tileId, cellOf(targetSlot, topCols, bottomCols));
        return next;
    }
    const next = shiftDockSlots(layout, slots, targetSlot, emptySlot, topCols, bottomCols);
    next.set(tileId, cellOf(targetSlot, topCols, bottomCols));
    return next;
}
function collectDockSlotOccupancy(layout: DockLayout, tileId: string, hand: HandTile[], topCols: number, bottomCols: number): Map<number, string> {
    const handIds = new Set(hand.map(t => t.id));
    const slots = new Map<number, string>();
    for (const [id, pos] of layout) {
        if (id === tileId || !handIds.has(id))
            continue;
        const slot = dockSlotForPosition(pos, topCols, bottomCols);
        if (slot !== null)
            slots.set(slot, id);
    }
    return slots;
}
function dockSlotForPosition(pos: DockPos, topCols: number, bottomCols: number): number | null {
    if (pos.row === 0 && pos.col < topCols)
        return slotIndex(0, pos.col, topCols);
    if (pos.row === 1 && pos.col < bottomCols)
        return slotIndex(1, pos.col, topCols);
    return null;
}
function chooseDockEmptySlot(slots: ReadonlyMap<number, string>, targetSlot: number, totalSlots: number, topCols: number): number | null {
    const forwardEmpty = findEmptyDockSlot(slots, targetSlot + 1, totalSlots, 1);
    const backwardEmpty = findEmptyDockSlot(slots, targetSlot - 1, -1, -1);
    if (forwardEmpty === null && backwardEmpty === null)
        return null;
    if (forwardEmpty === null)
        return backwardEmpty;
    if (backwardEmpty === null)
        return forwardEmpty;
    const targetRow = dockSlotRow(targetSlot, topCols);
    const forwardRow = dockSlotRow(forwardEmpty, topCols);
    const backwardRow = dockSlotRow(backwardEmpty, topCols);
    if (forwardRow === targetRow && backwardRow !== targetRow)
        return forwardEmpty;
    if (backwardRow === targetRow && forwardRow !== targetRow)
        return backwardEmpty;
    const forwardDist = forwardEmpty - targetSlot;
    const backwardDist = targetSlot - backwardEmpty;
    return forwardDist < backwardDist ? forwardEmpty : backwardEmpty;
}
function findEmptyDockSlot(slots: ReadonlyMap<number, string>, start: number, stop: number, step: 1 | -1): number | null {
    for (let slot = start; step > 0 ? slot < stop : slot > stop; slot += step) {
        if (!slots.has(slot))
            return slot;
    }
    return null;
}
function dockSlotRow(slot: number, topCols: number): 0 | 1 {
    return slot < topCols ? 0 : 1;
}
function shiftDockSlots(layout: DockLayout, slots: ReadonlyMap<number, string>, targetSlot: number, emptySlot: number, topCols: number, bottomCols: number): DockLayout {
    const next = new Map(layout);
    if (emptySlot > targetSlot) {
        for (let slot = emptySlot; slot > targetSlot; slot--) {
            const id = slots.get(slot - 1);
            if (id)
                next.set(id, cellOf(slot, topCols, bottomCols));
        }
    }
    else {
        for (let slot = emptySlot; slot < targetSlot; slot++) {
            const id = slots.get(slot + 1);
            if (id)
                next.set(id, cellOf(slot, topCols, bottomCols));
        }
    }
    return next;
}
function autoPlaceNew(layout: DockLayout, newTiles: HandTile[], hand: HandTile[], topCols: number, bottomCols: number): DockLayout {
    let current = layout;
    for (const tile of newTiles) {
        const row = tileRow(tile) as 0 | 1;
        const nCols = row === 0 ? topCols : bottomCols;
        const handIds = new Set(hand.map(t => t.id));
        const occupied = new Set([...current.entries()]
            .filter(([id, p]) => handIds.has(id) && p.row === row)
            .map(([, p]) => p.col));
        let col = 0;
        while (occupied.has(col) && col < nCols)
            col++;
        col = Math.min(col, nCols - 1);
        current = new Map(current);
        current.set(tile.id, { row, col });
    }
    return current;
}
export function swapTileSlotInLayout(layout: DockLayout, oldTileId: string, newTileId: string): DockLayout {
    const pos = layout.get(oldTileId);
    if (!pos)
        return layout;
    const next = new Map(layout);
    next.delete(oldTileId);
    next.set(newTileId, pos);
    return next;
}
function computeTargetCell(pointerX: number, pointerY: number, rect: DOMRect, topCols: number, bottomCols: number, cellSize: number): DockPos {
    const relX = pointerX - rect.left;
    const relY = pointerY - rect.top;
    const rowBoundary = PADDING_Y + cellSize + GAP / 2;
    const row: 0 | 1 = relY < rowBoundary ? 0 : 1;
    const nCols = row === 0 ? topCols : bottomCols;
    const innerWidth = rect.width - PADDING_X * 2;
    const rowWidth = nCols * cellSize + (nCols - 1) * GAP;
    const rowLeft = PADDING_X + Math.max(0, (innerWidth - rowWidth) / 2);
    const col = Math.max(0, Math.min(nCols - 1, Math.floor((relX - rowLeft) / (cellSize + GAP))));
    return { row, col };
}
export function DockTileFace({ tile, size = 33, wildcardHint = false }: {
    tile: HandTile;
    size?: number;
    wildcardHint?: boolean;
}) {
    const wildcardLetter = getHandWildcardRepresentedLetter({
        tile,
        modeAllowsWildcardLetters: true,
        forceUseXActive: false,
    });
    return (<div className="relative select-none" style={{ width: size, height: size }}>
      {tile.kind === 'regular'
            ? <RegularTileFace letter={wildcardLetter ?? tile.letter} value={wildcardLetter ? LETTER_VALUES[wildcardLetter] : tile.value} isPickTile={tile.isPickTile} isWildcard={!!wildcardLetter} wildcardHint={!wildcardLetter && wildcardHint} showDots fontSize={tileFont(size)}/>
            : tile.kind === 'double'
                ? <RegularTileFace letter={tile.tileId} value={tile.value} isPickTile={false} showDots small fontSize={tileFont(size, true)}/>
                : tile.kind === 'surfboard'
                    ? <SurfboardTileFace size={size}/>
                    : <FlipTile data={{ sideA: tile.sideA, sideB: tile.sideB }} activeSide={tile.activeSide} showDots fontSize={tileFont(size)} fullSize/>}
    </div>);
}
export function isDockWildcardHintEligible(input: {
    modeId: GameModeId;
    wildcardMustBeUsedAsXRound: number | null;
    round: number;
    tile: HandTile;
}): boolean {
    const { modeId, wildcardMustBeUsedAsXRound, round, tile } = input;
    return (canChooseWildcardLetters(modeId) &&
        wildcardMustBeUsedAsXRound !== round &&
        isHandWildcardChoiceTile(tile) &&
        !getHandWildcardRepresentedLetter({
            tile,
            modeAllowsWildcardLetters: true,
            forceUseXActive: false,
        }));
}
export function isDockWildcardChoiceEligible(input: {
    modeId: GameModeId;
    wildcardMustBeUsedAsXRound: number | null;
    round: number;
    tile: HandTile;
}): boolean {
    const { modeId, wildcardMustBeUsedAsXRound, round, tile } = input;
    return (canChooseWildcardLetters(modeId) &&
        wildcardMustBeUsedAsXRound !== round &&
        isHandWildcardChoiceTile(tile));
}
export type DockSubmitPrecheckDecision = 'score' | 'game-over' | 'reject';
export function decideDockSubmitPrecheck(input: {
    precheck: SubmitResult;
    modeId: GameModeId;
    isLastRound: boolean;
}): DockSubmitPrecheckDecision {
    const { precheck, modeId, isLastRound } = input;
    if (precheck.ok)
        return 'score';
    if (modeId !== 'crosswords' || !isLastRound)
        return 'reject';
    if (precheck.code === 'too-many-fs-words')
        return 'score';
    if (precheck.code === 'no-new-words')
        return 'game-over';
    return 'reject';
}
export function getDockSubmitWords(precheck: SubmitResult, board: BoardCell[][]): ExtractedWord[] {
    return precheck.meta?.words ?? extractWords(board);
}
export function deriveNewValidSubmitWords(input: {
    precheck: SubmitResult;
    words: readonly ExtractedWord[];
    submittedPositions: Set<string> | null;
}): ExtractedWord[] {
    const { precheck, words, submittedPositions } = input;
    return precheck.meta?.newAcceptedWords
        ?? words.filter((w) => w.valid && w.positions.some((p) => !submittedPositions?.has(submitPositionKey(p))));
}
export function collectDockSubmitPositions(words: readonly ExtractedWord[]): Set<string> {
    return new Set(words.flatMap((word) => word.positions.map(submitPositionKey)));
}
export function buildDockSubmitAnimationDelays(words: readonly ExtractedWord[], submittedPositions: Set<string> | null): Map<string, number> {
    const delays = new Map<string, number>();
    for (const word of words) {
        word.positions.forEach((pos, index) => {
            const key = submitPositionKey(pos);
            if (!delays.has(key) && !submittedPositions?.has(key))
                delays.set(key, index);
        });
    }
    return delays;
}
export function collectDockSubmitBentPositions(words: readonly ExtractedWord[] | undefined): Set<string> | undefined {
    if (!words || words.length === 0)
        return undefined;
    return new Set(words.flatMap((word) => word.positions.map(submitPositionKey)));
}
export function scoreDockSubmitWords(input: {
    board: BoardCell[][];
    modeId: GameModeId;
    words: readonly ExtractedWord[];
    currentRound: number;
    rideKey: string | null;
    submittedPositions?: Set<string> | null;
    shouldWordHaveLengthBonus: (wordKey: string, rideKey: string | null, context: LengthBonusContext) => boolean;
}): PlayedWordEntry[] {
    const { board, modeId, words, currentRound, rideKey, submittedPositions = null, shouldWordHaveLengthBonus } = input;
    return words.map((word) => {
        const key = wordKey(word);
        const isSurfFixSbs = modeId === 'surf-fix' && word.letterCount === 2 && !word.valid;
        const withLengthBonus = shouldWordHaveLengthBonus(key, rideKey, {
            board,
            word,
            submittedPositions,
        });
        const value = scoreWord(board, word, false);
        const length = withLengthBonus ? lengthPoints(word.letterCount) : 0;
        const points = modeId !== 'keiki-play' && word.letterCount === 2
            ? 0
            : value + length;
        return {
            word: word.word,
            points,
            round: currentRound,
            scoreParts: {
                value: points === 0 ? 0 : value,
                length: points === 0 ? 0 : length,
            },
            role: isSurfFixSbs ? 'sbs' : rideKey && key === rideKey ? 'ride' : 'extra',
        };
    });
}
export function buildDockSbsLogEntries(input: {
    contacts?: readonly SubmitSbsSideContact[];
    currentRound: number;
    existingEntries?: readonly PlayedWordEntry[];
}): PlayedWordEntry[] {
    const { contacts = [], currentRound, existingEntries = [] } = input;
    const seen = new Set(existingEntries.map(playedWordEntryIdentity));
    const entries: PlayedWordEntry[] = [];
    for (const contact of contacts) {
        const value = contact.valuePoints ?? 0;
        const entry: PlayedWordEntry = {
            word: contact.word,
            points: value,
            round: currentRound,
            scoreParts: { value, length: 0 },
            role: 'sbs',
            highlightTileIds: [...contact.tileIds],
            highlightPositions: contact.positions.map((pos) => ({ ...pos })),
        };
        const key = playedWordEntryIdentity(entry);
        if (seen.has(key))
            continue;
        seen.add(key);
        entries.push(entry);
    }
    return entries;
}
function submitPositionKey(pos: {
    row: number;
    col: number;
}): string {
    return `${pos.row}-${pos.col}`;
}
const DraggableDockTile = memo(function DraggableDockTile({ tile, isNew, staggerDelay = 0, size = 33, showDots = true, dragDisabled = false, wildcardHint = false, onWildcardTileClick, }: {
    tile: HandTile;
    isNew: boolean;
    staggerDelay?: number;
    size?: number;
    showDots?: boolean;
    dragDisabled?: boolean;
    wildcardHint?: boolean;
    onWildcardTileClick?: (tileId: string) => void;
}) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: tile.id,
        data: { tile },
        disabled: dragDisabled,
    });
    const rotateHandTile = useGameStore((s) => s.rotateHandTile);
    const delaySec = staggerDelay / 1000;
    const wildcardLetter = getHandWildcardRepresentedLetter({
        tile,
        modeAllowsWildcardLetters: true,
        forceUseXActive: false,
    });
    const tapStartRef = useRef<{
        x: number;
        y: number;
    } | null>(null);
    const suppressNextClickRef = useRef(false);
    const canOpenWildcardPicker = !!onWildcardTileClick;
    const isTapFromStart = useCallback((clientX: number, clientY: number) => {
        const start = tapStartRef.current;
        if (!start)
            return true;
        return Math.hypot(clientX - start.x, clientY - start.y) <= DOCK_WILDCARD_TAP_DISTANCE_PX;
    }, []);
    const handlePointerDownCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
        if (!canOpenWildcardPicker)
            return;
        tapStartRef.current = { x: event.clientX, y: event.clientY };
    }, [canOpenWildcardPicker]);
    const handlePointerUpCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
        if (!canOpenWildcardPicker || event.pointerType !== 'pen')
            return;
        if (!isTapFromStart(event.clientX, event.clientY))
            return;
        suppressNextClickRef.current = true;
        tapStartRef.current = null;
        window.setTimeout(() => onWildcardTileClick?.(tile.id), 0);
    }, [canOpenWildcardPicker, isTapFromStart, onWildcardTileClick, tile.id]);
    const handleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
        if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (!canOpenWildcardPicker)
            return;
        if (!isTapFromStart(event.clientX, event.clientY)) {
            tapStartRef.current = null;
            return;
        }
        event.stopPropagation();
        tapStartRef.current = null;
        onWildcardTileClick?.(tile.id);
    }, [canOpenWildcardPicker, isTapFromStart, onWildcardTileClick, tile.id]);
    const isBoardReturn = tile.origin === 'board';
    const [boardReturnAnimating, setBoardReturnAnimating] = useState(() => isBoardReturn);
    return (<motion.div ref={setNodeRef} data-draggable layoutId={tile.id} className={`relative select-none ${dragDisabled ? (canOpenWildcardPicker ? 'cursor-pointer' : 'cursor-default') : `touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}`} style={{ width: size, height: size }} initial={isNew ? { opacity: 0, y: 90, x: 28 } : false} animate={{ opacity: isDragging ? 0.3 : 1, y: 0, x: 0 }} transition={{
            y: isNew ? { type: 'spring', stiffness: 260, damping: 22, delay: delaySec } : { duration: 0 },
            x: isNew ? { type: 'spring', stiffness: 260, damping: 22, delay: delaySec } : { duration: 0 },
            opacity: isNew ? { duration: 0.22, delay: delaySec } : { duration: 0.1 },
            layout: boardReturnAnimating ? { type: 'spring', stiffness: 260, damping: 28 } : { duration: 0 },
        }} onLayoutAnimationComplete={() => setBoardReturnAnimating(false)} onPointerDownCapture={handlePointerDownCapture} onPointerUpCapture={handlePointerUpCapture} {...attributes} {...listeners} onClick={handleClick}>
      {tile.kind === 'regular'
            ? <RegularTileFace letter={wildcardLetter ?? tile.letter} value={wildcardLetter ? LETTER_VALUES[wildcardLetter] : tile.value} isPickTile={tile.isPickTile} isWildcard={!!wildcardLetter} wildcardHint={!wildcardLetter && wildcardHint} showDots={showDots} fontSize={tileFont(size)}/>
            : tile.kind === 'double'
                ? <RegularTileFace letter={tile.tileId} value={tile.value} isPickTile={false} showDots={showDots} small fontSize={tileFont(size, true)}/>
                : tile.kind === 'surfboard'
                    ? <SurfboardTileFace size={size}/>
                    : <FlipTile data={{ sideA: tile.sideA, sideB: tile.sideB }} activeSide={tile.activeSide} onRotate={() => rotateHandTile(tile.id)} showDots={showDots} fontSize={tileFont(size)} fullSize/>}
    </motion.div>);
});
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as Letter[];
const tileFont = (size: number, small = false) => Math.max(small ? 8 : 10, Math.round(size * (small ? 0.454 : 0.545)));
function PickBarTile({ letter, usedCount, anyUsed, roundLimitReached, onTap, onReturn, size, showDots = true, dragDisabled = false }: {
    letter: Letter;
    usedCount: number;
    anyUsed: boolean;
    roundLimitReached: boolean;
    onTap: () => void;
    onReturn?: () => void;
    size: number;
    showDots?: boolean;
    dragDisabled?: boolean;
}) {
    const isThisLetterUsed = usedCount > 0;
    const canReturn = isThisLetterUsed && !!onReturn;
    const canTap = canReturn || !roundLimitReached;
    const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
        id: `pick-drawer-${letter}`,
        data: { source: 'pick-drawer', letter },
        disabled: roundLimitReached || dragDisabled,
    });
    const opacity = isDragging ? 0.3 : (anyUsed ? (isThisLetterUsed ? 0.5 : 0.3) : 1);
    return (<div ref={setNodeRef} {...attributes} {...listeners} onClick={canReturn ? onReturn : roundLimitReached ? undefined : onTap} aria-label={`${canReturn ? 'Return' : 'Add'} pick tile ${letter}`} className={`relative flex-shrink-0 select-none touch-none ${dragDisabled
            ? (canTap ? 'cursor-pointer' : 'cursor-default')
            : canReturn
                ? 'cursor-pointer'
                : (isDragging ? 'cursor-grabbing' : 'cursor-grab')}`} style={{ opacity, width: size, height: size }}>
      <RegularTileFace letter={letter} value={LETTER_VALUES[letter]} isPickTile={true} showDots={showDots} fontSize={tileFont(size)}/>
      {isThisLetterUsed && (<div className="absolute inset-0 z-30 flex items-center justify-center rounded-[0.5rem] pointer-events-none" style={{ background: 'rgba(55, 57, 40, 0.05)' }}>
          <span className="text-[8px] font-bold uppercase tracking-tighter px-1 py-0.5 rounded-sm" style={{ background: 'rgba(55, 57, 40, 0.8)', color: '#fbfbe0', transform: 'rotate(-12deg)' }}>
            {usedCount > 1 ? `used×${usedCount}` : 'used'}
          </span>
        </div>)}
    </div>);
}
function DoubleBarTile({ tileId, value, usedTileId, roundLimitReached, isPermanentlyGone, onTap, onReturn, size, showDots = true, dragDisabled = false }: {
    tileId: string;
    value: number;
    usedTileId: string | null;
    roundLimitReached: boolean;
    isPermanentlyGone: boolean;
    onTap: () => void;
    onReturn?: () => void;
    size: number;
    showDots?: boolean;
    dragDisabled?: boolean;
}) {
    const isThisTileUsed = usedTileId === tileId;
    const canReturn = isThisTileUsed && !!onReturn;
    const disabled = (roundLimitReached || isPermanentlyGone) && !canReturn;
    const canTap = canReturn || !disabled;
    const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
        id: `double-drawer-${tileId}`,
        data: { source: 'double-drawer', tileId },
        disabled: roundLimitReached || isPermanentlyGone || dragDisabled,
    });
    const opacity = isDragging ? 0.3 : (isPermanentlyGone ? 0.2 : (usedTileId ? (isThisTileUsed ? 0.5 : 0.3) : 1));
    return (<div ref={setNodeRef} {...attributes} {...listeners} onClick={canReturn ? onReturn : disabled ? undefined : onTap} aria-label={`${canReturn ? 'Return' : 'Add'} double tile ${tileId}`} className={`relative flex-shrink-0 select-none touch-none ${dragDisabled
            ? (canTap ? 'cursor-pointer' : 'cursor-default')
            : canReturn
                ? 'cursor-pointer'
                : (isDragging ? 'cursor-grabbing' : 'cursor-grab')}`} style={{ opacity, width: size, height: size }}>
      <RegularTileFace letter={tileId} value={value} isPickTile={false} showDots={showDots} small fontSize={tileFont(size, true)}/>
      {isThisTileUsed && (<div className="absolute inset-0 z-30 flex items-center justify-center rounded-[0.5rem] pointer-events-none" style={{ background: 'rgba(55, 57, 40, 0.05)' }}>
          <span className="text-[8px] font-bold uppercase tracking-tighter px-1 py-0.5 rounded-sm" style={{ background: 'rgba(55, 57, 40, 0.8)', color: '#fbfbe0', transform: 'rotate(-12deg)' }}>
            used
          </span>
        </div>)}
    </div>);
}
function SurfboardBarTile({ inHand, onTap, size, dragDisabled = false, }: {
    inHand: boolean;
    onTap: () => void;
    size: number;
    dragDisabled?: boolean;
}) {
    const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
        id: 'surfboard-drawer',
        data: { source: 'surfboard-drawer' },
        disabled: inHand || dragDisabled,
    });
    const opacity = isDragging ? 0.3 : (inHand ? 0.4 : 1);
    return (<div ref={setNodeRef} {...attributes} {...listeners} onClick={inHand ? undefined : onTap} className={`relative flex-shrink-0 select-none touch-none ${dragDisabled
            ? (!inHand ? 'cursor-pointer' : 'cursor-default')
            : (isDragging ? 'cursor-grabbing' : 'cursor-grab')}`} style={{ width: size, height: size, opacity }}>
      <RegularTileFace letter="" value={0} isPickTile={false} showDots={false} fontSize={tileFont(size)}/>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <SurfboardSVG style={{
            width: Math.round(size * 0.72),
            transform: 'rotate(-45deg)',
            transformOrigin: 'center',
        }}/>
      </div>
    </div>);
}
const Dock = forwardRef<DockHandle, {
    pickDrawerOpen?: boolean;
    variant?: 'default' | 'editorial';
    dragDisabled?: boolean;
    rideControls?: RidePreviewControls;
    onGameOverClick?: () => void;
    onWildcardTileClick?: (tileId: string) => void;
}>(function Dock({ variant = 'default', dragDisabled = false, rideControls, onGameOverClick, onWildcardTileClick }, ref) {
    const hand = useGameStore(selectHand);
    const round = useGameStore(selectRound);
    const handVersion = useGameStore(selectHandVersion);
    const gameOver = useGameStore(selectGameOver);
    const toastMessageStore = useGameStore((s) => s.toastMessage);
    const toastThemeStore = useGameStore((s) => s.toastTheme);
    const pendingRerun = useGameStore((s) => s.pendingRerun);
    const triggerRerun = useGameStore((s) => s.triggerRerun);
    const rerunLabel = pendingRerun
        ? `${pendingRerun.reason === 'RIPPLES' ? 'Ripples' : pendingRerun.reason === 'ANKLE_BITERS' ? 'Ankle Biters' : 'Choppy Waters'}: Rerun`
        : 'Rerun';
    const modeId = useGameStore((s) => s.modeId);
    const hintsEnabled = useGameStore((s) => s.hintsEnabled);
    const canUndo = useStore(useGameStore.temporal, (s) => s.pastStates.length > 0);
    const canRedo = useStore(useGameStore.temporal, (s) => s.futureStates.length > 0);
    const acceptSubmission = useGameStore((s) => s.acceptSubmission);
    const isLastRound = round >= getMode(modeId).getRoundConfig(round).totalRounds;
    const pickTilesUsedForRound = useGameStore(selectPickTilesUsedForRound);
    const board = useGameStore((s) => s.board);
    const submittedPositions = useGameStore((s) => s.submittedPositions);
    const doubleTileUsedForRound = useGameStore(selectDoubleTileUsedForRound);
    const doubleTileIdForRound = useGameStore(selectDoubleTileIdForRound);
    const remainingDoubleTiles = useGameStore(selectRemainingDoubleTiles);
    const wildcardMustBeUsedAsXRound = useGameStore((s) => s.wildcardMustBeUsedAsXRound);
    const addPickTile = useGameStore((s) => s.addPickTile);
    const addDoubleTile = useGameStore((s) => s.addDoubleTile);
    const addSurfboardTile = useGameStore((s) => s.addSurfboardTile);
    const returnPickTile = useGameStore((s) => s.returnPickTile);
    const returnDoubleTile = useGameStore((s) => s.returnDoubleTile);
    const pickLimitForRound = getMode(modeId).getRoundConfig(round).pickTiles;
    const pickRoundLimitReached = pickTilesUsedForRound >= pickLimitForRound;
    const usedPickTilesByLetter = useMemo(() => {
        const counts = new Map<Letter, number>();
        for (const tile of hand) {
            if (tile.kind !== 'regular' || !tile.isPickTile)
                continue;
            counts.set(tile.letter, (counts.get(tile.letter) ?? 0) + 1);
        }
        for (let r = 0; r < board.length; r++) {
            for (let c = 0; c < board[r].length; c++) {
                const cell = board[r][c];
                if (cell.kind !== 'regular' || !cell.isPickTile || cell.origin !== 'placed')
                    continue;
                if (submittedPositions?.has(`${r}-${c}`))
                    continue;
                counts.set(cell.letter, (counts.get(cell.letter) ?? 0) + 1);
            }
        }
        return counts;
    }, [hand, board, submittedPositions]);
    const chainWords = useGameStore((s) => s.chainWords);
    const rideClaim = useGameStore((s) => s.rideClaim);
    const authoring = useGameStore((s) => s.authoring);
    const hasUnappliedRideSelection = !!rideControls?.hasSelection && !rideControls.applied;
    const draftRideTileIds = hasUnappliedRideSelection ? rideControls?.selectedTileIds : undefined;
    const rideOnlyFeedback = rideControls?.rideOnlyFeedback === true;
    const includeRideOptions = !!rideControls?.bestRideTrial && !draftRideTileIds && !rideControls.manualRequired;
    const readerPreview = useMemo(() => {
        if (modeId !== 'surf-fix' || gameOver)
            return null;
        return getSurfFixReaderPreview({
            board,
            submittedPositions,
            chainWords,
            rideClaim,
            authoring,
            selectedTileIds: draftRideTileIds,
            includeRideOptions,
        }, rideOnlyFeedback ? 'ride-only' : 'all-reads');
    }, [modeId, gameOver, board, submittedPositions, chainWords, rideClaim, authoring, draftRideTileIds, rideOnlyFeedback, includeRideOptions]);
    const readerPreviewText = readerPreview?.text ?? null;
    const previewControls = rideControls ? { ...rideControls, rideOptions: readerPreview?.rideOptions,
        primaryPathKey: readerPreview?.tileIds.join('|') } : undefined;
    const isWildcardHintEligible = useCallback((tile: HandTile) => (isDockWildcardHintEligible({
        modeId,
        wildcardMustBeUsedAsXRound,
        round,
        tile,
    })), [modeId, wildcardMustBeUsedAsXRound, round]);
    const isWildcardChoiceEligible = useCallback((tile: HandTile) => (isDockWildcardChoiceEligible({
        modeId,
        wildcardMustBeUsedAsXRound,
        round,
        tile,
    })), [modeId, wildcardMustBeUsedAsXRound, round]);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastTheme, setToastTheme] = useState<'default' | 'success' | 'rerun' | 'error'>('default');
    const [toastKey, setToastKey] = useState(0);
    const prevRoundRef = useRef<number | null>(null);
    const mounted = useRef(false);
    const submitTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
    useEffect(() => {
        mounted.current = true;
        const timers = submitTimers.current;
        return () => {
            mounted.current = false;
            timers.forEach(clearTimeout);
            timers.clear();
        };
    }, []);
    const afterSubmit = useCallback((callback: () => void, delay: number) => {
        const timer = setTimeout(() => {
            submitTimers.current.delete(timer);
            if (mounted.current)
                callback();
        }, delay);
        submitTimers.current.add(timer);
    }, []);
    const showToast = useCallback((msg: string, theme: 'default' | 'success' | 'rerun' | 'error' = 'default') => {
        setToastKey(k => k + 1);
        setToastTheme(theme);
        setToastMessage(msg);
    }, []);
    useEffect(() => {
        if (toastMessageStore) {
            showToast(toastMessageStore, toastThemeStore);
            useGameStore.setState({ toastMessage: null });
        }
    }, [toastMessageStore, toastThemeStore, showToast]);
    useEffect(() => {
        const prevRound = prevRoundRef.current;
        if ((modeId === 'crosswords' || modeId === 'surf-fix') && prevRound !== null && prevRound < 13 && round === 13) {
            showToast('Rounds 13-16 require 3 pick tiles.');
        }
        prevRoundRef.current = round;
    }, [modeId, round, showToast]);
    useEffect(() => {
        if (modeId === 'crosswords' || modeId === 'surf-fix')
            return;
        prevRoundRef.current = null;
    }, [modeId]);
    const [topCols, setTopCols] = useState(8);
    const [bottomCols, setBottomCols] = useState(7);
    const [dockLayout, setDockLayout] = useState<DockLayout>(() => initLayout(hand, 8, 7));
    const [newTileIds, setNewTileIds] = useState<Set<string>>(new Set());
    const staggerMap = useMemo(() => {
        if (newTileIds.size === 0)
            return new Map<string, number>();
        const sorted = hand
            .filter(t => newTileIds.has(t.id))
            .map(t => ({ id: t.id, pos: dockLayout.get(t.id) ?? { row: 0, col: 0 } }))
            .sort((a, b) => a.pos.row !== b.pos.row ? a.pos.row - b.pos.row : a.pos.col - b.pos.col);
        return new Map(sorted.map((t, i) => [t.id, i]));
    }, [newTileIds, hand, dockLayout]);
    const [hoverCell, setHoverCell] = useState<DockPos | null>(null);
    const [hoverId, setHoverId] = useState<string | null>(null);
    const [liveLayout, setLiveLayout] = useState<DockLayout | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const outerDockRef = useRef<HTMLDivElement>(null);
    const colsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [pickTileSize, setPickTileSize] = useState(33);
    const [playTileSize, setPlayTileSize] = useState(CELL_SIZE);
    const [doubleTileSize, setDoubleTileSize] = useState(MAIN_TILE_SIZE);
    const [dockWidth, setDockWidth] = useState(0);
    const [expandedSection, setExpandedSection] = useState<'letters' | 'pick' | 'double' | 'play' | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    useLayoutEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);
    const playTileSizeRef = useRef(CELL_SIZE);
    const colsRef = useRef({ topCols: 8, bottomCols: 7 });
    const handRef = useRef(hand);
    const dockLayoutRef = useRef(dockLayout);
    const hoverIdRef = useRef<string | null>(null);
    const liveLayoutRef = useRef<DockLayout | null>(null);
    const lastHoverCellRef = useRef<DockPos | null>(null);
    const [playClick] = useSound('/sounds/ui-click.wav');
    const [playDeal] = useSound('/sounds/ui-deal.wav');
    const [playSuccess] = useSound('/sounds/ui-success.wav');
    const [playError] = useSound('/sounds/ui-error.wav');
    const [playPickUp] = useSound('/sounds/pop_up.mp3');
    const { setNodeRef: setDockDropRef } = useDroppable({ id: 'dock-zone' });
    const returnData = {};
    const { setNodeRef: setDockSurfaceRef } = useDroppable({ id: DOCK_SURFACE_ID, data: returnData });
    const { setNodeRef: setPickReturnRef } = useDroppable({ id: 'pick-drawer-zone', data: returnData });
    const { setNodeRef: setDoubleReturnRef } = useDroppable({ id: 'double-return-zone', data: returnData });
    const setOuterRef = useCallback((el: HTMLDivElement | null) => {
        outerDockRef.current = el;
        setDockSurfaceRef(el);
    }, [setDockSurfaceRef]);
    const setRef = useCallback((el: HTMLDivElement | null) => {
        containerRef.current = el;
        setDockDropRef(el);
    }, [setDockDropRef]);
    useEffect(() => { handRef.current = hand; }, [hand]);
    useEffect(() => { colsRef.current = { topCols, bottomCols }; }, [topCols, bottomCols]);
    useEffect(() => { dockLayoutRef.current = dockLayout; }, [dockLayout]);
    useEffect(() => { liveLayoutRef.current = liveLayout; }, [liveLayout]);
    const resetDockLayoutFromStoreHand = useCallback(() => {
        const { topCols: tc, bottomCols: bc } = colsRef.current;
        const currentHand = useGameStore.getState().hand;
        setDockLayout(initLayout(currentHand, tc, bc));
        setHoverCell(null);
        setHoverId(null);
        hoverIdRef.current = null;
        lastHoverCellRef.current = null;
        liveLayoutRef.current = null;
        setLiveLayout(null);
    }, []);
    const handleUndo = useCallback(() => {
        playClick();
        const before = useGameStore.getState();
        useGameStore.temporal.getState().undo();
        const after = useGameStore.getState();
        if (!before.pendingRerun && !!after.pendingRerun) {
            resetDockLayoutFromStoreHand();
        }
    }, [playClick, resetDockLayoutFromStoreHand]);
    const handleRedo = useCallback(() => {
        playClick();
        const before = useGameStore.getState();
        useGameStore.temporal.getState().redo();
        const after = useGameStore.getState();
        if (!!before.pendingRerun && !after.pendingRerun) {
            resetDockLayoutFromStoreHand();
        }
    }, [playClick, resetDockLayoutFromStoreHand]);
    const applySizes = useCallback((dockW: number, immediate = false) => {
        if (!dockW)
            return;
        setDockWidth(dockW);
        const PICK_HPAD = 24, PICK_GAP = 4, PICK_PER_ROW = 13;
        const tileSize = Math.max(MIN_TILE_SIZE, Math.min(MAIN_TILE_SIZE, Math.floor((dockW - PICK_HPAD - PICK_GAP * (PICK_PER_ROW - 1)) / PICK_PER_ROW)));
        setPickTileSize(tileSize);
        setDoubleTileSize(tileSize);
        setPlayTileSize(tileSize);
        playTileSizeRef.current = tileSize;
        const updateCols = () => {
            const topCount = handRef.current.filter(t => tileRow(t) === 0).length;
            const bottomCount = handRef.current.filter(t => tileRow(t) === 1).length;
            const doubleColW = DOUBLE_COL_HPAD + DOUBLE_WIDEST * tileSize + (DOUBLE_WIDEST - 1) * GAP;
            const playWidth = dockW - doubleColW - 1;
            const colsAtSize = Math.max(1, Math.floor((playWidth - PADDING_X * 2 + GAP) / (tileSize + GAP)));
            const makeEvenExtra = (cols: number, count: number) => (cols - count) % 2 === 0 ? cols : cols - 1;
            const tc = makeEvenExtra(Math.max(colsAtSize, Math.max(4, topCount + 4)), topCount);
            const bc = makeEvenExtra(Math.max(colsAtSize, Math.max(4, bottomCount + 4)), bottomCount);
            setTopCols(tc);
            setBottomCols(bc);
            colsRef.current = { topCols: tc, bottomCols: bc };
            if (!immediate)
                setDockLayout(initLayout(handRef.current, tc, bc));
        };
        if (immediate) {
            if (colsTimerRef.current)
                clearTimeout(colsTimerRef.current);
            updateCols();
        }
        else {
            if (colsTimerRef.current)
                clearTimeout(colsTimerRef.current);
            colsTimerRef.current = setTimeout(updateCols, 150);
        }
    }, []);
    useLayoutEffect(() => {
        if (outerDockRef.current)
            applySizes(outerDockRef.current.clientWidth, true);
        const observer = new ResizeObserver(() => {
            if (outerDockRef.current)
                applySizes(outerDockRef.current.clientWidth);
        });
        if (outerDockRef.current)
            observer.observe(outerDockRef.current);
        return () => {
            observer.disconnect();
            if (colsTimerRef.current)
                clearTimeout(colsTimerRef.current);
        };
    }, [applySizes]);
    const prevVersionRef = useRef(-1);
    useEffect(() => {
        prevVersionRef.current = handVersion;
        if (outerDockRef.current)
            applySizes(outerDockRef.current.clientWidth, true);
        const { topCols: tc, bottomCols: bc } = colsRef.current;
        const currentHand = handRef.current;
        const newLayout = initLayout(currentHand, tc, bc);
        setDockLayout(newLayout);
        setNewTileIds(new Set(currentHand.map(t => t.id)));
        const timer = setTimeout(() => setNewTileIds(new Set()), 500);
        return () => clearTimeout(timer);
    }, [handVersion, applySizes]);
    const prevHandRef = useRef(hand);
    useEffect(() => {
        const prev = prevHandRef.current;
        prevHandRef.current = hand;
        if (handVersion !== prevVersionRef.current)
            return;
        const newTiles = hand.filter(t => !prev.some(p => p.id === t.id));
        if (newTiles.length === 0)
            return;
        const flyInTiles = newTiles.filter(t => t.origin === 'drawer');
        setDockLayout(layout => {
            const unplaced = newTiles.filter(t => !layout.has(t.id));
            if (unplaced.length === 0)
                return layout;
            return autoPlaceNew(layout, unplaced, hand, topCols, bottomCols);
        });
        if (flyInTiles.length > 0) {
            setNewTileIds(ids => {
                const next = new Set(ids);
                flyInTiles.forEach(t => next.add(t.id));
                setTimeout(() => setNewTileIds(s => {
                    const n = new Set(s);
                    flyInTiles.forEach(t => n.delete(t.id));
                    return n;
                }), 500);
                return next;
            });
        }
    }, [hand, handVersion, topCols, bottomCols]);
    const prevVersionSoundRef = useRef(-1);
    const prevHandLenRef = useRef(hand.length);
    const carryRef = useRef(hand.length);
    const isNewDraw = handVersion !== prevVersionSoundRef.current;
    if (isNewDraw) {
        carryRef.current = prevHandLenRef.current;
        prevVersionSoundRef.current = handVersion;
    }
    prevHandLenRef.current = hand.length;
    const carryCount = carryRef.current;
    const playDrawSound = useEffectEvent(() => {
        const newCount = hand.length - carryCount;
        if (newCount <= 0)
            return;
        const soundCount = Math.ceil(newCount / 2);
        const timers: ReturnType<typeof setTimeout>[] = [];
        for (let i = 0; i < soundCount; i++) {
            timers.push(setTimeout(() => playDeal(), i * 120));
        }
        return () => timers.forEach(clearTimeout);
    });
    useEffect(() => playDrawSound(), [handVersion]);
    useImperativeHandle(ref, () => ({
        handleTileDrop: (tileId, pointerX, pointerY) => {
            if (!containerRef.current)
                return;
            const rect = containerRef.current.getBoundingClientRect();
            const { topCols: tc, bottomCols: bc } = colsRef.current;
            const { row, col } = computeTargetCell(pointerX, pointerY, rect, tc, bc, playTileSizeRef.current);
            const live = liveLayoutRef.current;
            if (live) {
                const dropCell = lastHoverCellRef.current ?? { row, col };
                const next = new Map(live);
                next.set(tileId, dropCell);
                setDockLayout(next);
            }
            else {
                setDockLayout(prev => pushLayout(prev, row, col, tileId, tc, bc, handRef.current));
            }
            setHoverCell(null);
            setHoverId(null);
            hoverIdRef.current = null;
            lastHoverCellRef.current = null;
            liveLayoutRef.current = null;
            setLiveLayout(null);
        },
        setDragHover: (tileId, pointerX, pointerY) => {
            if (!tileId || pointerX === undefined || pointerY === undefined) {
                setHoverCell(null);
                setHoverId(null);
                hoverIdRef.current = null;
                setLiveLayout(null);
                return;
            }
            if (!containerRef.current)
                return;
            const rect = containerRef.current.getBoundingClientRect();
            const { topCols: tc, bottomCols: bc } = colsRef.current;
            const cell = computeTargetCell(pointerX, pointerY, rect, tc, bc, playTileSizeRef.current);
            const isNewDrag = tileId !== hoverIdRef.current;
            if (isNewDrag) {
                const initial = new Map(dockLayoutRef.current);
                initial.delete(tileId);
                liveLayoutRef.current = initial;
                setLiveLayout(initial);
                const originPos = dockLayoutRef.current.get(tileId);
                lastHoverCellRef.current = originPos ?? null;
                hoverIdRef.current = tileId;
            }
            const prevCell = lastHoverCellRef.current;
            const live = liveLayoutRef.current!;
            if (!prevCell || cell.row !== prevCell.row) {
                const base = new Map(dockLayoutRef.current);
                base.delete(tileId);
                const pushed = pushLayout(base, cell.row, cell.col, tileId, tc, bc, handRef.current);
                liveLayoutRef.current = pushed;
                setLiveLayout(pushed);
            }
            else if (cell.col !== prevCell.col) {
                let tileAtNew: string | undefined;
                for (const [id, pos] of live) {
                    if (id === tileId)
                        continue;
                    if (pos.row === cell.row && pos.col === cell.col) {
                        tileAtNew = id;
                        break;
                    }
                }
                if (tileAtNew) {
                    const next = new Map(live);
                    next.set(tileAtNew, prevCell);
                    liveLayoutRef.current = next;
                    setLiveLayout(next);
                }
            }
            lastHoverCellRef.current = cell;
            setHoverCell(cell);
            setHoverId(tileId);
        },
        appendTileToRow: (tileId, row) => {
            const { topCols, bottomCols } = colsRef.current;
            const nCols = row === 0 ? topCols : bottomCols;
            const layout = dockLayoutRef.current;
            const handIds = new Set(handRef.current.map(t => t.id));
            const occupied = new Set<number>();
            for (const [id, pos] of layout) {
                if (id === tileId || !handIds.has(id))
                    continue;
                if (pos.row === row)
                    occupied.add(pos.col);
            }
            const maxCol = occupied.size > 0 ? Math.max(...occupied) : -1;
            let col = maxCol + 1;
            if (col >= nCols) {
                const minCol = occupied.size > 0 ? Math.min(...occupied) : nCols;
                col = minCol - 1;
                if (col < 0) {
                    col = 0;
                    while (occupied.has(col) && col < nCols)
                        col++;
                    col = Math.min(col, nCols - 1);
                }
            }
            setDockLayout(prev => {
                const next = new Map(prev);
                next.set(tileId, { row, col });
                return next;
            });
        },
        swapTileSlot: (oldTileId, newTileId) => {
            setDockLayout(prev => swapTileSlotInLayout(prev, oldTileId, newTileId));
        },
    }), []);
    const handleRerun = useCallback(() => {
        playClick();
        const rerun = useGameStore.getState().pendingRerun;
        if (rerun) {
            const soundCount = Math.ceil(rerun.replaceIds.length / 2);
            for (let i = 0; i < soundCount; i++) {
                setTimeout(() => playDeal(), i * 120);
            }
        }
        triggerRerun();
    }, [playClick, playDeal, triggerRerun]);
    const handleSubmit = useCallback(async () => {
        playClick();
        if (gameOver) {
            onGameOverClick?.();
            return;
        }
        if (hasUnappliedRideSelection) {
            showToast('Apply or clear your Ride selection before submitting.');
            return;
        }
        if (rideControls?.manualRequired) {
            showToast('Brush and apply your Ride, or use the suggested Ride.');
            return;
        }
        try {
            await loadDictionary();
        }
        catch {
            showToast('Dictionary unavailable — please refresh', 'error');
            return;
        }
        if (!mounted.current)
            return;
        const { modeId: activeModeId, board, submittedPositions, submittedBentWordPositions, chainWords, round: currentRound, wildcardMustBeUsedAsXRound, rideClaim, authoring, } = useGameStore.getState();
        const mode = getMode(activeModeId);
        const isLastRoundNow = currentRound >= mode.getRoundConfig(currentRound).totalRounds;
        const precheck = mode.validateSubmit(board, submittedPositions, {
            round: currentRound,
            wildcardMustBeUsedAsXRound,
            submittedBentWordPositions,
            chainWords,
            rideClaim,
            authoring,
        });
        const precheckDecision = decideDockSubmitPrecheck({
            precheck,
            modeId: activeModeId,
            isLastRound: isLastRoundNow,
        });
        if (precheckDecision === 'game-over') {
            useGameStore.setState({ gameOver: true });
            return;
        }
        if (precheckDecision === 'reject') {
            if (precheck.ok)
                return;
            showToast(submitRejectionMessage(precheck, activeModeId));
            return;
        }
        const words = getDockSubmitWords(precheck, board);
        const newValidWords = deriveNewValidSubmitWords({
            precheck,
            words,
            submittedPositions,
        });
        const positions = collectDockSubmitPositions(newValidWords);
        const primaryRide = submittedRide(newValidWords, precheck.meta?.rideKey ?? null);
        const flashWords = rideOnlyFeedback ? (primaryRide ? [primaryRide] : []) : newValidWords;
        if (flashWords.length > 0) {
            const delays = buildDockSubmitAnimationDelays(flashWords, rideOnlyFeedback ? null : submittedPositions);
            useGameStore.setState({ animatingPositions: delays });
            const maxDelay = Math.max(...delays.values());
            afterSubmit(() => useGameStore.setState({ animatingPositions: null }), (maxDelay + 1) * 80 + 400);
        }
        const lastRound = isLastRoundNow;
        if (newValidWords.length === 0) {
            if (activeModeId === 'crosswords' && lastRound) {
                useGameStore.setState({ gameOver: true });
                return;
            }
            playError();
            showToast('No new words found — keep building!');
            return;
        }
        const rideKey = precheck.meta?.rideKey ?? null;
        const scoredWords = scoreDockSubmitWords({
            board,
            modeId: activeModeId,
            words: newValidWords,
            currentRound,
            rideKey,
            submittedPositions,
            shouldWordHaveLengthBonus: (key, activeRideKey, context) => mode.shouldWordHaveLengthBonus(key, activeRideKey, context),
        });
        const scored = [
            ...scoredWords,
            ...buildDockSbsLogEntries({
                contacts: precheck.meta?.sbsSideContacts,
                currentRound,
                existingEntries: scoredWords,
            }),
        ];
        const newPoints = scored.reduce((sum, s) => sum + s.points, 0);
        playSuccess();
        const feedbackWord = rideOnlyFeedback ? primaryRide : newValidWords.reduce((a, b) => b.word.length > a.word.length ? b : a);
        showToast(feedbackWord ? randomEncouragement(feedbackWord.word.toUpperCase()) : 'Word accepted', 'success');
        const bentWordPositions = collectDockSubmitBentPositions(precheck.meta?.bentWords);
        acceptSubmission({
            points: newPoints,
            newPositions: positions,
            scored,
            isLastRound: lastRound,
            bentWordPositions,
            chainWordDrafts: precheck.meta?.chainWordDrafts,
        });
        const ui = useUIStore.getState();
        ui.setLeftTool('hand');
        ui.clearSelectedTiles();
        if (lastRound) {
            useGameStore.setState({ gameOver: true });
        }
        else {
            afterSubmit(() => useGameStore.getState().drawHand(), 1000);
        }
    }, [playClick, playSuccess, playError, acceptSubmission, showToast, gameOver, onGameOverClick, hasUnappliedRideSelection, rideControls?.manualRequired, rideOnlyFeedback, afterSubmit]);
    const dockBg = 'rgb(239, 240, 209)';
    const showDots = !isMobile || expandedSection !== null;
    const pickCols = isMobile && expandedSection === 'pick' ? 9 : 13;
    const effectivePickTileSize = (() => {
        if (!(isMobile && expandedSection === 'pick') || !dockWidth)
            return pickTileSize;
        const available = dockWidth - 24;
        return Math.min(MAIN_TILE_SIZE, Math.floor((available - (pickCols - 1) * GAP) / pickCols));
    })();
    const effectiveDoubleTileSize = isMobile && expandedSection === 'double' ? MAIN_TILE_SIZE : doubleTileSize;
    const surfboardInHand = hand.some((t) => t.kind === 'surfboard');
    const effectiveTopCols = topCols;
    const effectiveBottomCols = bottomCols;
    const effectivePlayTileSize = (() => {
        if (!(isMobile && expandedSection === 'play') || !dockWidth)
            return playTileSize;
        const maxCols = Math.max(topCols, bottomCols);
        const playWidth = dockWidth - PADDING_X * 2;
        return Math.min(MAIN_TILE_SIZE, Math.floor((playWidth - (maxCols - 1) * GAP) / maxCols));
    })();
    const expandedPlay = isMobile && expandedSection === 'play';
    const dottedBg = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${effectivePlayTileSize + GAP}' height='${effectivePlayTileSize}'><rect x='0.5' y='0.5' width='${effectivePlayTileSize - 1}' height='${effectivePlayTileSize - 1}' fill='none' stroke='rgba(0,110,134,0.3)' stroke-width='1' stroke-dasharray='4,4'/></svg>`)}")`;
    const renderRow = (rowIndex: 0 | 1) => {
        const nCols = rowIndex === 0 ? effectiveTopCols : effectiveBottomCols;
        const rowWidth = nCols * effectivePlayTileSize + (nCols - 1) * GAP;
        const activeLayout = liveLayout ?? dockLayout;
        const tilesInRow = hand.filter(t => activeLayout.get(t.id)?.row === rowIndex);
        const occupiedCols = new Set(tilesInRow.map(t => activeLayout.get(t.id)?.col).filter((c): c is number => c !== undefined));
        const showGhost = hoverCell?.row === rowIndex;
        return (<div key={rowIndex} style={{
                position: 'relative',
                backgroundImage: expandedPlay ? undefined : dottedBg,
                backgroundSize: expandedPlay ? undefined : `${effectivePlayTileSize + GAP}px ${effectivePlayTileSize}px`,
                width: rowWidth,
                height: effectivePlayTileSize,
                flexShrink: 0,
            }}>

          {expandedPlay && Array.from({ length: nCols }, (_, col) => {
                if (occupiedCols.has(col))
                    return null;
                return (<div key={`ph-${col}`} style={{
                        position: 'absolute',
                        left: col * (effectivePlayTileSize + GAP),
                        top: 0,
                        width: effectivePlayTileSize,
                        height: effectivePlayTileSize,
                        borderRadius: '0.5rem',
                        border: '2px dashed rgba(0,110,134,0.3)',
                        pointerEvents: 'none',
                    }}/>);
            })}


          {showGhost && (<div style={{
                    position: 'absolute',
                    left: hoverCell!.col * (effectivePlayTileSize + GAP),
                    top: 0,
                    width: effectivePlayTileSize,
                    height: effectivePlayTileSize,
                    borderRadius: '0.5rem',
                    border: '2px dashed rgba(0,110,134,0.45)',
                    background: 'rgba(0,110,134,0.07)',
                    pointerEvents: 'none',
                    transition: 'left 0.12s ease',
                }}/>)}

          {tilesInRow.map(tile => {
                const pos = activeLayout.get(tile.id);
                if (!pos || pos.col >= nCols)
                    return null;
                if (tile.id === hoverId)
                    return null;
                return (<div key={tile.id} style={{
                        position: 'absolute',
                        left: pos.col * (effectivePlayTileSize + GAP),
                        top: 0,
                        transition: 'left 0.12s ease',
                    }}>
                <DraggableDockTile tile={tile} isNew={newTileIds.has(tile.id)} staggerDelay={(staggerMap.get(tile.id) ?? 0) * 55} size={effectivePlayTileSize} showDots={showDots} dragDisabled={dragDisabled} wildcardHint={isWildcardHintEligible(tile)} onWildcardTileClick={isWildcardChoiceEligible(tile) ? onWildcardTileClick : undefined}/>
              </div>);
            })}
        </div>);
    };
    return (<div className="absolute bottom-0 inset-x-0 flex flex-col sm:flex-row lg:flex-col justify-center items-center gap-2 sm:gap-3 pb-[env(safe-area-inset-bottom,0px)] pointer-events-none [&>*]:pointer-events-auto">


        <div className="flex sm:hidden items-center gap-2 self-stretch px-3 z-30">
          {expandedSection !== null ? (<button onClick={() => { playClick(); setExpandedSection(null); }} tabIndex={-1} className="ml-auto h-10 px-4 rounded-full font-headline font-semibold text-sm transition-all cursor-pointer active:scale-90 flex items-center gap-2 flex-shrink-0" style={variant === 'editorial' ? {
                background: '#fff',
                border: '3px solid #111',
                boxShadow: '3px 3px 0 #111',
                color: '#111',
            } : {
                background: 'rgba(239, 240, 209, 0.75)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(55, 57, 40, 0.2)',
                color: 'rgba(55, 57, 40, 0.8)',
            }}>
              <ArrowUturnLeftIcon className="w-4 h-4"/>
              Back
            </button>) : (<>

              <button onClick={() => { playClick(); useGameStore.getState().toggleHints(); }} tabIndex={-1} title="Toggle placement hints" className="h-10 w-10 flex items-center justify-center cursor-pointer transition-all active:scale-90 flex-shrink-0" style={variant === 'editorial' ? {
                background: hintsEnabled ? '#98d4ec' : '#fff',
                border: '2px solid #111',
                boxShadow: '3px 3px 0 #111',
                borderRadius: 10,
                color: '#111',
            } : {
                background: hintsEnabled ? 'rgba(0, 110, 134, 0.15)' : 'rgba(239, 240, 209, 0.75)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: hintsEnabled ? '1px solid rgba(0, 110, 134, 0.3)' : '1px solid rgba(55, 57, 40, 0.2)',
                borderRadius: '50%',
                color: hintsEnabled ? 'rgba(0, 83, 102, 1)' : 'rgba(55, 57, 40, 0.6)',
            }}>
                {hintsEnabled ? <FaEye size={14}/> : <FaEyeSlash size={14}/>}
              </button>

              <button onClick={handleUndo} disabled={!canUndo} tabIndex={-1} title="Undo" className="h-10 w-10 flex items-center justify-center cursor-pointer transition-all active:scale-90 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed" style={variant === 'editorial' ? {
                background: '#fce49a',
                border: '2px solid #111',
                borderRadius: 10,
                boxShadow: '3px 3px 0 #111',
                color: '#111',
            } : {
                background: 'rgba(239, 240, 209, 0.75)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(55, 57, 40, 0.2)',
                borderRadius: '50%',
                color: 'rgba(55, 57, 40, 0.7)',
            }}>
                <FaRotateLeft size={14}/>
              </button>

              <button onClick={handleRedo} disabled={!canRedo} tabIndex={-1} title="Redo" className="h-10 w-10 flex items-center justify-center cursor-pointer transition-all active:scale-90 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed" style={variant === 'editorial' ? {
                background: '#fce49a',
                border: '2px solid #111',
                borderRadius: 10,
                boxShadow: '3px 3px 0 #111',
                color: '#111',
            } : {
                background: 'rgba(239, 240, 209, 0.75)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(55, 57, 40, 0.2)',
                borderRadius: '50%',
                color: 'rgba(55, 57, 40, 0.7)',
            }}>
                <FaRotateRight size={14}/>
              </button>
              {pendingRerun && !gameOver && (<button onClick={handleRerun} tabIndex={-1} className="ml-auto h-10 px-4 rounded-full font-headline font-semibold text-sm transition-all cursor-pointer active:scale-95" style={variant === 'editorial' ? {
                    background: '#98d4ec',
                    border: '3px solid #111',
                    boxShadow: '4px 4px 0 #111',
                    color: '#111',
                } : {
                    background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    boxShadow: '0 4px 16px -4px rgba(2, 132, 199, 0.5)',
                    color: 'white',
                }}>
                  Rerun
                </button>)}

              <div className={`${pendingRerun && !gameOver ? 'ml-4' : 'ml-auto'} relative flex-shrink-0`}>
                <div className="absolute bottom-full right-0 mb-1 pointer-events-none">
                  <ReaderPreviewPill text={readerPreviewText} variant={variant} rideControls={previewControls} hasAppliedRide={!!rideClaim}/>
                </div>
                <button onClick={handleSubmit} onKeyDown={e => {
                if (e.key === ' ')
                    e.preventDefault();
            }} tabIndex={-1} className="h-10 px-4 rounded-full font-headline font-semibold text-sm select-none transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={variant === 'editorial' ? {
                ...SUBMIT_BUTTON_SELECTION_STYLE,
                background: gameOver ? '#eee' : '#ffb73f',
                border: '3px solid #111',
                boxShadow: gameOver ? 'none' : '4px 4px 0 #111',
                color: '#111',
            } : {
                ...SUBMIT_BUTTON_SELECTION_STYLE,
                background: gameOver ? 'rgba(239, 240, 209, 0.55)' : 'linear-gradient(135deg, #006e86, #85dbf8)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: gameOver ? 'none' : '0 4px 16px -4px rgba(0, 110, 134, 0.4)',
                color: gameOver ? 'inherit' : 'white',
            }}>
                  {gameOver ? 'Game Over' : isLastRound ? 'Final Submit' : 'Submit'}
                </button>
              </div>
            </>)}
        </div>


        <div className="relative mb-4 w-full" style={{ maxWidth: DOCK_MAX_WIDTH }}>


          <div className="hidden sm:flex items-center gap-2 absolute -top-12 left-3 right-3 z-30">

            <button onClick={() => { playClick(); useGameStore.getState().toggleHints(); }} tabIndex={-1} title="Toggle placement hints" className="h-10 px-3 rounded-full flex items-center gap-1.5 font-body text-xs cursor-pointer transition-all active:scale-90" style={variant === 'editorial' ? {
            background: hintsEnabled ? '#98d4ec' : '#fff',
            border: '2px solid #111',
            boxShadow: '3px 3px 0 #111',
            color: '#111',
        } : {
            background: hintsEnabled ? 'rgba(0, 110, 134, 0.15)' : 'rgba(239, 240, 209, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: hintsEnabled ? '1px solid rgba(0, 110, 134, 0.3)' : '1px solid rgba(55, 57, 40, 0.2)',
            color: hintsEnabled ? 'rgba(0, 83, 102, 1)' : 'rgba(55, 57, 40, 0.6)',
        }}>
              {hintsEnabled ? <FaEye size={13}/> : <FaEyeSlash size={13}/>}
              Placement
            </button>

            <button onClick={handleUndo} disabled={!canUndo} tabIndex={-1} title="Undo" className="h-10 w-10 flex items-center justify-center cursor-pointer transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed" style={variant === 'editorial' ? {
            background: '#fce49a',
            border: '2px solid #111',
            borderRadius: 10,
            boxShadow: '3px 3px 0 #111',
            color: '#111',
        } : {
            background: 'rgba(239, 240, 209, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(55, 57, 40, 0.2)',
            borderRadius: '50%',
            color: 'rgba(55, 57, 40, 0.7)',
        }}>
              <FaRotateLeft size={14}/>
            </button>

            <button onClick={handleRedo} disabled={!canRedo} tabIndex={-1} title="Redo" className="h-10 w-10 flex items-center justify-center cursor-pointer transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed" style={variant === 'editorial' ? {
            background: '#fce49a',
            border: '2px solid #111',
            borderRadius: 10,
            boxShadow: '3px 3px 0 #111',
            color: '#111',
        } : {
            background: 'rgba(239, 240, 209, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(55, 57, 40, 0.2)',
            borderRadius: '50%',
            color: 'rgba(55, 57, 40, 0.7)',
        }}>
              <FaRotateRight size={14}/>
            </button>
            {pendingRerun && !gameOver && (<button onClick={handleRerun} tabIndex={-1} className="ml-auto px-4 py-2 rounded-full font-headline font-semibold text-sm transition-all cursor-pointer active:scale-95" style={variant === 'editorial' ? {
                background: '#98d4ec',
                border: '3px solid #111',
                boxShadow: '4px 4px 0 #111',
                color: '#111',
            } : {
                background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: '0 4px 16px -4px rgba(2, 132, 199, 0.5)',
                color: 'white',
            }}>
                {rerunLabel}
              </button>)}

            <div className={`${pendingRerun && !gameOver ? 'ml-4' : 'ml-auto'} relative`}>
              <div className="absolute bottom-full right-0 mb-1 pointer-events-none">
                <ReaderPreviewPill text={readerPreviewText} variant={variant} rideControls={previewControls} hasAppliedRide={!!rideClaim}/>
              </div>
              <button onClick={handleSubmit} onKeyDown={e => {
            if (e.key === ' ')
                e.preventDefault();
        }} tabIndex={-1} className="px-4 py-2 rounded-full font-headline font-semibold text-sm select-none transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" style={variant === 'editorial' ? {
            ...SUBMIT_BUTTON_SELECTION_STYLE,
            background: gameOver ? '#eee' : '#ffb73f',
            border: '3px solid #111',
            boxShadow: gameOver ? 'none' : '4px 4px 0 #111',
            color: '#111',
        } : {
            ...SUBMIT_BUTTON_SELECTION_STYLE,
            background: gameOver ? 'rgba(239, 240, 209, 0.55)' : 'linear-gradient(135deg, #006e86, #85dbf8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: gameOver ? 'none' : '0 4px 16px -4px rgba(0, 110, 134, 0.4)',
            color: gameOver ? 'inherit' : 'white',
        }}>
                {gameOver ? 'Game Over' : isLastRound ? 'Final Submit' : 'Submit Word'}
              </button>
            </div>
          </div>


        <div ref={setOuterRef} className="relative w-full flex flex-col rounded-2xl overflow-hidden" style={{
            background: dockBg,
            boxShadow: '0 8px 32px -8px rgba(55, 57, 40, 0.15), inset 0 0.5px 0 rgba(255, 255, 255, 0.6)',
        }}>





          <div ref={setPickReturnRef} className={`flex justify-center ${isMobile && expandedSection === 'pick' ? 'py-4 px-3' : 'px-3 pt-2 pb-1.5'} ${isMobile && expandedSection !== null && expandedSection !== 'pick' ? 'hidden' : ''} ${isMobile && expandedSection === null ? 'cursor-pointer' : ''}`} onClick={isMobile && expandedSection === null ? () => setExpandedSection('pick') : undefined}>
            <div className={isMobile && expandedSection === null ? 'pointer-events-none select-none' : ''} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${pickCols}, ${effectivePickTileSize}px)`, gap: '4px' }}>
                {ALPHABET.map(letter => (<PickBarTile key={letter} letter={letter} usedCount={usedPickTilesByLetter.get(letter) ?? 0} anyUsed={pickRoundLimitReached} roundLimitReached={pickRoundLimitReached} onTap={() => { playPickUp(); addPickTile(letter); }} onReturn={(usedPickTilesByLetter.get(letter) ?? 0) > 0 ? () => {
                const t = hand.find(h => h.kind === 'regular' && h.isPickTile && h.letter === letter);
                if (t) {
                    playPickUp();
                    returnPickTile(t.id);
                }
            } : undefined} size={effectivePickTileSize} showDots={showDots} dragDisabled={dragDisabled}/>))}
              </div>
              {canUseSurfboardTiles(modeId) && (<SurfboardBarTile inHand={surfboardInHand} onTap={() => { playPickUp(); addSurfboardTile(); }} size={effectivePickTileSize} dragDisabled={dragDisabled}/>)}
            </div>
          </div>


          <div className={`h-px mx-3 ${isMobile && expandedSection !== null ? 'hidden' : ''}`} style={{ background: 'rgba(55, 57, 40, 0.1)' }}/>


          <div className={`flex ${isMobile && expandedSection === 'double' ? 'items-center' : 'items-start'} ${isMobile && (expandedSection === 'letters' || expandedSection === 'pick') ? 'hidden' : ''}`}>

            <div ref={setDoubleReturnRef} className={`flex flex-col items-center gap-[4px] ${isMobile && expandedSection === 'double' ? 'w-full py-4 px-3 justify-center' : 'px-3 py-2.5 flex-shrink-0'} ${isMobile && expandedSection === 'play' ? 'hidden' : ''} ${isMobile && expandedSection === null ? 'cursor-pointer' : ''}`} onClick={isMobile && expandedSection === null ? () => setExpandedSection('double') : undefined}>
              <div className={`flex flex-col items-center ${isMobile && expandedSection === null ? 'pointer-events-none select-none' : ''}`}>
              {[['CH', 'CK'], ['PH', 'SH', 'TH']].map((row, rowIdx) => (<div key={rowIdx} className="flex gap-[4px]">
                  {row.map(id => {
                const tile = DOUBLE_TILES.find(t => t.id === id)!;
                const isPermanentlyGone = !remainingDoubleTiles.includes(tile.id) && doubleTileIdForRound !== tile.id;
                return (<DoubleBarTile key={tile.id} tileId={tile.id} value={tile.value} usedTileId={doubleTileIdForRound} roundLimitReached={doubleTileUsedForRound} isPermanentlyGone={isPermanentlyGone} onTap={() => { playPickUp(); addDoubleTile(tile.id); }} onReturn={doubleTileUsedForRound && doubleTileIdForRound === tile.id ? () => {
                        const t = hand.find(h => h.kind === 'double' && h.tileId === tile.id);
                        if (t) {
                            playPickUp();
                            returnDoubleTile(t.id);
                        }
                    } : undefined} size={effectiveDoubleTileSize} showDots={showDots} dragDisabled={dragDisabled}/>);
            })}
                </div>))}
              </div>
            </div>


            <div className={`self-stretch w-px ${isMobile && expandedSection !== null ? 'hidden' : ''}`} style={{ background: 'rgba(55, 57, 40, 0.1)' }}/>


            <div ref={setRef} data-dock className={`relative z-40 flex-1 px-3 py-2.5 flex flex-col items-center ${isMobile && expandedSection !== null && expandedSection !== 'play' ? 'hidden' : ''} ${isMobile && expandedSection === null ? 'cursor-pointer' : ''}`} onClick={isMobile && expandedSection === null ? () => setExpandedSection('play') : undefined}>
              <div className={`flex flex-col items-center w-full ${isMobile && expandedSection === null ? 'pointer-events-none select-none' : ''}`} style={{ gap: GAP }}>
                {renderRow(0)}
                {renderRow(1)}
              </div>
            </div>
          </div>
        </div>
        </div>


        {toastMessage && (<WordToast key={toastKey} message={toastMessage} theme={toastTheme} variant={variant === 'editorial' ? 'editorial' : 'default'} onComplete={() => setToastMessage(null)}/>)}
      </div>);
});
export default Dock;
