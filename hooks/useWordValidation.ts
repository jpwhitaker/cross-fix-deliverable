'use client';
import { useRef, useEffect } from 'react';
import { useGameStore } from '@/lib/game-store';
import { extractWords, type ExtractedWord } from '@/lib/dictionary';
import { getValidWordPositionKeysFromExtractedWords, isValidHighlightWord as defaultIsValid } from '@/lib/predicates/word/getValidWordPositionKeys';
export function useWordValidation(isValidFn: (word: Pick<ExtractedWord, 'valid' | 'word'>) => boolean = defaultIsValid) {
    const prevValidWordsRef = useRef<Set<string>>(new Set());
    const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        let prevBoard = useGameStore.getState().board;
        let prevSubmittedPositions = useGameStore.getState().submittedPositions;
        const unsub = useGameStore.subscribe((state) => {
            if (state.board === prevBoard && state.submittedPositions === prevSubmittedPositions)
                return;
            prevBoard = state.board;
            prevSubmittedPositions = state.submittedPositions;
            const words = extractWords(state.board);
            const positions = getValidWordPositionKeysFromExtractedWords(words);
            const currentValidWordSignatures = new Set<string>();
            const wordSignature = (w: ExtractedWord) => {
                const coords = w.positions.map((p) => `${p.row}-${p.col}`).join('|');
                const composition = w.positions.map((p) => {
                    const c = state.board[p.row]?.[p.col];
                    if (!c || c.kind === 'empty')
                        return '_';
                    if (c.kind === 'regular')
                        return c.isPickTile ? 'P' : 'R';
                    if (c.kind === 'double')
                        return 'D';
                    if (c.kind === 'switch')
                        return 'S';
                    return 'W';
                }).join('');
                return `${w.word}|${coords}|${composition}`;
            };
            for (const w of words) {
                if (!isValidFn(w))
                    continue;
                currentValidWordSignatures.add(wordSignature(w));
            }
            const newWords = words.filter((w) => isValidFn(w) && !prevValidWordsRef.current.has(wordSignature(w)));
            if (flashTimerRef.current)
                clearTimeout(flashTimerRef.current);
            if (animTimerRef.current)
                clearTimeout(animTimerRef.current);
            if (newWords.length > 0) {
                const delays = new Map<string, number>();
                for (const word of newWords) {
                    word.positions.forEach((pos, i) => {
                        const key = `${pos.row}-${pos.col}`;
                        if (!delays.has(key))
                            delays.set(key, i);
                    });
                }
                useGameStore.setState({ validPositions: positions, animatingPositions: delays });
                const maxDelay = Math.max(...delays.values());
                animTimerRef.current = setTimeout(() => useGameStore.setState({ validPositions: null, animatingPositions: null }), (maxDelay + 1) * 80 + 400);
            }
            else {
                useGameStore.setState({ validPositions: positions.size > 0 ? positions : null });
                flashTimerRef.current = setTimeout(() => useGameStore.setState({ validPositions: null }), 1000);
            }
            prevValidWordsRef.current = currentValidWordSignatures;
        });
        return () => {
            unsub();
            if (animTimerRef.current)
                clearTimeout(animTimerRef.current);
            if (flashTimerRef.current)
                clearTimeout(flashTimerRef.current);
        };
    }, [isValidFn]);
}
