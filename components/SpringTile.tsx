'use client';
import { memo, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { PiArrowArcRightBold } from 'react-icons/pi';
import type { CellDescriptor, SwitchOption, SwitchSide } from '@/lib/tiles';
import useSound from 'use-sound';
import { TILE_BG, TILE_BG_VALID, TILE_BORDER, LIP_COLOR, LIP_COLOR_VALID, FIXED_TILE_BG, FIXED_LETTER_COLOR, getSwitchTint } from '@/lib/tile-styles';
import { RegularTileFace, PointDots } from '@/components/RegularTileFace';
import SurfboardSVG from '@/public/surf-board5.svg';
interface SpringTileProps {
    cell: CellDescriptor & {
        handTileId?: string;
    };
    sharedLayoutId?: string;
    cursorClass?: string;
    activeSide?: SwitchSide;
    onRotate?: () => void;
    inValidWord?: boolean;
    animDelay?: number;
    isFixed?: boolean;
    showDots?: boolean;
    wildcardHint?: boolean;
}
function useAnimDelayStyle(animDelay?: number) {
    return useMemo(() => animDelay !== undefined
        ? { animation: `valid-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${animDelay * 0.08}s both` }
        : undefined, [animDelay]);
}
const LetterTile = memo(function LetterTile({ letter, inValidWord, animDelay, isFixed, small, isPickTile, isWildcard, showDots, cursorClass = 'cursor-grab', wildcardHint, }: {
    letter: string;
    inValidWord?: boolean;
    animDelay?: number;
    isFixed?: boolean;
    small?: boolean;
    isPickTile?: boolean;
    isWildcard?: boolean;
    showDots?: boolean;
    cursorClass?: string;
    wildcardHint?: boolean;
}) {
    const animStyle = useAnimDelayStyle(animDelay);
    if (isFixed) {
        return (<div className="absolute inset-0 flex items-center justify-center cursor-default">
        <div className="relative w-[92%] h-[92%] flex items-center justify-center rounded-[0.4rem] select-none" style={{ background: FIXED_TILE_BG, border: TILE_BORDER }}>
          <span className={`font-headline font-bold ${small ? 'text-lg tracking-tight' : 'text-2xl'}`} style={{ color: FIXED_LETTER_COLOR }}>{letter}</span>
        </div>
      </div>);
    }
    return (<div className={`absolute inset-0 flex items-center justify-center ${cursorClass}`} style={animStyle}>
      <div className="relative w-[92%] h-[92%]">
        <RegularTileFace letter={letter} isPickTile={!!isPickTile} isWildcard={isWildcard} wildcardHint={wildcardHint} inValidWord={inValidWord} small={small} showDots={showDots} value={letter.length > 1 ? 0 : undefined}/>
      </div>
    </div>);
});
const FixedFlipTile = memo(function FixedFlipTile({ data, showDots }: {
    data: {
        sideA: SwitchOption;
        sideB: SwitchOption;
    };
    showDots?: boolean;
}) {
    const tint = getSwitchTint(data.sideA.letter, data.sideB.letter);
    return (<div className="absolute inset-0 flex items-center justify-center cursor-default">
      <div className="relative w-[92%] h-[92%] flex flex-col items-center justify-center rounded-[0.4rem] select-none" style={{ background: tint?.bg ?? FIXED_TILE_BG, border: TILE_BORDER }}>
        <span className="font-headline font-bold text-lg leading-none" style={{ color: FIXED_LETTER_COLOR }}>{data.sideA.letter}</span>
        <span className="text-[0.5rem] font-body leading-none mt-0.5" style={{ color: FIXED_LETTER_COLOR, opacity: 0.6 }}>{data.sideB.letter}</span>
        {showDots && <PointDots value={data.sideA.value} isPickTile={false} dotColor={tint?.dot}/>}
      </div>
    </div>);
});
const SurfboardCellFace = memo(function SurfboardCellFace() {
    return (<div className="absolute inset-0">
      <div className="absolute inset-[4%]">
        <RegularTileFace letter="" value={0} isPickTile={false} showDots={false}/>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <SurfboardSVG style={{
            width: '70%',
            transform: 'rotate(-45deg)',
            transformOrigin: 'center',
        }}/>
      </div>
    </div>);
});
export function FlipTile({ data, activeSide: activeSideProp, onRotate, inValidWord, animDelay, showDots, fontSize, fullSize = false, cursorClass = 'cursor-grab', }: {
    data: {
        sideA: SwitchOption;
        sideB: SwitchOption;
    };
    activeSide?: SwitchSide;
    onRotate?: () => void;
    inValidWord?: boolean;
    animDelay?: number;
    showDots?: boolean;
    fontSize?: number;
    fullSize?: boolean;
    cursorClass?: string;
}) {
    const [playPlace] = useSound('/sounds/pop_down.wav');
    const bodyRef = useRef<HTMLDivElement>(null);
    const initialRotation = activeSideProp === 'B' ? 180 : 0;
    const currentSideRef = useRef<SwitchSide>(activeSideProp ?? 'A');
    const targetRotationRef = useRef(initialRotation);
    const isAnimatingRef = useRef(false);
    const lastClickTimeRef = useRef(0);
    const rotation = useMotionValue(initialRotation);
    const animStyle = useAnimDelayStyle(animDelay);
    const handleFlip = useCallback((targetSide: SwitchSide) => {
        if (targetSide === currentSideRef.current)
            return;
        let nextRot = targetRotationRef.current + 180;
        const isTargetA = targetSide === 'A';
        const isNextEven = Math.round(nextRot / 180) % 2 === 0;
        if (isTargetA !== isNextEven) {
            nextRot += 180;
        }
        currentSideRef.current = targetSide;
        targetRotationRef.current = nextRot;
        isAnimatingRef.current = true;
        if (bodyRef.current)
            bodyRef.current.style.willChange = 'transform';
        animate(rotation, nextRot, {
            type: "spring",
            stiffness: 260,
            damping: 20,
            mass: 1,
            onComplete: () => {
                isAnimatingRef.current = false;
                if (bodyRef.current)
                    bodyRef.current.style.willChange = 'auto';
            }
        });
    }, [rotation]);
    useEffect(() => {
        if (activeSideProp !== undefined && activeSideProp !== currentSideRef.current) {
            handleFlip(activeSideProp);
        }
    }, [activeSideProp, handleFlip]);
    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const now = Date.now();
        if (now - lastClickTimeRef.current < 150)
            return;
        lastClickTimeRef.current = now;
        playPlace();
        if (onRotate) {
            onRotate();
        }
        else {
            const nextSide = currentSideRef.current === 'A' ? 'B' : 'A';
            handleFlip(nextSide);
        }
    }, [onRotate, playPlace, handleFlip]);
    const rotate = rotation;
    const counterRotate = useTransform(rotation, (r) => -r);
    const sideAOpacity = useTransform(rotation, (r) => Math.max(0, Math.cos((r * Math.PI) / 180)));
    const sideBOpacity = useTransform(rotation, (r) => Math.max(0, -Math.cos((r * Math.PI) / 180)));
    const tint = getSwitchTint(data.sideA.letter, data.sideB.letter);
    const showSuccessTint = !!inValidWord && !tint;
    const LIP = showSuccessTint ? LIP_COLOR_VALID : LIP_COLOR;
    const chin = fontSize ? Math.max(1, Math.round(fontSize * 0.167)) : 4;
    return (<div className="absolute inset-0 flex items-center justify-center" style={animStyle}>
      <div className={`relative ${fullSize ? 'w-full h-full' : 'w-[92%] h-[92%]'} ${cursorClass} select-none`} onClick={handleClick}>
        <motion.div className="relative w-full h-full" style={{ rotate }}>

          <motion.div className="absolute inset-x-0 rounded-[0.5rem] pointer-events-none transition-colors duration-700" style={{ bottom: -chin, top: chin, backgroundColor: LIP, opacity: sideAOpacity }}/>
          <motion.div className="absolute inset-x-0 rounded-[0.5rem] pointer-events-none transition-colors duration-700" style={{ top: -chin, bottom: chin, backgroundColor: LIP, opacity: sideBOpacity }}/>

          <div className="absolute inset-0 rounded-[0.5rem] overflow-hidden" style={{ background: tint?.bg ?? TILE_BG, border: TILE_BORDER }}>
            <div className="absolute inset-0 transition-opacity duration-700 pointer-events-none" style={{ background: TILE_BG_VALID, opacity: showSuccessTint ? 1 : 0 }}/>


            <motion.span className={`absolute inset-0 flex items-center justify-center font-headline font-bold ${fontSize ? '' : 'text-2xl'} pointer-events-none`} style={{ opacity: sideAOpacity, ...(fontSize ? { fontSize } : {}), color: showSuccessTint ? 'var(--e-tile-letter-valid-color, #005f34)' : 'var(--e-tile-letter-color, #004c5e)', transition: 'color 700ms cubic-bezier(0.4,0,0.2,1)' }}>{data.sideA.letter}</motion.span>
            <motion.span className={`absolute inset-0 flex items-center justify-center font-headline font-bold ${fontSize ? '' : 'text-2xl'} pointer-events-none`} style={{ opacity: sideBOpacity, rotate: 180, ...(fontSize ? { fontSize } : {}), color: showSuccessTint ? 'var(--e-tile-letter-valid-color, #005f34)' : 'var(--e-tile-letter-color, #004c5e)', transition: 'color 700ms cubic-bezier(0.4,0,0.2,1)' }}>{data.sideB.letter}</motion.span>


            <motion.div className="absolute inset-[-50%] pointer-events-none flex justify-center" style={{ rotate: counterRotate }}>
              <div className="w-[150%] mt-[10%] h-[40%]" style={{ background: 'var(--e-gloss, linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%))' }}/>
            </motion.div>
          </div>


          <div className="absolute inset-0 pointer-events-none">
            <motion.div className="absolute inset-0" style={{ opacity: sideAOpacity }}>
              <PiArrowArcRightBold className="absolute top-[2px] right-[2px] text-[0.65rem] rotate-[45deg]" style={{ color: 'var(--e-tile-letter-color, var(--color-primary))' }}/>
            </motion.div>
            <motion.div className="absolute inset-0" style={{ opacity: sideBOpacity, rotate: 180 }}>
              <PiArrowArcRightBold className="absolute top-[2px] right-[2px] text-[0.65rem] rotate-[45deg]" style={{ color: 'var(--e-tile-letter-color, var(--color-primary))' }}/>
            </motion.div>
          </div>

          {showDots && (<>
              <motion.div className="absolute inset-0" style={{ opacity: sideAOpacity }}>
                <PointDots value={data.sideA.value} isPickTile={false} dotColor={tint?.dot}/>
              </motion.div>
              <motion.div className="absolute inset-0" style={{ opacity: sideBOpacity, rotate: 180 }}>
                <PointDots value={data.sideB.value} isPickTile={false} dotColor={tint?.dot}/>
              </motion.div>
            </>)}
        </motion.div>
      </div>
    </div>);
}
const SpringTile = memo(function SpringTile({ cell, sharedLayoutId, cursorClass, activeSide, onRotate, inValidWord, animDelay, isFixed, showDots, wildcardHint }: SpringTileProps) {
    const content = useMemo(() => {
        switch (cell.kind) {
            case "empty": return null;
            case "regular": return <LetterTile letter={cell.letter} inValidWord={inValidWord} animDelay={animDelay} isFixed={isFixed} isPickTile={cell.isPickTile} showDots={showDots} cursorClass={cursorClass} wildcardHint={wildcardHint}/>;
            case "double": return <LetterTile letter={cell.letters[0] + cell.letters[1]} small inValidWord={inValidWord} animDelay={animDelay} isFixed={isFixed} showDots={showDots} cursorClass={cursorClass}/>;
            case "switch": return isFixed ? <FixedFlipTile data={cell} showDots={showDots}/> : <FlipTile data={cell} activeSide={activeSide} onRotate={onRotate} inValidWord={inValidWord} animDelay={animDelay} showDots={showDots} cursorClass={cursorClass}/>;
            case "wildcard": return <LetterTile letter={cell.representsLetter ?? "X"} isWildcard inValidWord={inValidWord} animDelay={animDelay} isFixed={isFixed} showDots={showDots} cursorClass={cursorClass}/>;
            case "surfboard": return <SurfboardCellFace />;
        }
    }, [cell, cursorClass, activeSide, onRotate, inValidWord, animDelay, isFixed, showDots, wildcardHint]);
    if (!content)
        return null;
    if (!sharedLayoutId) {
        return <div className="absolute inset-0">{content}</div>;
    }
    return (<motion.div layoutId={sharedLayoutId} transition={{ layout: { duration: 0 } }} className="absolute inset-0">
      {content}
    </motion.div>);
});
export default SpringTile;
