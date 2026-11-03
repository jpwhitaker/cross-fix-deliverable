'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useUIStore, selectLeftTool } from '@/lib/ui-store';
export function useToolPill() {
    const [showActiveToolLabel, setShowActiveToolLabel] = useState(true);
    const [toolExpandedWidths, setToolExpandedWidths] = useState({ hand: 124, select: 132, move: 142, inspect: 120, ride: 132 });
    const toolPillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handToolRef = useRef<HTMLButtonElement>(null);
    const selectToolRef = useRef<HTMLButtonElement>(null);
    const moveToolRef = useRef<HTMLButtonElement>(null);
    const inspectToolRef = useRef<HTMLButtonElement>(null);
    const rideToolRef = useRef<HTMLButtonElement>(null);
    const leftTool = useUIStore(selectLeftTool);
    const revealActiveToolLabel = useCallback(() => {
        setShowActiveToolLabel(true);
        if (toolPillTimerRef.current)
            clearTimeout(toolPillTimerRef.current);
        toolPillTimerRef.current = setTimeout(() => {
            setShowActiveToolLabel(false);
            toolPillTimerRef.current = null;
        }, 4000);
    }, []);
    useEffect(() => {
        const timerId = setTimeout(() => {
            revealActiveToolLabel();
        }, 0);
        return () => clearTimeout(timerId);
    }, [leftTool, revealActiveToolLabel]);
    const measureToolExpandedWidths = useCallback(() => {
        setToolExpandedWidths({
            hand: Math.max(44, Math.ceil(handToolRef.current?.scrollWidth ?? 44)),
            select: Math.max(44, Math.ceil(selectToolRef.current?.scrollWidth ?? 44)),
            move: Math.max(44, Math.ceil(moveToolRef.current?.scrollWidth ?? 44)),
            inspect: Math.max(44, Math.ceil(inspectToolRef.current?.scrollWidth ?? 44)),
            ride: Math.max(44, Math.ceil(rideToolRef.current?.scrollWidth ?? 44)),
        });
    }, []);
    useEffect(() => {
        const rafId = requestAnimationFrame(measureToolExpandedWidths);
        window.addEventListener('resize', measureToolExpandedWidths);
        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', measureToolExpandedWidths);
        };
    }, [measureToolExpandedWidths]);
    useEffect(() => {
        return () => {
            if (toolPillTimerRef.current)
                clearTimeout(toolPillTimerRef.current);
        };
    }, []);
    return {
        showActiveToolLabel,
        revealActiveToolLabel,
        toolExpandedWidths,
        handToolRef,
        selectToolRef,
        moveToolRef,
        inspectToolRef,
        rideToolRef,
    };
}
