import { useGameStore } from './game-store';
import { SURF_FIX_GAME } from './game-settings';
export function enterSurfFixGameSession(gameStore = useGameStore): () => void {
    const configure = () => {
        const state = gameStore.getState();
        if (state.modeId !== 'surf-fix')
            return;
        if (Object.entries(SURF_FIX_GAME).every(([key, value]) => state.authoring?.[key as keyof typeof SURF_FIX_GAME] === value))
            return;
        gameStore.setState({ authoring: SURF_FIX_GAME });
    };
    configure();
    const unsubscribe = gameStore.subscribe(configure);
    return unsubscribe;
}
