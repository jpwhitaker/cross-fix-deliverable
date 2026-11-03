'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useGameStore } from '@/lib/game-store';
import { useUIStore } from '@/lib/ui-store';
import { selectSurfFixRide, surfFixRideBoard } from '@/lib/modes/surf-fix/ride-selection';
import { getSurfFixPathEndHintKeys } from '@/lib/modes/surf-fix/pre-post-hints';
import { getSurfFixReaderPreview } from '@/lib/modes/surf-fix/reader-preview';
import { claimedRidePaths, paintRideBrushTile, rideBrushActionForTile, type RideBrushAction } from '@/lib/predicates/reads/ride-claim';
import { surfFixReadingPolicy } from '@/lib/modes/surf-fix/reading-policy';
type PointerStart = {
    tileId: string;
    pointerId: number;
    clientX: number;
    clientY: number;
};
export function useRideBrush(enabled: boolean, rideOnlyFeedback = false) {
    const board = useGameStore(s => s.board);
    const chainWords = useGameStore(s => s.chainWords);
    const submittedPositions = useGameStore(s => s.submittedPositions);
    const claim = useGameStore(s => s.rideClaim ?? null);
    const authoring = useGameStore(s => s.authoring);
    const bestRideTrial = enabled && !!surfFixReadingPolicy(authoring);
    const modeId = useGameStore(s => s.modeId);
    const gameOver = useGameStore(s => s.gameOver);
    const tool = useUIStore(s => s.leftTool);
    const draft = useUIStore(s => s.rideDraft);
    const stroke = useRef<(PointerStart & {
        action: RideBrushAction;
        x: number;
        y: number;
    }) | null>(null);
    const suppressClick = useRef(false);
    const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const topology = useMemo(() => {
        if (!enabled || modeId !== 'surf-fix')
            return null;
        try {
            return surfFixRideBoard({ board, chainWords, submittedPositions });
        }
        catch {
            return null;
        }
    }, [board, chainWords, enabled, modeId, submittedPositions]);
    const available = !!topology?.hasNewTiles && !gameOver;
    const selectedIds = useMemo(() => {
        if (!available || !topology)
            return new Set<string>();
        if (bestRideTrial)
            return new Set(draft?.boardKey === topology.boardKey ? draft.tileIds : []);
        if (!claim && draft?.boardKey === topology.boardKey)
            return new Set(draft.tileIds);
        return new Set(claim?.boardKey === topology.boardKey ? claim.tileIds : []);
    }, [available, bestRideTrial, claim, draft, topology]);
    const selectedTileIds = useMemo(() => [...selectedIds], [selectedIds]);
    const selectedRef = useRef(selectedIds);
    useLayoutEffect(() => { selectedRef.current = selectedIds; }, [selectedIds]);
    const applied = !bestRideTrial && !!claim && claim.boardKey === topology?.boardKey
        && claim.tileIds.length === selectedIds.size && claim.tileIds.every(id => selectedIds.has(id));
    const highlightedKeys = useMemo(() => {
        if (tool !== 'ride')
            return new Set<string>();
        return new Set(topology?.tiles.filter(tile => selectedIds.has(tile.id))
            .map(tile => `${tile.row}-${tile.col}`) ?? []);
    }, [selectedIds, tool, topology]);
    const endHintKeys = useMemo(() => {
        if (!rideOnlyFeedback || !selectedTileIds.length || tool !== 'ride')
            return null;
        const selection = selectSurfFixRide({ board, chainWords, submittedPositions }, selectedTileIds);
        return selection.ok ? getSurfFixPathEndHintKeys(selection.claim.cells, board.length, board[0]?.length ?? 0) : new Set<string>();
    }, [board, chainWords, rideOnlyFeedback, selectedTileIds, submittedPositions, tool]);
    const paint = useCallback((tileId: string, action = rideBrushActionForTile(selectedRef.current, tileId)) => {
        if (!available || !topology || !topology.tiles.some(tile => tile.id === tileId))
            return;
        const next = paintRideBrushTile(selectedRef.current, tileId, action);
        if (!next)
            return;
        selectedRef.current = next;
        if (!bestRideTrial && useGameStore.getState().rideClaim)
            useGameStore.getState().clearRideSelection();
        useUIStore.setState({ rideDraft: { boardKey: topology.boardKey, tileIds: [...next] } });
    }, [available, bestRideTrial, topology]);
    const start = useCallback((payload: PointerStart) => {
        if (!available || tool !== 'ride')
            return;
        if (clickTimer.current)
            clearTimeout(clickTimer.current);
        const action = rideBrushActionForTile(selectedRef.current, payload.tileId);
        paint(payload.tileId, action);
        stroke.current = { ...payload, x: payload.clientX, y: payload.clientY, action };
        suppressClick.current = true;
    }, [available, paint, tool]);
    const consumeClick = useCallback(() => {
        if (!suppressClick.current)
            return false;
        suppressClick.current = false;
        return true;
    }, []);
    useEffect(() => {
        if (!available || tool !== 'ride')
            return;
        const sample = (x: number, y: number, action: RideBrushAction) => {
            const element = document.elementFromPoint(x, y)?.closest('[data-ride-tile-id]');
            const id = element?.getAttribute('data-ride-tile-id');
            if (id)
                paint(id, action);
        };
        const move = (event: PointerEvent) => {
            const active = stroke.current;
            if (!active || event.pointerId !== active.pointerId)
                return;
            event.preventDefault();
            const steps = Math.max(1, Math.ceil(Math.hypot(event.clientX - active.x, event.clientY - active.y) / 4));
            for (let step = 1; step <= steps; step++)
                sample(active.x + (event.clientX - active.x) * step / steps, active.y + (event.clientY - active.y) * step / steps, active.action);
            active.x = event.clientX;
            active.y = event.clientY;
        };
        const end = (event: PointerEvent) => {
            if (stroke.current?.pointerId !== event.pointerId)
                return;
            if (event.type !== 'pointercancel')
                move(event);
            stroke.current = null;
            clickTimer.current = setTimeout(() => { suppressClick.current = false; }, 0);
        };
        window.addEventListener('pointermove', move, { passive: false });
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);
        return () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', end);
            window.removeEventListener('pointercancel', end);
            if (clickTimer.current)
                clearTimeout(clickTimer.current);
            stroke.current = null;
            suppressClick.current = false;
        };
    }, [available, paint, tool]);
    useEffect(() => {
        if (tool === 'ride' && !available)
            useUIStore.getState().setLeftTool('hand');
    }, [available, tool]);
    const apply = () => {
        const selectedText = selectSurfFixRide({ board, chainWords, submittedPositions }, [...selectedIds]);
        const result = useGameStore.getState().applyRideSelection([...selectedIds]);
        if (result.ok) {
            if (bestRideTrial)
                selectedRef.current = new Set();
            useUIStore.setState({ rideDraft: null });
        }
        const appliedText = result.ok ? bestRideTrial && selectedText.ok ? selectedText.claim.text
            : getSurfFixReaderPreview(useGameStore.getState(), rideOnlyFeedback ? 'ride-only' : 'all-reads')?.text ?? useGameStore.getState().rideClaim!.text : null;
        useGameStore.setState({ toastMessage: result.ok ? `Ride applied: ${appliedText}` : result.message, toastTheme: 'default' });
    };
    const clear = () => {
        if (!bestRideTrial)
            useGameStore.getState().clearRideSelection();
        selectedRef.current = new Set();
        useUIStore.setState({ rideDraft: null });
    };
    const dismiss = (pathKey?: string) => {
        useGameStore.getState().clearRideSelection(pathKey);
        selectedRef.current = new Set();
        useUIStore.setState({ leftTool: 'ride', rideDraft: topology ? { boardKey: topology.boardKey, tileIds: [] } : null });
    };
    const restoreAutomatic = () => {
        useGameStore.getState().clearRideSelection();
        selectedRef.current = new Set();
        useUIStore.setState({ rideDraft: null });
    };
    const choosePrimary = (tileIds: readonly string[], boardKey: string) => {
        const pending = useUIStore.getState().rideDraft;
        if (pending?.boardKey === boardKey && pending.tileIds.length) {
            useGameStore.setState({ toastMessage: 'Apply or cancel your brush selection before choosing the Ride.', toastTheme: 'default' });
            return;
        }
        const result = useGameStore.getState().choosePrimaryRide(tileIds, boardKey);
        if (result.ok) {
            selectedRef.current = new Set();
            useUIStore.setState({ rideDraft: null });
        }
        useGameStore.setState({ toastMessage: result.ok ? `Ride selected: ${useGameStore.getState().rideClaim!.text}` : result.message,
            toastTheme: 'default' });
    };
    const appliedPaths = bestRideTrial && claim?.boardKey === topology?.boardKey ? claimedRidePaths(claim)
        .map(path => ({ key: path.tileIds.join('|'), text: path.text })) : [];
    const manualRequired = bestRideTrial && available && !appliedPaths.length && draft?.boardKey === topology?.boardKey;
    return { available, applied, hasSelection: selectedIds.size > 0, selectedTileIds, highlightedKeys, endHintKeys, start, consumeClick,
        toggle: paint, apply, clear, bestRideTrial, appliedPaths, manualRequired, dismiss, restoreAutomatic, choosePrimary };
}
