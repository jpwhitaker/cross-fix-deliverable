'use client';
import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore } from '@/lib/game-store';
import { RegularTileFace } from '@/components/RegularTileFace';
import { usePenFriendlyPress } from '@/hooks/usePenFriendlyPress';
import type { Letter } from '@/lib/tiles';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as Letter[];
export type WildcardLetterTarget = {
    source: 'board';
    row: number;
    col: number;
} | {
    source: 'hand';
    tileId: string;
};
export default function WildcardLetterModal({ open, target, onClose, }: {
    open: boolean;
    target: WildcardLetterTarget;
    onClose: () => void;
}) {
    const setWildcardLetter = useGameStore((s) => s.setWildcardLetter);
    const setHandWildcardLetter = useGameStore((s) => s.setHandWildcardLetter);
    const cell = useGameStore((s) => target.source === 'board' ? s.board[target.row]?.[target.col] : undefined);
    const handTile = useGameStore((s) => target.source === 'hand' ? s.hand.find((tile) => tile.id === target.tileId) : undefined);
    const currentLetter: Letter | null = target.source === 'board'
        ? (cell?.kind === 'wildcard' ? (cell.representsLetter ?? null) : null)
        : (handTile?.kind === 'regular' ? (handTile.wildcardRepresentsLetter ?? null) : null);
    const press = usePenFriendlyPress<HTMLButtonElement>();
    const handleSelect = (letter: Letter) => {
        if (target.source === 'board') {
            setWildcardLetter(target.row, target.col, letter);
        }
        else {
            setHandWildcardLetter(target.tileId, letter);
        }
        onClose();
    };
    return (<AnimatePresence>
      {open && (<Dialog static open={open} onClose={onClose} className="relative z-[100]">
          <motion.div className="fixed inset-0 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose}/>
          <div className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-6 pointer-events-none">
            <motion.div className="relative w-full sm:max-w-lg p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 rounded-t-[20px] sm:rounded-[20px] pointer-events-auto" initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={{ type: 'spring', damping: 22, stiffness: 260 }} style={{
                background: '#fefee5',
                border: '3px solid #111',
                boxShadow: '8px 8px 0 #111',
            }}>
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#555] text-center mb-4">
                Choose a letter
              </p>
              <div className="grid grid-cols-7 gap-2">
                {ALPHABET.map((letter) => (<button key={letter} {...press(() => handleSelect(letter))} className="relative aspect-square w-full cursor-pointer transition-transform active:scale-90">
                    <RegularTileFace letter={letter} value={1} isPickTile={false} isWildcard={letter === currentLetter}/>
                  </button>))}
              </div>
            </motion.div>
          </div>
        </Dialog>)}
    </AnimatePresence>);
}
