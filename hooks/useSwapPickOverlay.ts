'use client';
import { useState, useRef, useMemo, useEffect } from 'react';
import { useGameStore } from '@/lib/game-store';
import type { Letter } from '@/lib/tiles';
export type SwapPickOverlay = {
    letter: Letter;
    row: number;
    col: number;
    left: number;
    top: number;
    scale: number;
};
type KeyLookup = {
    has: (key: string) => boolean;
};
export function resolveVisibleSwapPickOverlay(swapPickOverlay: SwapPickOverlay | null, animatingPositions: KeyLookup | null): SwapPickOverlay | null {
    if (!swapPickOverlay)
        return null;
    if (!animatingPositions)
        return swapPickOverlay;
    const key = `${swapPickOverlay.row}-${swapPickOverlay.col}`;
    return animatingPositions.has(key) ? null : swapPickOverlay;
}
export function useSwapPickOverlay() {
    const [swapPickOverlay, setSwapPickOverlay] = useState<SwapPickOverlay | null>(null);
    const [swapOverlayRenderInValidWord, setSwapOverlayRenderInValidWord] = useState(false);
    const swapOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const validPositions = useGameStore((s) => s.validPositions);
    const submittedPositions = useGameStore((s) => s.submittedPositions);
    const animatingPositions = useGameStore((s) => s.animatingPositions);
    const visibleSwapPickOverlay = useMemo(() => resolveVisibleSwapPickOverlay(swapPickOverlay, animatingPositions), [swapPickOverlay, animatingPositions]);
    useEffect(() => {
        if (visibleSwapPickOverlay || !swapOverlayTimerRef.current)
            return;
        clearTimeout(swapOverlayTimerRef.current);
        swapOverlayTimerRef.current = null;
    }, [visibleSwapPickOverlay]);
    const swapOverlayTargetInValidWord = useMemo(() => {
        if (!visibleSwapPickOverlay)
            return false;
        const key = `${visibleSwapPickOverlay.row}-${visibleSwapPickOverlay.col}`;
        return !!(validPositions?.has(key) || submittedPositions?.has(key));
    }, [visibleSwapPickOverlay, validPositions, submittedPositions]);
    useEffect(() => {
        const shouldRender = !!visibleSwapPickOverlay && swapOverlayTargetInValidWord;
        const rafId = requestAnimationFrame(() => {
            setSwapOverlayRenderInValidWord(shouldRender);
        });
        return () => cancelAnimationFrame(rafId);
    }, [visibleSwapPickOverlay, swapOverlayTargetInValidWord]);
    useEffect(() => {
        return () => {
            if (swapOverlayTimerRef.current)
                clearTimeout(swapOverlayTimerRef.current);
        };
    }, []);
    const triggerSwapOverlay = (letter: Letter, row: number, col: number, rect: {
        left: number;
        top: number;
        width: number;
    } | null) => {
        if (!rect)
            return;
        const scale = rect.width / 44;
        if (swapOverlayTimerRef.current)
            clearTimeout(swapOverlayTimerRef.current);
        setSwapOverlayRenderInValidWord(false);
        setSwapPickOverlay({ letter, row, col, left: rect.left, top: rect.top, scale });
        swapOverlayTimerRef.current = setTimeout(() => setSwapPickOverlay(null), 700);
    };
    return { swapPickOverlay: visibleSwapPickOverlay, setSwapPickOverlay, swapOverlayRenderInValidWord, triggerSwapOverlay };
}
