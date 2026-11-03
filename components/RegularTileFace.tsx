'use client';
import { memo } from 'react';
import { TILE_BG, TILE_BG_VALID, TILE_BORDER, PICK_TILE_BG, PICK_TILE_BG_VALID, GLOSS, tileShadow, tileShadowValid, pickTileShadow, pickTileShadowValid, } from '@/lib/tile-styles';
export function PointDots({ value, isPickTile, dotColor }: {
    value: number;
    isPickTile: boolean;
    dotColor?: string;
}) {
    if (value <= 0)
        return null;
    const dotClass = isPickTile ? 'bg-white/70' : 'bg-on-surface-variant/60';
    return (<span className="absolute left-1/2 -translate-x-1/2 flex gap-[2px] pointer-events-none" style={{ bottom: isPickTile ? 'var(--e-pick-dots-bottom, 3px)' : 3 }}>
      {Array.from({ length: value }, (_, i) => (<span key={i} className={`w-[3px] h-[3px] rounded-full ${dotClass}`} style={dotColor ? { background: dotColor } : undefined}/>))}
    </span>);
}
export interface RegularTileFaceProps {
    letter: string;
    value?: number;
    isPickTile: boolean;
    inValidWord?: boolean;
    showDots?: boolean;
    small?: boolean;
    fontSize?: number;
    isWildcard?: boolean;
    wildcardHint?: boolean;
}
const WILDCARD_BG = 'linear-gradient(135deg, #ff6b6b 0%, #ffaa6b 20%, #ffd96b 40%, #6bff8e 55%, #6bc3ff 72%, #b06bff 88%, #ff6bef 100%)';
export const RegularTileFace = memo(function RegularTileFace({ letter, value = 0, isPickTile, inValidWord, showDots = false, small, fontSize, isWildcard, wildcardHint = false, }: RegularTileFaceProps) {
    const bg = isWildcard ? WILDCARD_BG : (isPickTile ? PICK_TILE_BG : TILE_BG);
    const bgValid = isPickTile ? PICK_TILE_BG_VALID : TILE_BG_VALID;
    const chin = fontSize ? Math.max(1, Math.round(fontSize * 0.167)) : 4;
    const shadow = inValidWord
        ? (isPickTile ? pickTileShadowValid(chin) : tileShadowValid(chin))
        : (isPickTile ? pickTileShadow(chin) : tileShadow(chin));
    const border = isPickTile ? 'var(--e-pick-tile-border, none)' : TILE_BORDER;
    return (<div className="w-full h-full relative flex items-center justify-center rounded-[0.5rem] select-none overflow-hidden" style={{
            background: bg,
            boxShadow: shadow,
            border,
            transition: 'box-shadow 700ms cubic-bezier(0.4,0,0.2,1)',
        }}>

      {!isWildcard && (<div className="absolute inset-0 pointer-events-none" style={{ background: bgValid, opacity: inValidWord ? 1 : 0, transition: 'opacity 700ms cubic-bezier(0.4,0,0.2,1)' }}/>)}
      {!isWildcard && wildcardHint && (<div className="absolute inset-0 pointer-events-none z-[5]">
          <span className="wildcard-hint-wipe absolute inset-[-60%] block"/>
        </div>)}
      <span className={`relative z-10 font-headline font-bold ${fontSize ? (small ? 'tracking-tight' : '') : (small ? 'text-xl tracking-tight' : 'text-2xl')}`} style={{
            ...(fontSize ? { fontSize } : {}),
            color: isWildcard
                ? 'white'
                : (isPickTile
                    ? 'var(--e-pick-tile-letter-color, white)'
                    : (inValidWord
                        ? 'var(--e-tile-letter-valid-color, #005f34)'
                        : 'var(--e-tile-letter-color, #004c5e)')),
            textShadow: isWildcard ? '0 1px 3px rgba(0,0,0,0.4)' : undefined,
            transition: (isPickTile || isWildcard) ? undefined : 'color 700ms cubic-bezier(0.4,0,0.2,1)',
        }}>
        {letter}
      </span>
      <span className="absolute z-20 top-[2px] left-[2px] right-[2px] h-[40%] rounded-t-[0.4rem] pointer-events-none" style={{ background: GLOSS }}/>
      {showDots && <PointDots value={value} isPickTile={isPickTile}/>}
    </div>);
});
