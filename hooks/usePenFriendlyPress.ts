'use client';
import { useCallback, useRef, type MouseEvent, type PointerEvent } from 'react';
type PressEvent<T extends HTMLElement> = MouseEvent<T> | PointerEvent<T>;
type PressHandler<T extends HTMLElement> = (event: PressEvent<T>) => void;
export function usePenFriendlyPress<T extends HTMLElement = HTMLButtonElement>() {
    const suppressNextClickRef = useRef(false);
    return useCallback((onPress: PressHandler<T>) => ({
        onPointerUp: (event: PointerEvent<T>) => {
            if (event.pointerType !== 'pen')
                return;
            event.preventDefault();
            event.stopPropagation();
            suppressNextClickRef.current = true;
            onPress(event);
        },
        onClick: (event: MouseEvent<T>) => {
            if (suppressNextClickRef.current) {
                suppressNextClickRef.current = false;
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            onPress(event);
        },
    }), []);
}
