'use client';
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogPanel, DialogBackdrop } from '@headlessui/react';
import { useSpring, animated } from '@react-spring/web';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ArrowRightIcon } from '@heroicons/react/24/solid';
import useSound from 'use-sound';
import SoundToggle from '@/components/SoundToggle';
import { useGameStore, selectTimerEnabled, selectTimerMinutes1_12, selectTimerMinutes13_16, } from '@/lib/game-store';
import { usePenFriendlyPress } from '@/hooks/usePenFriendlyPress';
import { supportsRoundTimer } from '@/lib/modes/ui-capabilities';
import { loadTimerPrefs, saveTimerPrefs, clearTimerPrefs } from '@/lib/util/timer-prefs';
let _Howler: {
    ctx?: AudioContext;
} | null = null;
if (typeof window !== 'undefined') {
    import('howler').then((mod) => {
        const maybeHowler = mod as {
            Howler?: {
                ctx?: AudioContext;
            };
            default?: {
                Howler?: {
                    ctx?: AudioContext;
                };
            };
        };
        _Howler = maybeHowler.Howler ?? maybeHowler.default?.Howler ?? null;
    });
}
const AnimatedDialogPanel = animated(DialogPanel);
const AnimatedDialogBackdrop = animated(DialogBackdrop);
const STEPS = [
    {
        number: '1',
        title: 'Drag Your Letters',
        desc: 'Grab floating letters from the bottom and drag them onto the board.',
        badgeColor: '#fce49a',
    },
    {
        number: '2',
        title: 'Build Words',
        desc: 'Spell out words horizontally or vertically.',
        badgeColor: '#98d4ec',
    },
    {
        number: '3',
        title: 'Flip Tiles',
        desc: 'Notice a tile with arrows? Tap it to flip it over and find the perfect match.',
        badgeColor: '#a2c25f',
    },
    {
        number: '4',
        title: 'High Score',
        desc: "You have twelve rounds to build twelve words. The dots on tiles show point values — make long words for a better score!",
        badgeColor: '#ffb73f',
    },
] as const;
function unlockAudio() {
    try {
        if (_Howler?.ctx?.state === 'suspended')
            _Howler.ctx.resume();
    }
    catch { }
}
function clampMinutes(minutes: number): number {
    return Math.max(1, Math.min(10, Math.floor(minutes)));
}
export default function RulesModal({ onDismiss }: {
    onDismiss?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const hasShown = useRef(false);
    const [playClick] = useSound('/sounds/ui-click.wav');
    const modeId = useGameStore((s) => s.modeId);
    const timerEnabled = useGameStore(selectTimerEnabled);
    const timerMinutes1_12 = useGameStore(selectTimerMinutes1_12);
    const timerMinutes13_16 = useGameStore(selectTimerMinutes13_16);
    const setTimerEnabled = useGameStore((s) => s.setTimerEnabled);
    const setTimerMinutes1_12 = useGameStore((s) => s.setTimerMinutes1_12);
    const setTimerMinutes13_16 = useGameStore((s) => s.setTimerMinutes13_16);
    const [localTimerEnabled, setLocalTimerEnabled] = useState(timerEnabled);
    const [localTimerMinutes1_12, setLocalTimerMinutes1_12] = useState(timerMinutes1_12);
    const [localTimerMinutes13_16, setLocalTimerMinutes13_16] = useState(timerMinutes13_16);
    const [rememberTimer, setRememberTimer] = useState(() => loadTimerPrefs(modeId)?.remember ?? false);
    const press = usePenFriendlyPress<HTMLButtonElement>();
    const timerSupported = supportsRoundTimer(modeId);
    useEffect(() => {
        if (!hasShown.current) {
            const timer = setTimeout(() => {
                setOpen(true);
                hasShown.current = true;
            }, 150);
            return () => clearTimeout(timer);
        }
    }, []);
    const backdropSpring = useSpring({
        opacity: open ? 1 : 0,
        config: { tension: 300, friction: 26 },
    });
    const panelSpring = useSpring({
        opacity: open ? 1 : 0,
        scale: open ? 1 : 0.9,
        config: { tension: 300, friction: 18 },
    });
    const applyTimerSettings = () => {
        if (!timerSupported)
            return;
        const mins1_12 = clampMinutes(localTimerMinutes1_12);
        const mins13_16 = clampMinutes(localTimerMinutes13_16);
        setTimerEnabled(localTimerEnabled);
        setTimerMinutes1_12(mins1_12);
        setTimerMinutes13_16(mins13_16);
        if (rememberTimer) {
            saveTimerPrefs(modeId, {
                remember: true,
                timerEnabled: localTimerEnabled,
                timerMinutes1_12: mins1_12,
                timerMinutes13_16: mins13_16,
            });
        }
        else {
            clearTimerPrefs(modeId);
        }
    };
    const dismissModal = (withClickSound: boolean) => {
        if (withClickSound)
            playClick();
        unlockAudio();
        applyTimerSettings();
        setOpen(false);
        onDismiss?.();
    };
    return (<Dialog open={open} onClose={() => dismissModal(false)} className="relative z-[100]">
      <AnimatedDialogBackdrop className="fixed inset-0 bg-black/50" style={{ opacity: backdropSpring.opacity }}/>

      <div className="fixed inset-0 overflow-hidden flex items-end sm:items-center justify-center sm:p-6">
        <AnimatedDialogPanel className="relative w-full sm:max-w-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-10 sm:pb-10 max-h-[85dvh] sm:max-h-none overflow-x-hidden overflow-y-auto sm:overflow-visible rounded-t-[20px] sm:rounded-[20px]" style={{
            background: '#fefee5',
            border: '3px solid #111',
            boxShadow: panelSpring.scale.to(s => `${8 * s}px ${8 * s}px 0 #111`),
            opacity: panelSpring.opacity,
            transform: panelSpring.scale.to(s => `scale(${s})`),
            willChange: 'transform, opacity',
        }}>

          <div className="relative flex justify-between items-start mb-8 sm:mb-10">
            <h1 className="text-3xl sm:text-5xl font-extrabold text-[#111] tracking-tight font-headline">
              How to Play
            </h1>
            <button {...press(() => dismissModal(false))} className="flex items-center justify-center cursor-pointer transition-transform active:scale-90 flex-shrink-0" style={{
            width: 36,
            height: 36,
            background: '#fff',
            border: '2px solid #111',
            borderRadius: '50%',
            boxShadow: '2px 2px 0 #111',
        }}>
              <XMarkIcon className="w-4 h-4 text-[#111]"/>
            </button>
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 relative z-10">
            {STEPS.map((step) => (<div key={step.number} className="flex flex-col gap-3 p-4 sm:p-5" style={{
                background: '#fff',
                border: '2px solid #111',
                borderRadius: 14,
                boxShadow: '3px 3px 0 #111',
            }}>
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center" style={{
                background: step.badgeColor,
                border: '2px solid #111',
                borderRadius: '50%',
            }}>
                    <span className="text-lg font-black text-[#111] font-headline leading-none">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[#111] font-headline">
                    {step.title}
                  </h3>
                </div>
                <p className="text-[#444] leading-relaxed text-sm font-body text-pretty">
                  {step.desc}
                </p>
              </div>))}
          </div>

          <div className="mt-5 sm:mt-6 flex flex-wrap items-center justify-between gap-3">
            <SoundToggle />
          </div>

          {timerSupported && (<div className="mt-6 sm:mt-8 p-4 sm:p-5" style={{
                background: '#fff',
                border: '2px solid #111',
                borderRadius: 14,
                boxShadow: '3px 3px 0 #111',
            }}>
              <p className="font-headline font-bold text-lg sm:text-xl text-[#111] mb-3">Round Timer</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <button type="button" {...press(() => setLocalTimerEnabled(false))} className="px-4 py-2 rounded-full font-headline font-bold text-sm cursor-pointer transition-transform active:scale-95" style={{
                background: !localTimerEnabled ? '#98d4ec' : '#fff',
                border: '2px solid #111',
                boxShadow: '2px 2px 0 #111',
                color: '#111',
            }}>
                  No Timer
                </button>
                <button type="button" {...press(() => setLocalTimerEnabled(true))} className="px-4 py-2 rounded-full font-headline font-bold text-sm cursor-pointer transition-transform active:scale-95" style={{
                background: localTimerEnabled ? '#98d4ec' : '#fff',
                border: '2px solid #111',
                boxShadow: '2px 2px 0 #111',
                color: '#111',
            }}>
                  Timer
                </button>
              </div>

              {localTimerEnabled && (<div className="grid grid-cols-1 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-body font-semibold text-[#111]">Rounds 1-12</p>
                      <p className="text-sm font-mono font-bold text-[#111]">{localTimerMinutes1_12} min</p>
                    </div>
                    <input type="range" min={1} max={10} step={1} value={localTimerMinutes1_12} onChange={(e) => setLocalTimerMinutes1_12(clampMinutes(Number(e.target.value)))} className="w-full accent-[#006e86] cursor-pointer"/>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-body font-semibold text-[#111]">Rounds 13-16</p>
                      <p className="text-sm font-mono font-bold text-[#111]">{localTimerMinutes13_16} min</p>
                    </div>
                    <input type="range" min={1} max={10} step={1} value={localTimerMinutes13_16} onChange={(e) => setLocalTimerMinutes13_16(clampMinutes(Number(e.target.value)))} className="w-full accent-[#006e86] cursor-pointer"/>
                  </div>
                </div>)}

              <button type="button" {...press(() => setRememberTimer((v) => !v))} className="mt-4 flex items-center gap-2.5 cursor-pointer select-none">
                <span className="flex items-center justify-center shrink-0" style={{
                width: 20,
                height: 20,
                background: rememberTimer ? '#006e86' : '#fff',
                border: '2px solid #111',
                borderRadius: 4,
                boxShadow: '1.5px 1.5px 0 #111',
                transition: 'background 0.1s',
            }}>
                  {rememberTimer && (<svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>)}
                </span>
                <span className="text-sm font-body font-semibold text-[#111]">Remember these settings</span>
              </button>
            </div>)}


          <div className="mt-8 sm:mt-10 flex flex-col items-center">
            <button {...press(() => dismissModal(true))} className="w-full sm:w-auto px-10 sm:px-12 py-4 sm:py-5 font-black text-lg sm:text-xl font-headline text-white cursor-pointer transition-transform active:scale-95 flex items-center justify-center gap-3" style={{
            background: '#38bdf8',
            border: '3px solid #111',
            borderRadius: 999,
            boxShadow: '4px 4px 0 #111',
        }}>
              Let&rsquo;s Go
              <ArrowRightIcon className="w-5 h-5 sm:w-6 sm:h-6"/>
            </button>
          </div>
        </AnimatedDialogPanel>
      </div>
    </Dialog>);
}
