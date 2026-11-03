'use client';
import { useEffect } from 'react';
import { useGameStore } from '@/lib/game-store';
import GameBoardClient from '@/app/keiki-play/GameBoardClient';
import { enterSurfFixGameSession } from '@/lib/surf-fix-game-session';
import { SURF_FIX_GAME } from '@/lib/game-settings';
export default function SurfFixPage() {
    const modeId = useGameStore((s) => s.modeId);
    useEffect(() => {
        if (modeId !== 'surf-fix') {
            useGameStore.setState({ modeId: 'surf-fix', authoring: SURF_FIX_GAME });
            useGameStore.getState().resetBoard();
        }
        return enterSurfFixGameSession();
    }, [modeId]);
    return <GameBoardClient />;
}
