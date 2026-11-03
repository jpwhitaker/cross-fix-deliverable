'use client';
import { useEffect, useMemo, useRef, useState, type HTMLAttributes } from 'react';
import { FaCaretUp, FaPause, FaPlay } from 'react-icons/fa6';
import { useGameStore, selectScore, selectRound, selectRoundWordPills, selectTimerEnabled, selectRoundTimerEndsAt, selectTimerStatus, selectTimerMinutes1_12, selectTimerMinutes13_16, selectTimerPausedRemainingMs, } from '@/lib/game-store';
import { getMode } from '@/lib/modes/registry';
import { playedWordEntryIdentity, scorePartsForPlayedWord, type PlayedWordEntry } from '@/lib/presentation/round-word-pills';
import { usePenFriendlyPress } from '@/hooks/usePenFriendlyPress';
import useSound from 'use-sound';
const WORD_COLOR_LATEST = '#a2c25f';
const WORD_COLOR_OLD = '#fce49a';
const HUD_TOP_OFFSET_PX = 16;
const WORD_LIST_BOTTOM_CLEARANCE_PX = 300;
const WORD_LIST_TIMER_RESERVE_PX = 46;
const WORD_LIST_BUTTON_RESERVE_PX = 42;
const RIDE_SCORE_KEY = '__ride__';
type HudBar2Props = {
    onPlayedWordHover?: (entry: PlayedWordEntry | null) => void;
    onPlayedWordToggle?: (entry: PlayedWordEntry) => void;
    highlightedPlayedWord?: PlayedWordEntry | null;
};
function formatTimer(seconds: number): string {
    const s = Math.max(0, seconds);
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}
function ScorePartsLine({ entry, withLengthBonus, }: {
    entry: PlayedWordEntry;
    withLengthBonus: boolean;
}) {
    const parts = scorePartsForPlayedWord(entry, { withLengthBonus });
    return (<div className="mt-0.5 grid grid-cols-2 gap-x-1 font-mono text-[7px] sm:text-[8px] font-bold leading-tight text-[#111]/70 tabular-nums">
      <span>value: {parts.value}</span>
      <span className="text-right">length: {parts.length}</span>
    </div>);
}
function isSamePlayedWord(a: PlayedWordEntry, b: PlayedWordEntry | null): boolean {
    return !!b && playedWordEntryIdentity(a) === playedWordEntryIdentity(b);
}
export default function HudBar2({ onPlayedWordHover, onPlayedWordToggle, highlightedPlayedWord = null }: HudBar2Props = {}) {
    const score = useGameStore(selectScore);
    const round = useGameStore(selectRound);
    const modeId = useGameStore((s) => s.modeId);
    const roundPills = useGameStore(selectRoundWordPills);
    const timerEnabled = useGameStore(selectTimerEnabled);
    const roundTimerEndsAt = useGameStore(selectRoundTimerEndsAt);
    const timerStatus = useGameStore(selectTimerStatus);
    const timerMinutes1_12 = useGameStore(selectTimerMinutes1_12);
    const timerMinutes13_16 = useGameStore(selectTimerMinutes13_16);
    const timerPausedRemainingMs = useGameStore(selectTimerPausedRemainingMs);
    const pauseRoundTimer = useGameStore((s) => s.pauseRoundTimer);
    const resumeRoundTimer = useGameStore((s) => s.resumeRoundTimer);
    const mode = getMode(modeId);
    const config = mode.getRoundConfig(round);
    const modeUsesRideLengthBonus = mode.shouldWordHaveLengthBonus(RIDE_SCORE_KEY, RIDE_SCORE_KEY);
    const [wordsExpanded, setWordsExpanded] = useState(true);
    const [playClick] = useSound('/sounds/ui-click.wav');
    const press = usePenFriendlyPress<HTMLButtonElement>();
    const [nowMs, setNowMs] = useState(() => Date.now());
    const wordsListRef = useRef<HTMLDivElement | null>(null);
    const suppressNextTimerClickRef = useRef(false);
    const dragScrollRef = useRef<{
        pointerId: number | null;
        startY: number;
        startTop: number;
    }>({
        pointerId: null,
        startY: 0,
        startTop: 0,
    });
    const [dragScrolling, setDragScrolling] = useState(false);
    useEffect(() => {
        if (!timerEnabled)
            return;
        const timer = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [timerEnabled]);
    useEffect(() => {
        onPlayedWordHover?.(null);
    }, [onPlayedWordHover, roundPills]);
    const timerSeconds = useMemo(() => {
        const roundDefault = (round >= 13 ? timerMinutes13_16 : timerMinutes1_12) * 60;
        if (timerStatus === 'expired')
            return 0;
        if (timerStatus === 'paused' && timerPausedRemainingMs !== null)
            return Math.ceil(timerPausedRemainingMs / 1000);
        if (timerStatus !== 'running' || !roundTimerEndsAt)
            return roundDefault;
        const remaining = Math.max(0, Math.ceil((roundTimerEndsAt - nowMs) / 1000));
        return Math.min(roundDefault, remaining);
    }, [nowMs, round, roundTimerEndsAt, timerMinutes1_12, timerMinutes13_16, timerStatus, timerPausedRemainingMs]);
    const timerLabel = timerStatus === 'expired' ? "Time's up" : formatTimer(timerSeconds);
    const isWarning = timerStatus === 'running' && timerSeconds <= 60;
    const timerStyle = timerStatus === 'expired'
        ? { background: '#fca5a5', border: '2px solid #111', boxShadow: '3px 3px 0 #111', color: '#111' }
        : timerStatus === 'paused'
            ? { background: '#f87171', border: '2px solid #111', boxShadow: '3px 3px 0 #111', color: '#111' }
            : isWarning
                ? { background: '#ffb73f', border: '2px solid #111', boxShadow: '3px 3px 0 #111', color: '#111' }
                : { background: '#98d4ec', border: '2px solid #111', boxShadow: '3px 3px 0 #111', color: '#111' };
    const wordsListReservedPx = HUD_TOP_OFFSET_PX +
        WORD_LIST_BOTTOM_CLEARANCE_PX +
        (timerEnabled ? WORD_LIST_TIMER_RESERVE_PX : 0) +
        (roundPills.length > 1 ? WORD_LIST_BUTTON_RESERVE_PX : 0);
    const wordsListMaxHeight = `calc(100dvh - env(safe-area-inset-bottom, 0px) - ${wordsListReservedPx}px)`;
    const handleWordsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        const el = wordsListRef.current;
        if (!el)
            return;
        if (el.scrollHeight <= el.clientHeight)
            return;
        e.preventDefault();
        e.stopPropagation();
        el.scrollTop += e.deltaY;
    };
    const handleWordsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'mouse' || e.button !== 0)
            return;
        const el = wordsListRef.current;
        if (!el)
            return;
        if (el.scrollHeight <= el.clientHeight)
            return;
        dragScrollRef.current = {
            pointerId: e.pointerId,
            startY: e.clientY,
            startTop: el.scrollTop,
        };
        setDragScrolling(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
    };
    const handleWordsPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragScrollRef.current;
        if (drag.pointerId !== e.pointerId)
            return;
        const el = wordsListRef.current;
        if (!el)
            return;
        const dy = e.clientY - drag.startY;
        el.scrollTop = drag.startTop - dy;
        e.preventDefault();
        e.stopPropagation();
    };
    const handleWordsPointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragScrollRef.current;
        if (drag.pointerId !== e.pointerId)
            return;
        dragScrollRef.current = { pointerId: null, startY: 0, startTop: 0 };
        setDragScrolling(false);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        e.stopPropagation();
    };
    const handleTimerToggle = () => {
        playClick();
        setNowMs(Date.now());
        if (timerStatus === 'paused')
            resumeRoundTimer();
        else
            pauseRoundTimer();
    };
    const wordHoverProps = (entry: PlayedWordEntry): HTMLAttributes<HTMLDivElement> => {
        if (!onPlayedWordHover && !onPlayedWordToggle)
            return {};
        const highlighted = isSamePlayedWord(entry, highlightedPlayedWord);
        return {
            role: 'button',
            tabIndex: 0,
            'aria-pressed': highlighted,
            onPointerEnter: (e) => {
                if (e.pointerType === 'touch')
                    return;
                onPlayedWordHover?.(entry);
            },
            onPointerMove: (e) => {
                if (e.pointerType === 'touch')
                    return;
                onPlayedWordHover?.(entry);
            },
            onPointerLeave: (e) => {
                if (e.pointerType === 'touch')
                    return;
                onPlayedWordHover?.(null);
            },
            onClick: (e) => {
                e.stopPropagation();
                onPlayedWordToggle?.(entry);
            },
            onKeyDown: (e) => {
                if (e.key !== 'Enter' && e.key !== ' ')
                    return;
                e.preventDefault();
                onPlayedWordToggle?.(entry);
            },
        };
    };
    return (<>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div style={{
            background: '#fce49a',
            border: '3px solid #111',
            borderRadius: 18,
            boxShadow: '4px 4px 0 #111',
            padding: '8px 16px 10px',
        }}>
          <div className="flex items-baseline gap-2 justify-center">
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#111]">Score</span>
            <span className="font-headline font-black text-[#111] tabular-nums text-base leading-none">{score}</span>
          </div>
          <p className="font-mono text-[9px] font-bold text-[#555] m-0 mt-1 text-center">
            Round {round}/{config.totalRounds}
          </p>
        </div>
      </div>


      {timerEnabled && (<div className="absolute top-4 right-4 z-[55] w-28 sm:w-44">
          <div className="w-full flex items-center gap-1.5">
            {(timerStatus === 'running' || timerStatus === 'paused') && (<button type="button" onPointerUp={(e) => {
                    if (e.pointerType !== 'pen')
                        return;
                    e.preventDefault();
                    e.stopPropagation();
                    suppressNextTimerClickRef.current = true;
                    handleTimerToggle();
                }} onClick={(e) => {
                    if (suppressNextTimerClickRef.current) {
                        suppressNextTimerClickRef.current = false;
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    handleTimerToggle();
                }} aria-label={timerStatus === 'paused' ? 'Resume timer' : 'Pause timer'} className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-transform" style={{
                    background: timerStatus === 'paused' ? '#f87171' : '#fff',
                    border: '2px solid #111',
                    boxShadow: '2px 2px 0 #111',
                    color: '#111',
                }}>
                {timerStatus === 'paused' ? <FaPlay size={9}/> : <FaPause size={9}/>}
              </button>)}
            <div className="h-8 sm:h-9 flex-1 px-2 sm:px-3 rounded-xl flex items-center justify-between" style={timerStyle}>
              <span className="font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-wide">
                Timer
              </span>
              <span className="font-mono text-[10px] sm:text-xs font-black tabular-nums">
                {timerLabel}
              </span>
            </div>
          </div>
        </div>)}


      {roundPills.length > 0 && (<div className={`absolute right-4 z-20 flex flex-col items-end gap-2.5 w-28 sm:w-44 ${timerEnabled ? 'top-[54px] sm:top-[58px]' : 'top-4'}`}>
          <div ref={wordsListRef} className="w-full flex flex-col gap-1.5 overflow-y-auto" onWheel={handleWordsWheel} onWheelCapture={handleWordsWheel} onPointerDown={handleWordsPointerDown} onPointerMove={handleWordsPointerMove} onPointerUp={handleWordsPointerUpOrCancel} onPointerCancel={handleWordsPointerUpOrCancel} style={{
                maxHeight: wordsListMaxHeight,
                paddingBottom: 3,
                paddingRight: 3,
                touchAction: 'pan-y',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                cursor: dragScrolling ? 'grabbing' : 'grab',
            }}>
            {(wordsExpanded ? roundPills : roundPills.slice(0, 1)).map((pill, i) => (<div key={`${pill.round}-${pill.ride.word}-${i}`} className="flex flex-col gap-0.5 px-2 py-1 sm:px-3 sm:py-1.5" style={{
                    background: i === 0 ? WORD_COLOR_LATEST : WORD_COLOR_OLD,
                    border: '2px solid #111',
                    borderRadius: 12,
                    boxShadow: '3px 3px 0 #111',
                }}>

                <div className="-mx-1 rounded-md px-1" {...wordHoverProps(pill.ride)}>
                  <div className="flex items-center justify-between">
                    <span className="font-headline font-black text-[11px] sm:text-sm text-[#111] uppercase tracking-wide">
                      {pill.ride.word}
                    </span>
                    <span className="font-mono text-[9px] sm:text-[11px] font-bold text-[#111] tabular-nums">
                      {pill.ride.role === 'sbs' ? 'SBS' : `+${pill.ride.points}`}
                    </span>
                  </div>
                  {pill.ride.role !== 'sbs' && <ScorePartsLine entry={pill.ride} withLengthBonus={modeUsesRideLengthBonus}/>}
                </div>
                {pill.extras.map((extra, extraIndex) => (<div key={`${extra.word}-${extraIndex}`} className="-mx-1 rounded-md px-1 opacity-80" {...wordHoverProps(extra)}>
                    <div className="flex items-center justify-between">
                      <span className="font-headline font-bold text-[9px] sm:text-[10px] text-[#111] uppercase tracking-wide">
                        {extra.word}
                      </span>
                      <span className="font-mono text-[8px] sm:text-[10px] font-bold text-[#111] tabular-nums">
                        {extra.role === 'sbs' ? 'SBS' : `(+${extra.points})`}
                      </span>
                    </div>
                    {extra.role !== 'sbs' && <ScorePartsLine entry={extra} withLengthBonus={false}/>}
                  </div>))}
                {pill.extras.length > 0 && (<div className="mt-0.5 pt-0.5 border-t border-[#111]/20 flex items-center justify-between">
                    <span className="font-mono text-[8px] sm:text-[9px] font-black uppercase tracking-wide text-[#111]">
                      Total
                    </span>
                    <span className="font-mono text-[9px] sm:text-[10px] font-black text-[#111] tabular-nums">
                      +{pill.totalPoints}
                    </span>
                  </div>)}
              </div>))}
          </div>

          {roundPills.length > 1 && (<button {...press(() => { playClick(); onPlayedWordHover?.(null); setWordsExpanded(v => !v); })} className="self-end shrink-0 flex items-center justify-center cursor-pointer transition-transform active:scale-90" style={{
                    width: 32, height: 32,
                    background: '#fff',
                    border: '2px solid #111',
                    borderRadius: '50%',
                    boxShadow: '2px 2px 0 #111',
                    color: '#111',
                }}>
              <FaCaretUp className={`text-base transition-transform duration-200 ${wordsExpanded ? '' : 'rotate-180'}`}/>
            </button>)}
        </div>)}
    </>);
}
