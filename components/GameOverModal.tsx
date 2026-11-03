'use client';
import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'motion/react';
import { PiArrowCounterClockwiseBold } from 'react-icons/pi';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useGameStore, selectScore, selectRoundWordPills, selectVisiblePlayedWords, selectRound } from '@/lib/game-store';
import type { RoundWordPill } from '@/lib/presentation/round-word-pills';
import { useConfetti } from '@/lib/use-confetti';
import { usePenFriendlyPress } from '@/hooks/usePenFriendlyPress';
import useSound from 'use-sound';
import SoundToggle from '@/components/SoundToggle';
function CountUp({ target, duration = 2000 }: {
    target: number;
    duration?: number;
}) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (target === 0)
            return;
        const start = performance.now();
        let raf: number;
        function tick(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1)
                raf = requestAnimationFrame(tick);
        }
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return <>{value}</>;
}
const PILL_COLORS = ['#fce49a', '#98d4ec', '#a2c25f', '#ffb73f'];
export function scoredGameOverPills(pills: readonly RoundWordPill[]): RoundWordPill[] {
    return pills.flatMap((pill) => {
        if (pill.ride.role === 'sbs')
            return [];
        return [{
                ...pill,
                extras: pill.extras.filter((entry) => entry.role !== 'sbs'),
            }];
    });
}
function WordPill({ rideWord, totalPoints, extras, colorIndex, }: {
    rideWord: string;
    totalPoints: number;
    extras: Array<{
        word: string;
        points: number;
    }>;
    colorIndex: number;
}) {
    return (<div className="inline-flex flex-col gap-1 px-3 py-2" style={{
            background: PILL_COLORS[colorIndex % PILL_COLORS.length],
            border: '2px solid #111',
            borderRadius: 14,
            boxShadow: '2px 2px 0 #111',
        }}>
      <span className="inline-flex items-center gap-1.5">
        <span className="font-headline font-black text-sm uppercase text-[#111]">{rideWord}</span>
        <span className="font-mono text-[11px] font-bold text-[#111]">+{totalPoints}</span>
      </span>
      {extras.map((extra, i) => (<span key={`${extra.word}-${i}`} className="inline-flex items-center gap-1.5 opacity-80">
          <span className="font-headline font-bold text-[11px] uppercase text-[#111]">{extra.word}</span>
          <span className="font-mono text-[10px] font-bold text-[#111]">+{extra.points}</span>
        </span>))}
    </div>);
}
export default function GameOverModal({ open, onClose, onPlayAgain, }: {
    open: boolean;
    onClose: () => void;
    onPlayAgain: () => void;
}) {
    const score = useGameStore(selectScore);
    const roundPills = useGameStore(selectRoundWordPills);
    const visibleWords = useGameStore(selectVisiblePlayedWords);
    const round = useGameStore(selectRound);
    const [playClick] = useSound('/sounds/ui-click.wav');
    const [playWin] = useSound('/sounds/ui-win.wav');
    useConfetti(open);
    useEffect(() => {
        if (open)
            playWin();
    }, [open, playWin]);
    const bestWord = useMemo(() => visibleWords.reduce((best, word) => (word.points > best.points ? { word: word.word, points: word.points } : best), { word: '', points: 0 }), [visibleWords]);
    const sortedPills = useMemo(() => scoredGameOverPills(roundPills).sort((a, b) => b.round - a.round), [roundPills]);
    const press = usePenFriendlyPress<HTMLButtonElement>();
    const handlePlayAgain = () => {
        playClick();
        onPlayAgain();
    };
    return (<AnimatePresence>
      {open && (<Dialog static open={open} onClose={onClose} className="relative z-[100]">

          <motion.div className="fixed inset-0 bg-black/50" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}/>


          <div className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
            <motion.div className="relative w-full sm:max-w-lg p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:p-10 sm:pb-10 overflow-hidden rounded-t-[20px] sm:rounded-[20px]" onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={{ type: 'spring', damping: 22, stiffness: 260 }} style={{
                background: '#fefee5',
                border: '3px solid #111',
                boxShadow: '8px 8px 0 #111',
            }}>

              <button {...press(() => onClose())} className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 w-9 h-9 flex items-center justify-center cursor-pointer transition-transform active:scale-90" style={{
                background: '#fff',
                border: '2px solid #111',
                borderRadius: '50%',
                boxShadow: '2px 2px 0 #111',
            }}>
                <XMarkIcon className="w-4 h-4 text-[#111]"/>
              </button>


              <div className="relative text-center mb-8">
                <p className="font-mono text-[12px] font-bold uppercase tracking-widest text-[#111] mb-4">
                  Game Complete
                </p>


                <div className="inline-flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 rounded-full mx-auto mb-3" style={{
                background: 'linear-gradient(145deg, #FFD700, #FFA500)',
                border: '3px solid #111',
            }}>
                  <span className="font-headline font-black text-4xl sm:text-5xl text-white tracking-tight">
                    <CountUp target={score}/>
                  </span>
                </div>

                <p className="font-mono text-[13px] font-bold text-[#555] mt-1">
                  points across {round} rounds
                </p>
              </div>


              {bestWord.points > 0 && (<div className="relative flex justify-center mb-8">
                  <div className="flex flex-col items-center gap-1 px-6 py-3" style={{
                    background: '#fce49a',
                    border: '2px solid #111',
                    borderRadius: 14,
                    boxShadow: '3px 3px 0 #111',
                }}>
                    <span className="font-headline font-black text-xl sm:text-2xl text-[#111] uppercase">
                      {bestWord.word}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-[#555]">
                      Best Word +{bestWord.points}
                    </span>
                  </div>
                </div>)}


              {sortedPills.length > 0 && (<div className="relative mb-8">
                  <div className="flex flex-wrap gap-2">
                    {sortedPills.map((pill, i) => (<WordPill key={`${pill.round}-${pill.ride.word}-${i}`} rideWord={pill.ride.word} totalPoints={pill.totalPoints} extras={pill.extras} colorIndex={i}/>))}
                  </div>
                </div>)}


              <div className="relative flex flex-col items-center">
                <button {...press(handlePlayAgain)} className="w-full sm:w-auto px-10 sm:px-12 py-4 sm:py-5 font-black text-lg sm:text-xl font-headline text-white cursor-pointer transition-transform active:scale-95 flex items-center justify-center gap-3" style={{
                background: '#38bdf8',
                border: '3px solid #111',
                borderRadius: 999,
                boxShadow: '4px 4px 0 #111',
            }}>
                  <PiArrowCounterClockwiseBold className="text-2xl"/>
                  Play Again
                </button>
              </div>
              <div className="mt-5 flex justify-center"><SoundToggle /></div>
            </motion.div>
          </div>
        </Dialog>)}
    </AnimatePresence>);
}
