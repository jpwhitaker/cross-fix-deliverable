'use client';
import { useRef, useMemo, useState, useEffect, useCallback, memo, forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { useSpring, config } from '@react-spring/web';
import { useGesture } from '@use-gesture/react';
export type BoardHandle = {
    cellAt: (viewportX: number, viewportY: number) => {
        row: number;
        col: number;
    } | null;
    cellAtUnclamped: (viewportX: number, viewportY: number) => {
        row: number;
        col: number;
    } | null;
    cellAtPair: (viewportX: number, viewportY: number) => {
        logical: {
            row: number;
            col: number;
        } | null;
        clamped: {
            row: number;
            col: number;
        };
    };
    cellRect: (row: number, col: number) => {
        left: number;
        top: number;
        width: number;
        height: number;
    } | null;
    cellRectAt: (row: number, col: number) => {
        left: number;
        top: number;
        width: number;
        height: number;
    } | null;
    setHoverCell: (row: number, col: number) => void;
    clearHoverCell: () => void;
    setHoverCells: (cells: Array<{
        row: number;
        col: number;
        valid: boolean;
    }>) => void;
    resetDoubleTapDetector: () => void;
    getTransform: () => {
        x: number;
        y: number;
        scale: number;
    };
};
interface BoardProps {
    rows: number;
    cols: number;
    cellSize?: number;
    renderCell: (row: number, col: number) => ReactNode;
    gesturesEnabled?: boolean;
    resetViewEnabled?: boolean;
    onTransformChange?: (x: number, y: number, scale: number) => void;
}
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const BOARD_GESTURE_BLOCKER_SELECTOR = '[data-board-draggable],[data-board-gesture-blocker]';
const INITIAL_BOARD_TRANSFORM = 'translate3d(0px, 0px, 0) scale(1)';
function isBoardGestureBlockedTarget(target: EventTarget | null): boolean {
    return !!(target as HTMLElement | null)?.closest?.(BOARD_GESTURE_BLOCKER_SELECTOR);
}
const Board = forwardRef<BoardHandle, BoardProps>(function Board({ rows, cols, cellSize = 44, renderCell, gesturesEnabled = true, resetViewEnabled = true, onTransformChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const boardRef = useRef<HTMLDivElement>(null);
    const hoverOverlayRef = useRef<HTMLDivElement>(null);
    const rectRef = useRef<DOMRect | null>(null);
    const posRef = useRef({ x: 0, y: 0 });
    const scaleRef = useRef(1);
    const groupHoverRef = useRef<HTMLDivElement | null>(null);
    const groupHoverPrevCountRef = useRef(0);
    const shouldCancelGesturePointerRef = useRef(false);
    const [viewport, setViewport] = useState({ w: 0, h: 0 });
    const contentW = cols * cellSize;
    const contentH = rows * cellSize;
    useEffect(() => {
        const el = containerRef.current;
        if (!el)
            return;
        let rafId = 0;
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                setViewport({ w: el.clientWidth, h: el.clientHeight });
            });
        });
        observer.observe(el);
        return () => { observer.disconnect(); cancelAnimationFrame(rafId); };
    }, []);
    useEffect(() => {
        const el = containerRef.current;
        if (el)
            rectRef.current = el.getBoundingClientRect();
    }, [viewport]);
    useEffect(() => {
        const el = containerRef.current;
        if (!el)
            return;
        const onDown = (e: PointerEvent) => {
            shouldCancelGesturePointerRef.current = isBoardGestureBlockedTarget(e.target);
        };
        const onUp = () => { shouldCancelGesturePointerRef.current = false; };
        el.addEventListener('pointerdown', onDown, true);
        el.addEventListener('pointerup', onUp, true);
        el.addEventListener('pointercancel', onUp, true);
        return () => {
            el.removeEventListener('pointerdown', onDown, true);
            el.removeEventListener('pointerup', onUp, true);
            el.removeEventListener('pointercancel', onUp, true);
        };
    }, []);
    const padX = viewport.w / 2;
    const padY = viewport.h / 2;
    const totalW = contentW + padX * 2;
    const totalH = contentH + padY * 2;
    const fitScale = useMemo(() => Math.min(viewport.w / contentW, viewport.h / contentH) * 0.9, [viewport.w, viewport.h, contentW, contentH]);
    const minScale = fitScale * 0.5;
    const maxScale = 2.5;
    const getBounds = useCallback((scale: number) => {
        const el = containerRef.current;
        const w = el?.clientWidth ?? viewport.w;
        const h = el?.clientHeight ?? viewport.h;
        const sw = totalW * scale;
        const sh = totalH * scale;
        const cx = (w - sw) / 2;
        const xMin = sw > w ? w - sw : cx;
        const xMax = sw > w ? 0 : cx;
        const cy = (h - sh) / 2;
        const yMin = sh > h ? h - sh : cy;
        const yMax = sh > h ? 0 : cy;
        return { xMin, xMax, yMin, yMax };
    }, [totalH, totalW, viewport.h, viewport.w]);
    const [, api] = useSpring(() => ({
        x: 0, y: 0, scale: fitScale,
        config: { ...config.stiff, precision: 0.01 },
    }));
    const applyTransform = useCallback((x: number, y: number, s: number) => {
        if (!isFinite(x) || !isFinite(y) || !isFinite(s) || s <= 0)
            return;
        posRef.current = { x, y };
        scaleRef.current = s;
        const el = boardRef.current;
        if (el)
            el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
        onTransformChange?.(x, y, s);
    }, [onTransformChange]);
    const hasInitialized = useRef(false);
    useEffect(() => {
        if (!viewport.w || !viewport.h)
            return;
        const isInit = !hasInitialized.current;
        hasInitialized.current = true;
        const s = isInit ? fitScale : scaleRef.current;
        const b = getBounds(s);
        const fromX = isInit ? (viewport.w - totalW * s) / 2 : posRef.current.x;
        const fromY = isInit ? (viewport.h - totalH * s) / 2 : posRef.current.y;
        const x = clamp(fromX, b.xMin, b.xMax);
        const y = clamp(fromY, b.yMin, b.yMax);
        api.set({ scale: s, x, y });
        applyTransform(x, y, s);
    }, [api, applyTransform, fitScale, getBounds, totalH, totalW, viewport.h, viewport.w]);
    useEffect(() => {
        api.stop();
        api.set({
            x: posRef.current.x,
            y: posRef.current.y,
            scale: scaleRef.current,
        });
    }, [gesturesEnabled, api]);
    useGesture({
        onDrag: ({ offset: [x, y], down, pinching, cancel, last, first }) => {
            if (pinching)
                return cancel();
            if (first && shouldCancelGesturePointerRef.current)
                return cancel();
            const active = down && !last;
            const s = scaleRef.current;
            if (active) {
                applyTransform(x, y, s);
                api.set({ x, y, scale: s });
            }
            else {
                const b = getBounds(s);
                const tx = clamp(x, b.xMin, b.xMax);
                const ty = clamp(y, b.yMin, b.yMax);
                api.start({
                    from: { x: posRef.current.x, y: posRef.current.y, scale: scaleRef.current },
                    x: tx,
                    y: ty,
                    scale: s,
                    config: config.stiff,
                    onChange: ({ value }) => applyTransform(value.x, value.y, value.scale),
                });
            }
        },
        onPinch: ({ origin: [ox, oy], first, movement: [ms], memo }) => {
            if (first) {
                const el = containerRef.current;
                if (!el)
                    return;
                const rect = el.getBoundingClientRect();
                rectRef.current = rect;
                return {
                    s: scaleRef.current,
                    x: posRef.current.x,
                    y: posRef.current.y,
                    ox: ox - rect.left,
                    oy: oy - rect.top,
                };
            }
            const rect = rectRef.current!;
            const lx = ox - rect.left;
            const ly = oy - rect.top;
            const next = clamp(memo.s * ms, minScale * 0.8, maxScale * 1.5);
            const ratio = next / memo.s;
            const dx = lx - memo.ox;
            const dy = ly - memo.oy;
            const nx = memo.ox - (memo.ox - memo.x) * ratio + dx;
            const ny = memo.oy - (memo.oy - memo.y) * ratio + dy;
            applyTransform(nx, ny, next);
            api.set({ x: nx, y: ny, scale: next });
            return memo;
        },
        onPinchEnd: () => {
            const s = clamp(scaleRef.current, minScale, maxScale);
            const b = getBounds(s);
            const tx = clamp(posRef.current.x, b.xMin, b.xMax);
            const ty = clamp(posRef.current.y, b.yMin, b.yMax);
            api.start({
                scale: s,
                x: tx,
                y: ty,
                config: config.stiff,
                onChange: ({ value }) => applyTransform(value.x, value.y, value.scale),
            });
        },
        onWheel: ({ event, delta: [, dy] }) => {
            const rect = rectRef.current;
            if (!rect)
                return;
            const lx = event.clientX - rect.left;
            const ly = event.clientY - rect.top;
            const old = scaleRef.current;
            const next = clamp(old - dy * 0.002, minScale, maxScale);
            const ratio = next / old;
            const b = getBounds(next);
            const nx = clamp(lx - (lx - posRef.current.x) * ratio, b.xMin, b.xMax);
            const ny = clamp(ly - (ly - posRef.current.y) * ratio, b.yMin, b.yMax);
            applyTransform(nx, ny, next);
            api.set({ x: nx, y: ny, scale: next });
        },
    }, {
        target: containerRef,
        enabled: gesturesEnabled,
        drag: { from: () => [posRef.current.x, posRef.current.y], filterTaps: true },
        pinch: { pointer: { touch: true }, eventOptions: { passive: false } },
        wheel: { eventOptions: { passive: false } },
    });
    const resetView = useCallback(() => {
        const el = containerRef.current;
        if (!el)
            return;
        const w = el.clientWidth;
        const h = el.clientHeight;
        const s = Math.min(w / contentW, h / contentH) * 0.9;
        const pX = w / 2;
        const pY = h / 2;
        const tW = contentW + pX * 2;
        const tH = contentH + pY * 2;
        const x = (w - tW * s) / 2;
        const y = (h - tH * s) / 2;
        api.start({
            scale: s, x, y,
            config: { duration: 280, easing: (t: number) => 1 - (1 - t) ** 3 },
            onChange: ({ value }) => applyTransform(value.x, value.y, value.scale),
        });
    }, [api, applyTransform, contentH, contentW]);
    const lastTapRef = useRef(0);
    const hadMultiTouchRef = useRef(false);
    const touchStartRef = useRef<{
        x: number;
        y: number;
    } | null>(null);
    const touchGestureBlockedRef = useRef(false);
    const handleTouchStart = (e: React.TouchEvent) => {
        if (isBoardGestureBlockedTarget(e.target)) {
            touchGestureBlockedRef.current = true;
            touchStartRef.current = null;
            lastTapRef.current = 0;
            return;
        }
        touchGestureBlockedRef.current = false;
        if (e.touches.length >= 2) {
            hadMultiTouchRef.current = true;
        }
        else if (e.touches.length === 1) {
            touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchGestureBlockedRef.current) {
            touchGestureBlockedRef.current = false;
            return;
        }
        if (e.touches.length > 0 || e.changedTouches.length !== 1)
            return;
        if (hadMultiTouchRef.current) {
            hadMultiTouchRef.current = false;
            return;
        }
        if (!resetViewEnabled)
            return;
        const start = touchStartRef.current;
        if (start) {
            const dx = e.changedTouches[0].clientX - start.x;
            const dy = e.changedTouches[0].clientY - start.y;
            if (dx * dx + dy * dy > 64)
                return;
        }
        const now = Date.now();
        const gap = now - lastTapRef.current;
        if (gap < 300) {
            e.preventDefault();
            resetView();
        }
        lastTapRef.current = now;
    };
    useImperativeHandle(ref, () => ({
        cellAtPair: (viewportX, viewportY) => {
            const el = containerRef.current;
            if (!el) {
                return {
                    logical: null,
                    clamped: { row: 0, col: 0 },
                };
            }
            const rect = el.getBoundingClientRect();
            const localX = (viewportX - rect.left - posRef.current.x) / scaleRef.current - padX;
            const localY = (viewportY - rect.top - posRef.current.y) / scaleRef.current - padY;
            const unclampedCol = Math.floor(localX / cellSize);
            const unclampedRow = Math.floor(localY / cellSize);
            const logical = unclampedRow < 0 || unclampedRow >= rows || unclampedCol < 0 || unclampedCol >= cols
                ? null
                : { row: unclampedRow, col: unclampedCol };
            const clamped = {
                row: clamp(unclampedRow, 0, rows - 1),
                col: clamp(unclampedCol, 0, cols - 1),
            };
            return { logical, clamped };
        },
        cellAt: (viewportX, viewportY) => {
            const el = containerRef.current;
            if (!el)
                return null;
            const rect = el.getBoundingClientRect();
            const localX = (viewportX - rect.left - posRef.current.x) / scaleRef.current - padX;
            const localY = (viewportY - rect.top - posRef.current.y) / scaleRef.current - padY;
            const col = Math.floor(localX / cellSize);
            const row = Math.floor(localY / cellSize);
            if (row < 0 || row >= rows || col < 0 || col >= cols)
                return null;
            return { row, col };
        },
        cellAtUnclamped: (viewportX, viewportY) => {
            const el = containerRef.current;
            if (!el)
                return null;
            const rect = el.getBoundingClientRect();
            const localX = (viewportX - rect.left - posRef.current.x) / scaleRef.current - padX;
            const localY = (viewportY - rect.top - posRef.current.y) / scaleRef.current - padY;
            return {
                row: Math.floor(localY / cellSize),
                col: Math.floor(localX / cellSize),
            };
        },
        cellRect: (row, col) => {
            const el = containerRef.current;
            if (!el)
                return null;
            if (row < 0 || row >= rows || col < 0 || col >= cols)
                return null;
            const rect = rectRef.current ?? el.getBoundingClientRect();
            const s = scaleRef.current;
            const left = rect.left + posRef.current.x + (padX + col * cellSize) * s;
            const top = rect.top + posRef.current.y + (padY + row * cellSize) * s;
            const size = cellSize * s;
            return { left, top, width: size, height: size };
        },
        cellRectAt: (row, col) => {
            const el = containerRef.current;
            if (!el)
                return null;
            const rect = rectRef.current ?? el.getBoundingClientRect();
            const s = scaleRef.current;
            const left = rect.left + posRef.current.x + (padX + col * cellSize) * s;
            const top = rect.top + posRef.current.y + (padY + row * cellSize) * s;
            const size = cellSize * s;
            return { left, top, width: size, height: size };
        },
        setHoverCell: (row, col) => {
            const el = hoverOverlayRef.current;
            if (el) {
                el.style.display = 'block';
                el.style.transform = `translate(${col * cellSize}px, ${row * cellSize}px)`;
            }
            const g = groupHoverRef.current;
            if (g) {
                for (let i = 0; i < groupHoverPrevCountRef.current; i++) {
                    (g.children[i] as HTMLDivElement).style.display = 'none';
                }
                groupHoverPrevCountRef.current = 0;
            }
        },
        clearHoverCell: () => {
            const el = hoverOverlayRef.current;
            if (el)
                el.style.display = 'none';
            const g = groupHoverRef.current;
            if (g) {
                for (let i = 0; i < groupHoverPrevCountRef.current; i++) {
                    (g.children[i] as HTMLDivElement).style.display = 'none';
                }
                groupHoverPrevCountRef.current = 0;
            }
        },
        setHoverCells: (cells) => {
            const g = groupHoverRef.current;
            if (!g)
                return;
            const single = hoverOverlayRef.current;
            if (single)
                single.style.display = 'none';
            while (g.children.length < cells.length) {
                const div = document.createElement('div');
                div.style.cssText = `display:none;position:absolute;top:0;left:0;width:${cellSize}px;height:${cellSize}px;border-radius:0.25rem;pointer-events:none;z-index:10`;
                g.appendChild(div);
            }
            const prev = groupHoverPrevCountRef.current;
            for (let i = cells.length; i < prev; i++) {
                (g.children[i] as HTMLDivElement).style.display = 'none';
            }
            groupHoverPrevCountRef.current = cells.length;
            for (let i = 0; i < cells.length; i++) {
                const div = g.children[i] as HTMLDivElement;
                const { row, col, valid } = cells[i];
                div.style.display = 'block';
                div.style.transform = `translate(${col * cellSize}px, ${row * cellSize}px)`;
                div.style.background = valid ? 'rgba(133,219,248,0.3)' : 'rgba(239,68,68,0.25)';
            }
        },
        resetDoubleTapDetector: () => { lastTapRef.current = 0; },
        getTransform: () => ({ x: posRef.current.x, y: posRef.current.y, scale: scaleRef.current }),
    }), [rows, cols, cellSize, padX, padY]);
    const grid = useMemo(() => {
        const cells: ReactNode[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const content = renderCell(r, c);
                if (!content)
                    continue;
                cells.push(<div key={`${r}-${c}`} className="relative" style={{
                        gridRow: r + 1,
                        gridColumn: c + 1,
                        width: cellSize,
                        height: cellSize,
                    }}>
            {content}
          </div>);
            }
        }
        return (<div style={{
                width: totalW,
                height: totalH,
                padding: `${padY}px ${padX}px`,
                boxSizing: 'border-box',
            }}>
        <div className="bg-primary-container/20" style={{
                position: 'relative',
                width: contentW,
                height: contentH,
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
                contain: 'layout style paint',
                backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${cellSize}' height='${cellSize}'><rect width='${cellSize}' height='${cellSize}' fill='none' stroke='rgba(0,110,134,0.3)' stroke-width='1' stroke-dasharray='4,4'/></svg>`)}")`,
                backgroundSize: `${cellSize}px ${cellSize}px`,
            }}>
          {cells}

          <div ref={hoverOverlayRef} style={{
                display: 'none',
                position: 'absolute',
                top: 0,
                left: 0,
                width: cellSize,
                height: cellSize,
                background: 'rgba(133, 219, 248, 0.3)',
                borderRadius: '0.25rem',
                pointerEvents: 'none',
                zIndex: 10,
            }}/>
          <div ref={groupHoverRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}/>
        </div>
      </div>);
    }, [rows, cols, cellSize, contentW, contentH, totalW, totalH, padX, padY, renderCell]);
    return (<div ref={containerRef} className="h-full w-full overflow-hidden relative touch-none active:cursor-move select-none" onDoubleClick={resetViewEnabled ? resetView : undefined} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div ref={boardRef} data-board className="origin-top-left" style={{
            willChange: 'transform',
            transform: INITIAL_BOARD_TRANSFORM,
        }}>
        {grid}
      </div>
    </div>);
});
export default memo(Board);
