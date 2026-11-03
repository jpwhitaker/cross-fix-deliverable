import { create } from 'zustand';
import type { FloatGroupMember, FloatGroupState } from '@/lib/modes/move-policy';
export type { FloatGroupMember, FloatGroupState };
export type BoardTool = 'hand' | 'select' | 'move' | 'inspect' | 'ride';
export type RideBrushDraft = {
    boardKey: string;
    tileIds: string[];
};
interface UIState {
    leftTool: BoardTool;
    selectedTileIds: Set<string>;
    anchorTileId: string | null;
    floatGroup: FloatGroupState | null;
    rideDraft: RideBrushDraft | null;
    setLeftTool: (tool: BoardTool) => void;
    setAnchorTileId: (id: string | null) => void;
    addSelectedTile: (tileId: string) => void;
    removeSelectedTile: (tileId: string) => void;
    toggleSelectedTile: (tileId: string) => void;
    clearSelectedTiles: () => void;
    pruneSelectedTiles: (validIds: Set<string>) => void;
    enterFloat: (members: FloatGroupMember[], anchorRow: number, anchorCol: number) => void;
    toggleFloatOrientation: () => void;
    setFloatPosition: (row: number, col: number) => void;
    exitFloat: () => void;
}
export const useUIStore = create<UIState>((set) => ({
    leftTool: 'hand',
    selectedTileIds: new Set(),
    anchorTileId: null,
    floatGroup: null,
    rideDraft: null,
    setLeftTool: (tool) => set({ leftTool: tool }),
    setAnchorTileId: (id) => set({ anchorTileId: id }),
    addSelectedTile: (tileId) => set((state) => {
        if (state.selectedTileIds.has(tileId))
            return {};
        const next = new Set(state.selectedTileIds);
        next.add(tileId);
        return {
            selectedTileIds: next,
            anchorTileId: state.anchorTileId ?? tileId,
            floatGroup: null,
        };
    }),
    removeSelectedTile: (tileId) => set((state) => {
        if (!state.selectedTileIds.has(tileId))
            return {};
        const next = new Set(state.selectedTileIds);
        next.delete(tileId);
        const nextAnchor = state.anchorTileId === tileId
            ? (next.size > 0 ? (next.values().next().value as string) : null)
            : state.anchorTileId;
        return {
            selectedTileIds: next,
            anchorTileId: nextAnchor,
            floatGroup: null,
        };
    }),
    toggleSelectedTile: (tileId) => set((state) => {
        const next = new Set(state.selectedTileIds);
        let nextAnchor = state.anchorTileId;
        if (next.has(tileId)) {
            next.delete(tileId);
            if (nextAnchor === tileId) {
                nextAnchor = next.size > 0 ? (next.values().next().value as string) : null;
            }
        }
        else {
            next.add(tileId);
            if (!nextAnchor)
                nextAnchor = tileId;
        }
        return { selectedTileIds: next, anchorTileId: nextAnchor, floatGroup: null };
    }),
    clearSelectedTiles: () => set({ selectedTileIds: new Set(), anchorTileId: null, floatGroup: null }),
    pruneSelectedTiles: (validIds) => set((state) => {
        const stale = [...state.selectedTileIds].filter((id) => !validIds.has(id));
        if (stale.length === 0)
            return {};
        const next = new Set(state.selectedTileIds);
        stale.forEach((id) => next.delete(id));
        const nextAnchor = state.anchorTileId && validIds.has(state.anchorTileId) ? state.anchorTileId : null;
        return { selectedTileIds: next, anchorTileId: nextAnchor, floatGroup: null };
    }),
    enterFloat: (members, anchorRow, anchorCol) => set({
        floatGroup: {
            baseMembers: members,
            anchorRow,
            anchorCol,
            orientation: 'base',
            floatRow: anchorRow,
            floatCol: anchorCol,
        },
    }),
    toggleFloatOrientation: () => set((state) => {
        if (!state.floatGroup)
            return {};
        return {
            floatGroup: {
                ...state.floatGroup,
                orientation: state.floatGroup.orientation === 'base' ? 'alternate' : 'base',
            },
        };
    }),
    setFloatPosition: (row, col) => set((state) => {
        if (!state.floatGroup)
            return {};
        return {
            floatGroup: {
                ...state.floatGroup,
                floatRow: row,
                floatCol: col,
            },
        };
    }),
    exitFloat: () => set({ floatGroup: null }),
}));
export const selectLeftTool = (state: UIState) => state.leftTool;
export const selectSetLeftTool = (state: UIState) => state.setLeftTool;
export const selectAddSelectedTile = (state: UIState) => state.addSelectedTile;
export const selectRemoveSelectedTile = (state: UIState) => state.removeSelectedTile;
export const selectToggleSelectedTile = (state: UIState) => state.toggleSelectedTile;
export const selectClearSelectedTiles = (state: UIState) => state.clearSelectedTiles;
export const selectPruneSelectedTiles = (state: UIState) => state.pruneSelectedTiles;
export const selectAnchorTileId = (state: UIState) => state.anchorTileId;
export const selectSetAnchorTileId = (state: UIState) => state.setAnchorTileId;
export const selectFloatGroup = (state: UIState) => state.floatGroup;
export const selectEnterFloat = (state: UIState) => state.enterFloat;
export const selectToggleFloatOrientation = (state: UIState) => state.toggleFloatOrientation;
export const selectSetFloatPosition = (state: UIState) => state.setFloatPosition;
export const selectExitFloat = (state: UIState) => state.exitFloat;
export const selectIsTileSelected = (tileId?: string) => (state: UIState) => !!tileId && state.selectedTileIds.has(tileId);
