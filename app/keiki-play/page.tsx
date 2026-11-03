'use client';
import { useEffect } from 'react';
import { useGameStore } from '@/lib/game-store';
import GameBoardClient from './GameBoardClient';
export default function KeikiPlayPage() {
    const modeId = useGameStore((s) => s.modeId);
    useEffect(() => {
        if (modeId !== 'keiki-play') {
            useGameStore.setState({ modeId: 'keiki-play' });
            useGameStore.getState().resetBoard();
        }
    }, [modeId]);
    return <GameBoardClient />;
}
