'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
interface WordToastProps {
    message: string;
    onComplete: () => void;
    theme?: 'default' | 'success' | 'rerun' | 'error';
    variant?: 'default' | 'editorial';
}
const HANG_EASE = (t: number) => {
    const k = 2.8;
    const divisor = 2 * Math.tan(k / 2);
    return 0.5 + Math.tan(k * (t - 0.5)) / divisor;
};
export default function WordToast({ message, onComplete, theme = 'default', variant = 'default' }: WordToastProps) {
    const yPosition = useMotionValue(75);
    const isEditorial = variant === 'editorial';
    const bgColor = isEditorial
        ? theme === 'success' ? '#a2c25f'
            : theme === 'rerun' ? '#98d4ec'
                : theme === 'error' ? '#ffb3ae'
                    : '#fce49a'
        : theme === 'rerun' ? 'rgba(224, 247, 255, 0.95)'
            : theme === 'error' ? 'rgba(255, 213, 209, 0.97)'
                : 'rgba(239, 240, 209, 0.9)';
    const textColor = isEditorial ? '#111' : theme === 'rerun' ? '#0284c7' : theme === 'error' ? '#9b1c1c' : 'var(--on-surface)';
    const shadowColor = theme === 'rerun'
        ? 'rgba(2, 132, 199, 0.25)'
        : theme === 'error'
            ? 'rgba(185, 28, 28, 0.3)'
            : 'rgba(55, 57, 40, 0.2)';
    const top = useTransform(yPosition, (val: number) => `${val}dvh`);
    const scale = useTransform(yPosition, (y: number) => {
        const progress = (75 - y) / 50;
        const skewedProgress = Math.pow(progress, 0.75);
        return 0.8 + (0.2 * Math.sin(skewedProgress * Math.PI));
    });
    const opacity = useTransform(yPosition, (y: number) => {
        const progress = (75 - y) / 50;
        return Math.min(1, progress * 5, (1 - progress) * 5);
    });
    const onCompleteRef = useRef(onComplete);
    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
    useEffect(() => {
        const controls = animate(yPosition, 25, {
            duration: 3.5,
            ease: HANG_EASE,
            onComplete: () => onCompleteRef.current(),
        });
        return () => controls.stop();
    }, [yPosition]);
    return createPortal(<motion.div aria-live="polite" className="left-1/2 z-[200] px-5 sm:px-8 py-4 rounded-2xl text-center font-headline font-extrabold text-xl sm:text-3xl pointer-events-none max-w-[85dvw] text-balance" style={{
            position: 'fixed',
            x: '-50%',
            top,
            scale,
            opacity,
            background: bgColor,
            color: textColor,
            borderRadius: isEditorial ? 16 : '1rem',
            border: isEditorial ? '3px solid #111' : undefined,
            boxShadow: isEditorial ? '5px 5px 0 #111' : `0 12px 32px -8px ${shadowColor}`,
            backdropFilter: isEditorial ? undefined : 'blur(12px)',
            WebkitBackdropFilter: isEditorial ? undefined : 'blur(12px)',
        }}>
      {message}
    </motion.div>, document.body);
}
