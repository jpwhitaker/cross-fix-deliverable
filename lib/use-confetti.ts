import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
export function useConfetti(active: boolean) {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        if (!active)
            return;
        const duration = 15000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 200, scalar: 1.3, gravity: 0.8 };
        function randomInRange(min: number, max: number) {
            return Math.random() * (max - min) + min;
        }
        intervalRef.current = setInterval(() => {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) {
                if (intervalRef.current)
                    clearInterval(intervalRef.current);
                return;
            }
            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 400);
        return () => {
            if (intervalRef.current)
                clearInterval(intervalRef.current);
        };
    }, [active]);
}
