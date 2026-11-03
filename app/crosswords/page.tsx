'use client';
import { useEffect } from 'react';
import { useGameStore } from '@/lib/game-store';
import GameBoardClient from '@/app/keiki-play/GameBoardClient';
export default function CrosswordsPage() {
    const modeId = useGameStore((s) => s.modeId);
    useEffect(() => {
        if (modeId !== 'crosswords') {
            useGameStore.setState({ modeId: 'crosswords' });
            useGameStore.getState().resetBoard();
        }
    }, [modeId]);
    return <GameBoardClient />;
}
